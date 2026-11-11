"""Curriculum catalog definition for all training tracks and modules.
Provides the master module catalog with 6 core tracks for advanced manufacturing and emerging technologies.
"""

CURRICULUM_CATALOG = [
    # 1. Additive Manufacturing & 3D Printing
    {"track": "Additive Manufacturing & 3D Printing", "module": "3D Printing Fundamentals", "name": "3D Printing Fundamentals", "max_score": 100.0},
    {"track": "Additive Manufacturing & 3D Printing", "module": "FDM, FFF, FGF, LPBF", "name": "FDM, FFF, FGF, LPBF", "max_score": 100.0},
    {"track": "Additive Manufacturing & 3D Printing", "module": "Material Science", "name": "Material Science", "max_score": 100.0},
    {"track": "Additive Manufacturing & 3D Printing", "module": "Slicing Software", "name": "Slicing Software", "max_score": 100.0},
    {"track": "Additive Manufacturing & 3D Printing", "module": "Printer Calibration", "name": "Printer Calibration", "max_score": 100.0},
    {"track": "Additive Manufacturing & 3D Printing", "module": "Industrial Applications", "name": "Industrial Applications", "max_score": 100.0},

    # 2. CAD Design & Product Development
    {"track": "CAD Design & Product Development", "module": "Engineering Drawing", "name": "Engineering Drawing", "max_score": 100.0},
    {"track": "CAD Design & Product Development", "module": "AutoCAD", "name": "AutoCAD", "max_score": 100.0},
    {"track": "CAD Design & Product Development", "module": "Fusion 360", "name": "Fusion 360", "max_score": 100.0},
    {"track": "CAD Design & Product Development", "module": "SolidWorks", "name": "SolidWorks", "max_score": 100.0},
    {"track": "CAD Design & Product Development", "module": "CATIA", "name": "CATIA", "max_score": 100.0},
    {"track": "CAD Design & Product Development", "module": "Product Design", "name": "Product Design", "max_score": 100.0},
    {"track": "CAD Design & Product Development", "module": "Design for Manufacturing (DFM)", "name": "Design for Manufacturing (DFM)", "max_score": 100.0},

    # 3. 3D Scanning & Reverse Engineering
    {"track": "3D Scanning & Reverse Engineering", "module": "3D Scanning", "name": "3D Scanning", "max_score": 100.0},
    {"track": "3D Scanning & Reverse Engineering", "module": "Point Cloud Processing", "name": "Point Cloud Processing", "max_score": 100.0},
    {"track": "3D Scanning & Reverse Engineering", "module": "Mesh Editing", "name": "Mesh Editing", "max_score": 100.0},
    {"track": "3D Scanning & Reverse Engineering", "module": "Scan Analysis", "name": "Scan Analysis", "max_score": 100.0},
    {"track": "3D Scanning & Reverse Engineering", "module": "Reverse Engineering", "name": "Reverse Engineering", "max_score": 100.0},
    {"track": "3D Scanning & Reverse Engineering", "module": "Quality Inspection", "name": "Quality Inspection", "max_score": 100.0},

    # 4. XR / VR / AR & Animation
    {"track": "XR / VR / AR & Animation", "module": "Augmented Reality", "name": "Augmented Reality", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Virtual Reality", "name": "Virtual Reality", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Mixed Reality", "name": "Mixed Reality", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Unity", "name": "Unity", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Unreal Engine", "name": "Unreal Engine", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Blender", "name": "Blender", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "3D Modelling", "name": "3D Modelling", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Animation", "name": "Animation", "max_score": 100.0},
    {"track": "XR / VR / AR & Animation", "module": "Motion Graphics", "name": "Motion Graphics", "max_score": 100.0},

    # 5. AI, Machine Learning & Industry 4.0
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Python", "name": "Python", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "AI Fundamentals", "name": "AI Fundamentals", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Machine Learning", "name": "Machine Learning", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Deep Learning", "name": "Deep Learning", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Computer Vision", "name": "Computer Vision", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Generative AI", "name": "Generative AI", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Digital Twin", "name": "Digital Twin", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Predictive Maintenance", "name": "Predictive Maintenance", "max_score": 100.0},
    {"track": "AI, Machine Learning & Industry 4.0", "module": "Smart Manufacturing", "name": "Smart Manufacturing", "max_score": 100.0},

    # 6. Robotics, IoT & Drone Technology
    {"track": "Robotics, IoT & Drone Technology", "module": "Robotics Fundamentals", "name": "Robotics Fundamentals", "max_score": 100.0},
    {"track": "Robotics, IoT & Drone Technology", "module": "Sensors & Actuators", "name": "Sensors & Actuators", "max_score": 100.0},
    {"track": "Robotics, IoT & Drone Technology", "module": "PLC & Automation", "name": "PLC & Automation", "max_score": 100.0},
    {"track": "Robotics, IoT & Drone Technology", "module": "Industrial IoT", "name": "Industrial IoT", "max_score": 100.0},
    {"track": "Robotics, IoT & Drone Technology", "module": "Drone Technology", "name": "Drone Technology", "max_score": 100.0},
    {"track": "Robotics, IoT & Drone Technology", "module": "Mapping & Surveying", "name": "Mapping & Surveying", "max_score": 100.0},
    {"track": "Robotics, IoT & Drone Technology", "module": "ROS (Robot Operating System)", "name": "ROS (Robot Operating System)", "max_score": 100.0},
]

TRACKS = [
    "Additive Manufacturing & 3D Printing",
    "CAD Design & Product Development",
    "3D Scanning & Reverse Engineering",
    "XR / VR / AR & Animation",
    "AI, Machine Learning & Industry 4.0",
    "Robotics, IoT & Drone Technology",
]

CATALOG = CURRICULUM_CATALOG
CURRICULUM = CURRICULUM_CATALOG
