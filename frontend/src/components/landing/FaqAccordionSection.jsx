import React, { useState } from "react";
import { Plus, Minus, HelpCircle, ArrowRight } from "lucide-react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";

const FAQS = [
  {
    q: "How long does it take to onboard a new engineering cohort?",
    a: "Under 5 minutes. Admins can bulk-provision trainee accounts via CSV import or connect directly through FastAPI endpoints. The 3NF relational schema assigns mentors and cohort batches immediately.",
  },
  {
    q: "Can the platform handle complex viva rubrics and coding assessments?",
    a: "Yes. TraineeIQ supports multi-parameter rubrics (syntax correctness, algorithmic complexity, architectural reasoning, and communication) with automated scoring and supervised trainer review.",
  },
  {
    q: "Is cohort and trainee assessment data secure and isolated?",
    a: "Strictly isolated. Sprint 1A and 1B establish rigorous role-based access control (RBAC). Trainees can never view other trainees' assessment data or private messages; trainers are scoped to their assigned batches.",
  },
  {
    q: "What developer tools and LMS platforms does TraineeIQ integrate with?",
    a: "TraineeIQ exposes standardized REST APIs and WebSocket endpoints for VS Code extensions, GitHub pull request webhooks, LMS gradebooks, and real-time chat environments.",
  },
  {
    q: "How does the system distinguish live failures from normal empty states?",
    a: "By architectural contract: network failures trigger explicit error banners with retry buttons, empty cohorts show clean zero-state guidance, and cached profiles are never treated as proof of live authorization.",
  },
];

export function FaqAccordionSection() {
  const [openIndex, setOpenIndex] = useState(0);
  const [sectionRef, sectionVisible] = useRevealOnScroll();

  return (
    <section className="bg-white py-20 sm:py-28 px-6 sm:px-10 border-b border-black/[0.05]">
      <div
        ref={sectionRef}
        className={`tiq-reveal ${sectionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start`}
      >
        {/* Left Editorial Column (Matching Frame 012) */}
        <div className="lg:col-span-5 space-y-5">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
            Clear Answers for Engineering Leaders
          </h2>
          <p className="text-xs sm:text-sm text-[#787063] leading-relaxed">
            Everything you need to know about TraineeIQ&apos;s real-time telemetry, viva evaluation workflows, and security guarantees.
          </p>

          <div className="pt-4 p-5 rounded-2xl bg-[#F7F6F2] border border-black/[0.05] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1C1B17]">
              <HelpCircle className="w-4 h-4 text-[#E45826]" />
              <span>Didn&apos;t find your answer?</span>
            </div>
            <p className="text-[11px] text-[#5C5549] leading-relaxed">
              Our engineering mentors and curriculum advisors are available for technical walkthroughs.
            </p>
            <a
              href="mailto:support@traineeiq.internal"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C2331] hover:bg-[#111620] text-white text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <span>Contact Support</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Right Accordion List (Matching Frame 012) */}
        <div className="lg:col-span-7 divide-y divide-black/[0.06]">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={faq.q} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  className="w-full text-left py-2 flex items-center justify-between gap-4 group focus:outline-none cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className={`text-sm sm:text-base font-semibold tracking-tight transition-colors ${isOpen ? "text-[#E45826]" : "text-[#1C1B17] group-hover:text-[#E45826]"}`}>
                    {faq.q}
                  </span>
                  <span className="w-7 h-7 rounded-full bg-[#F3F1ED] group-hover:bg-[#EAE7E1] flex items-center justify-center shrink-0 transition-colors text-[#1C1B17]">
                    {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {isOpen && (
                  <p className="text-xs sm:text-sm text-[#5C5549] mt-2.5 leading-relaxed pr-8 animate-fadeIn">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FaqAccordionSection;

