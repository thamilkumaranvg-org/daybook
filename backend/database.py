from sqlalchemy import event, text

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "daybook.db"

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


@event.listens_for(engine, "connect")
def _sqlite_fk(dbapi_conn, _record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    """Add columns introduced after the first schema without dropping data."""
    with engine.begin() as conn:
        def colnames(table: str) -> set[str]:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            return {row[1] for row in rows}

        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).fetchall()
        }
        if "activities" in tables:
            cols = colnames("activities")
            if "priority" not in cols:
                conn.execute(text("ALTER TABLE activities ADD COLUMN priority INTEGER DEFAULT 0"))
        if "sessions" in tables:
            cols = colnames("sessions")
            if "theme" not in cols:
                conn.execute(text("ALTER TABLE sessions ADD COLUMN theme VARCHAR(32)"))
            if "mentor" not in cols:
                conn.execute(text("ALTER TABLE sessions ADD COLUMN mentor VARCHAR(64)"))
