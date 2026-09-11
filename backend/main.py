import mimetypes
import secrets
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

mimetypes.add_type("image/webp", ".webp")


from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as DbSession

from backend.auth import get_current_session, get_current_user, verify_password
from backend.catalog import validate_theme_mentor
from backend.database import Base, engine, get_db, migrate_schema
from backend.gameplay import badge_label, serialize_quest, snapshot_progress, sync_progress
from backend.models import Activity, Badge, Quest, Session, User, UserProgress
from backend.schemas import (
    ActivityCreate,
    ActivityOut,
    ActivityUpdate,
    LoginRequest,
    LoginResponse,
    SessionStartRequest,
)
from backend.seed import seed_if_empty

ROOT = Path(__file__).resolve().parent.parent
bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_schema()
    db = next(get_db())
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Daybook", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

assets_dir = ROOT / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

frontend_assets_dir = ROOT / "frontend" / "assets"
if frontend_assets_dir.exists():
    app.mount("/frontend/assets", StaticFiles(directory=str(frontend_assets_dir)), name="frontend_assets")



def _now_time() -> str:
    return datetime.now().strftime("%I:%M %p").lstrip("0")


def _today() -> str:
    return datetime.now().date().isoformat()


def _run_sync(db, user, session, event_hint=None, detail=""):
    return sync_progress(
        db,
        user,
        session.theme,
        session.mentor,
        event_hint=event_hint,
        detail=detail,
    )


@app.post("/api/session/start")
def session_start(
    body: SessionStartRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    if session.theme or session.mentor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Theme and mentor are locked for this session",
        )
    try:
        validate_theme_mentor(body.theme, body.mentor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session.theme = body.theme
    session.mentor = body.mentor
    db.commit()
    payload = _run_sync(db, user, session, event_hint="login")
    return payload


@app.get("/api/progress")
def get_progress(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    return snapshot_progress(db, user, session.theme, session.mentor)


@app.get("/api/quests")
def list_quests(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    rows = (
        db.query(Quest)
        .filter(Quest.user_id == user.id)
        .order_by(Quest.id.desc())
        .all()
    )
    return [serialize_quest(q, acts) for q in rows]


@app.post("/api/quests/generate")
def generate_now(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    if not session.theme:
        raise HTTPException(status_code=400, detail="Start a session with a theme first")
    payload = _run_sync(db, user, session, event_hint="quest_assigned")
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    rows = (
        db.query(Quest)
        .filter(Quest.user_id == user.id)
        .order_by(Quest.id.desc())
        .all()
    )
    return {"progress": payload, "quests": [serialize_quest(q, acts) for q in rows]}


@app.get("/api/badges")
def list_badges(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Badge)
        .filter(Badge.user_id == user.id)
        .order_by(Badge.id.desc())
        .all()
    )
    return [
        {
            "id": b.id,
            "badge_key": b.badge_key,
            "label": badge_label(b.badge_key),
            "theme": b.theme,
            "earned_at": b.earned_at,
        }
        for b in rows
    ]


@app.get("/api/mentor/message")
def mentor_message(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    if not session.mentor:
        raise HTTPException(status_code=400, detail="No mentor locked for this session")
    row = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    from backend.catalog import mentor_meta, MENTOR_LINES

    meta = mentor_meta(session.theme, session.mentor)
    lines_dict = MENTOR_LINES.get(session.mentor, {})
    quotes = [v for v in lines_dict.values() if isinstance(v, str)]
    return {
        "mentor": meta["name"],
        "mentor_id": session.mentor,
        "title": meta["title"],
        "event": row.mentor_event if row else None,
        "text": row.mentor_text if row else None,
        "quotes": quotes,
    }


@app.post("/api/login", response_model=LoginResponse)
def login(body: LoginRequest, db: DbSession = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username.strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or passcode",
        )
    token = secrets.token_hex(32)
    db.add(Session(token=token, user_id=user.id))
    db.commit()
    return LoginResponse(token=token, username=user.username)


@app.post("/api/logout")
def logout(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if creds:
        db.query(Session).filter(
            Session.token == creds.credentials,
            Session.user_id == user.id,
        ).delete()
        db.commit()
    return {"ok": True}


@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return {"username": user.username}


@app.get("/api/activities", response_model=list[ActivityOut])
def list_activities(
    q: str | None = None,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Activity)
        .filter(Activity.user_id == user.id)
        .order_by(Activity.id.desc())
        .all()
    )
    if q:
        needle = q.strip().lower()
        rows = [
            a
            for a in rows
            if needle in a.title.lower() or needle in (a.notes or "").lower()
        ]
    return rows


@app.post("/api/activities", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(
    body: ActivityCreate,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required")
    activity = Activity(
        user_id=user.id,
        title=title,
        notes=(body.notes or "").strip(),
        date=_today(),
        completed=False,
        time=None,
        priority=bool(body.priority),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    if session.theme:
        _run_sync(db, user, session, event_hint="quest_assigned", detail=activity.title)
    return activity


@app.put("/api/activities/{activity_id}", response_model=ActivityOut)
def update_activity(
    activity_id: int,
    body: ActivityUpdate,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.user_id == user.id)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required")
    activity.title = title
    activity.notes = (body.notes or "").strip()
    if body.priority is not None:
        activity.priority = bool(body.priority)
    db.commit()
    db.refresh(activity)
    if session.theme:
        _run_sync(db, user, session, event_hint="quest_assigned", detail=activity.title)
    return activity


@app.patch("/api/activities/{activity_id}/toggle", response_model=ActivityOut)
def toggle_activity(
    activity_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.user_id == user.id)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    activity.completed = not activity.completed
    activity.time = _now_time() if activity.completed else None
    db.commit()
    db.refresh(activity)
    if session.theme:
        hint = "activity_complete" if activity.completed else None
        _run_sync(db, user, session, event_hint=hint, detail=activity.title)
    return activity


@app.delete("/api/activities/{activity_id}")
def delete_activity(
    activity_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_current_session),
):
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.user_id == user.id)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.query(Quest).filter(Quest.activity_id == activity_id).delete()
    db.delete(activity)
    db.commit()
    if session.theme:
        _run_sync(db, user, session)
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(ROOT / "index.html", headers={"Cache-Control": "no-cache, must-revalidate"})


@app.get("/style.css")
def styles():
    return FileResponse(ROOT / "style.css", headers={"Cache-Control": "no-cache, must-revalidate"})


@app.get("/script.js")
def script():
    return FileResponse(ROOT / "script.js", headers={"Cache-Control": "no-cache, must-revalidate"})
