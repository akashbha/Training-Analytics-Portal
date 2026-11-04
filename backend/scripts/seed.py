"""Convenience entrypoint for seeding the database.
Calls app.db.seed.seed_database with command line arguments.
"""

import os
import sys

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.seed import main

if __name__ == "__main__":
    main()
