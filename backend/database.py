"""SQLite database setup with SQLAlchemy."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agentready.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and apply auto-migrations for new columns."""
    from backend.models import (  # noqa: F401
        Merchant, Product, Manifest, Intent,
        Negotiation, Order, AuditLog
    )
    Base.metadata.create_all(bind=engine)

    # Auto-add new columns to existing SQLite tables if missing
    with engine.connect() as conn:
        for table, col, col_type in [
            ("audit_logs", "actor_uid", "VARCHAR(128) DEFAULT ''"),
            ("audit_logs", "actor_email", "VARCHAR(255) DEFAULT ''"),
            ("audit_logs", "actor_role", "VARCHAR(50) DEFAULT ''"),
            ("orders", "buyer_uid", "VARCHAR(128) DEFAULT ''"),
            ("orders", "buyer_email", "VARCHAR(255) DEFAULT ''"),
            ("negotiations", "buyer_uid", "VARCHAR(128) DEFAULT ''"),
            ("negotiations", "buyer_email", "VARCHAR(255) DEFAULT ''"),
        ]:
            try:
                from sqlalchemy import text
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # Column already exists

