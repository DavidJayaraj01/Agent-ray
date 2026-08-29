import sys
from pathlib import Path

# Add repo root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.database import SessionLocal, init_db
from backend.models import Merchant, Product
from backend.seed_data import seed_all

def run():
    init_db()
    db = SessionLocal()
    try:
        print("Seeding enterprise merchants...")
        seed_all(db)
        count = db.query(Merchant).count()
        p_count = db.query(Product).count()
        print(f"SUCCESS: {count} merchants and {p_count} products now active in database!")
        for m in db.query(Merchant).all():
            print(f" - [{m.category}] {m.name} (Trust: {m.trust_score:.1f})")
    finally:
        db.close()

if __name__ == "__main__":
    run()
