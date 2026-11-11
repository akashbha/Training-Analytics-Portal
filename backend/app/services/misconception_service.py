"""Service computing Curriculum Misconception & Error Clustering for batches.
Performs TF-IDF embedding vectorization and semantic clustering on session diagnostic notes.
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func
import numpy as np

from app.models.session_note import SessionNote
from app.models.session import Session as TraineeSession
from app.models.trainee import Trainee
from app.models.module import Module
from app.schemas.misconception import (
    AffectedTraineeEvidence,
    MisconceptionClusterItem,
    MisconceptionAnalysisResponse,
)

# In-memory approval registry for trainer human-in-the-loop review
_APPROVED_CLUSTERS: set = set()

class MisconceptionService:
    def __init__(self, db: Session):
        self.db = db

    def get_batch_misconceptions(self, batch_id: int) -> MisconceptionAnalysisResponse:
        """Analyzes session diagnostic notes for a batch and clusters recurring failure patterns."""
        # 1. Total trainees in batch for prevalence calculation
        total_trainees = (
            self.db.query(func.count(Trainee.id))
            .filter(Trainee.batch_id == batch_id)
            .scalar()
            or 1
        )

        # 2. Fetch diagnostic notes for trainees in this batch
        query = (
            self.db.query(
                SessionNote.id.label("note_id"),
                SessionNote.text.label("note_text"),
                SessionNote.created_at.label("note_created_at"),
                TraineeSession.id.label("session_id"),
                TraineeSession.score.label("score"),
                TraineeSession.errors.label("errors"),
                Trainee.id.label("trainee_id"),
                Trainee.name.label("trainee_name"),
                Module.name.label("module_name")
            )
            .join(TraineeSession, SessionNote.session_id == TraineeSession.id)
            .join(Trainee, TraineeSession.trainee_id == Trainee.id)
            .join(Module, TraineeSession.module_id == Module.id)
            .filter(Trainee.batch_id == batch_id)
            .order_by(SessionNote.created_at.desc())
        )
        rows = query.all()

        if not rows:
            return MisconceptionAnalysisResponse(
                batch_id=batch_id,
                total_notes_analyzed=0,
                cluster_count=0,
                clusters=[]
            )

        # 3. If notes exist, vectorize and cluster using TF-IDF + Agglomerative Clustering
        texts = [r.note_text for r in rows]

        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.cluster import AgglomerativeClustering

            vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", min_df=1)
            X = vectorizer.fit_transform(texts).toarray()
            vocab = np.array(vectorizer.get_feature_names_out())

            k = min(3, max(1, len(rows) // 3))
            if len(rows) >= 2 and k >= 2:
                clustering = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average")
                labels = clustering.fit_predict(X)
            else:
                labels = [0] * len(rows)
                k = 1
        except Exception:
            # Fallback to single group if scikit-learn clustering fails
            labels = [0] * len(rows)
            vocab = np.array([])
            X = np.zeros((len(rows), 1))
            k = 1

        clusters: List[MisconceptionClusterItem] = []

        for cluster_idx in range(k):
            indices = [i for i, lbl in enumerate(labels) if lbl == cluster_idx]
            if not indices:
                continue

            cluster_rows = [rows[i] for i in indices]
            cluster_modules = sorted(list(set(r.module_name for r in cluster_rows)))
            distinct_trainees = sorted(list(set(r.trainee_name for r in cluster_rows)))

            # Top distinctive terms
            if len(vocab) > 0 and X.shape[1] > 0:
                cluster_sub_matrix = X[indices]
                centroid = cluster_sub_matrix.mean(axis=0)
                top_indices = centroid.argsort()[::-1][:5]
                top_terms = vocab[top_indices].tolist()
            else:
                top_terms = ["diagnostic", "assessment", "review"]

            # Derive domain and title based on modules and top terms
            terms_joined = " ".join(top_terms).lower()
            modules_joined = " ".join(cluster_modules).lower()

            if any(term in terms_joined or term in modules_joined for term in ["constraint", "sketch", "solidworks", "autocad", "fusion", "catia", "profile"]):
                domain = "Computer-Aided Design & Modeling"
                title = "Parametric Geometric Constraints & Non-Planar Boundary Profiles"
                suggested_action = "Schedule a 15-minute walkthrough on Degree-of-Freedom resolution and Coincident constraints. Assign Parametric Constraining Drill #2."
            elif any(term in terms_joined or term in modules_joined for term in ["softmax", "entropy", "gradient", "loss", "deep learning", "ai", "activation"]):
                domain = "Neural Architectures & Optimization"
                title = "Loss Function & Activation Architecture Mismatch"
                suggested_action = "Conduct a review on Binary vs Categorical Cross-Entropy loss and Softmax vs Sigmoid output layers. Assign Loss Function Diagnostics Drill."
            elif any(term in terms_joined or term in modules_joined for term in ["normal", "mesh", "scan", "point cloud", "reverse", "poisson", "surface"]):
                domain = "3D Scanning & Mesh Engineering"
                title = "Surface Normal Orientation & Non-Manifold Boundary Edges"
                suggested_action = "Demonstrate k-NN surface normal propagation and open boundary edge repair before watertight Poisson surface reconstruction."
            else:
                domain = cluster_modules[0] if cluster_modules else "Core Curriculum"
                title = f"Recurring Diagnostic Pattern: {top_terms[0].title()} & {top_terms[1].title() if len(top_terms) > 1 else 'Synthesis'}"
                suggested_action = "Review assessment submission excerpts and conduct a short revision session on underlying concepts."

            cluster_id = f"batch_{batch_id}_cluster_{cluster_idx + 1}"
            prevalence_pct = round((len(distinct_trainees) / total_trainees) * 100.0, 1)

            evidence_items = [
                AffectedTraineeEvidence(
                    trainee_id=r.trainee_id,
                    trainee_name=r.trainee_name,
                    session_id=r.session_id,
                    score=float(r.score or 0.0),
                    errors=int(r.errors or 0),
                    module_name=r.module_name,
                    note_excerpt=r.note_text,
                    session_date=r.note_created_at.strftime("%b %d, %Y") if r.note_created_at else "Recent"
                )
                for r in cluster_rows
            ]

            is_approved = cluster_id in _APPROVED_CLUSTERS

            clusters.append(
                MisconceptionClusterItem(
                    id=cluster_id,
                    title=title,
                    domain=domain,
                    affected_trainee_count=len(distinct_trainees),
                    cohort_prevalence_pct=prevalence_pct,
                    modules=cluster_modules,
                    key_terms=top_terms,
                    suggested_action=suggested_action,
                    evidence_count=len(evidence_items),
                    evidence=evidence_items,
                    approved=is_approved
                )
            )

        # Sort clusters by affected trainee count descending
        clusters.sort(key=lambda c: c.affected_trainee_count, reverse=True)

        return MisconceptionAnalysisResponse(
            batch_id=batch_id,
            total_notes_analyzed=len(rows),
            cluster_count=len(clusters),
            clusters=clusters
        )

    def toggle_cluster_approval(self, cluster_id: str, approved: bool) -> bool:
        """Toggles human-in-the-loop approval status for a misconception cluster."""
        if approved:
            _APPROVED_CLUSTERS.add(cluster_id)
        else:
            _APPROVED_CLUSTERS.discard(cluster_id)
        return cluster_id in _APPROVED_CLUSTERS
