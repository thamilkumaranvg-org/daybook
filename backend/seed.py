from datetime import date, timedelta

from sqlalchemy.orm import Session as DbSession

from backend.auth import hash_password
from backend.models import Activity, User

DEMO_USERNAME = "user1"
DEMO_PASSWORD = "demo1234"


def _key(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def seed_if_empty(db: DbSession) -> None:
    if db.query(User).first():
        return

    user = User(username=DEMO_USERNAME, password_hash=hash_password(DEMO_PASSWORD))
    db.add(user)
    db.flush()

    samples = [
        ("Review project brief", "Check requirements doc", 0, False, None),
        ("Team stand-up", "9:30 AM call", 0, True, "09:35 AM"),
        ("Reply to client email", "", 0, False, None),
        ("Morning planning", "", 1, True, "08:50 AM"),
        ("Update task tracker", "", 2, True, "05:00 PM"),
        ("Prepare weekly report", "Include KPIs", 3, True, "04:10 PM"),
        ("Plan sprint tasks", "With team lead", 5, True, "11:20 AM"),
        ("Clean up inbox", "", 6, True, "03:40 PM"),
    ]
    for title, notes, ago, completed, time in samples:
        db.add(
            Activity(
                user_id=user.id,
                title=title,
                notes=notes,
                date=_key(ago),
                completed=completed,
                time=time,
            )
        )
    db.commit()
