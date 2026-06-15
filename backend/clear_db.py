"""Destructive maintenance script: drops and recreates ALL database tables.

This wipes every row in the database. It is intentionally guarded so it cannot be
run by accident (e.g. against a production DATABASE_URL). To run it you must set:

    CONFIRM_DB_WIPE=yes

Example (PowerShell):
    $env:CONFIRM_DB_WIPE = "yes"; python clear_db.py
"""

import os
import sys

from app import app
from database import db


def main() -> int:
    if os.getenv("CONFIRM_DB_WIPE", "").strip().lower() not in {"yes", "true", "1"}:
        print(
            "Refusing to wipe the database. Set CONFIRM_DB_WIPE=yes to proceed.\n"
            "This will DROP ALL TABLES and delete every row.",
            file=sys.stderr,
        )
        return 1

    target = os.getenv("DATABASE_URL", "sqlite (local default)")
    print(f"About to DROP ALL TABLES on: {target}")
    with app.app_context():
        db.drop_all()
        db.create_all()
        print("Database cleared!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
