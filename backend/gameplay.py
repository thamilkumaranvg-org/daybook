from collections import Counter
from datetime import date, datetime, timedelta
import re

from sqlalchemy.orm import Session as DbSession

from backend.catalog import (
    BASE_XP,
    DAILY_TARGET,
    STREAK_TARGET,
    STREAK_XP,
    WEEKLY_TARGET,
    flavor_quest,
    mentor_line,
    mentor_meta,
    rank_for,
)
from backend.models import Activity, Badge, Quest, User, UserProgress

STOPWORDS = {
    "about", "after", "check", "from", "have", "include", "just", "that",
    "this", "with", "your", "the", "and", "for", "are", "was", "were",
}


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat(sep=" ")


def today_key() -> str:
    return date.today().isoformat()


def week_start_key() -> str:
    today = date.today()
    return (today - timedelta(days=today.weekday())).isoformat()


def compute_streak(activities: list[Activity]) -> int:
    completed_dates = {a.date for a in activities if a.completed}
    cursor = date.today()
    if cursor.isoformat() not in completed_dates:
        cursor = cursor - timedelta(days=1)
    streak = 0
    while cursor.isoformat() in completed_dates:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def xp_total(completed_count: int, streak: int) -> int:
    return completed_count * BASE_XP + streak * STREAK_XP


def level_from_xp(xp: int) -> tuple[int, int, int]:
    """Return level, xp into current level, xp needed for next level."""
    level = 1
    remaining = max(0, xp)
    need = 60
    while remaining >= need:
        remaining -= need
        level += 1
        need = 60 + (level - 1) * 35
    return level, remaining, need


def ensure_progress(db: DbSession, user: User) -> UserProgress:
    row = db.query(UserProgress).filter(UserProgress.user_id == user.id).first()
    if not row:
        row = UserProgress(user_id=user.id, xp=0, level=1, streak_cached=0)
        db.add(row)
        db.flush()
    return row


def set_mentor_message(progress: UserProgress, mentor: str, event: str, **kwargs) -> str:
    text = mentor_line(mentor, event, **kwargs)
    progress.mentor_event = event
    progress.mentor_text = text
    return text


def award_badge(db: DbSession, user_id: int, key: str, theme: str) -> bool:
    exists = (
        db.query(Badge)
        .filter(Badge.user_id == user_id, Badge.badge_key == key)
        .first()
    )
    if exists:
        return False
    db.add(Badge(user_id=user_id, badge_key=key, theme=theme, earned_at=now_iso()))
    return True


def _titles_today(acts: list[Activity]) -> str:
    todays = [a.title for a in acts if a.date == today_key()]
    return todays[0] if todays else "today's log"


def generate_quests(db: DbSession, user: User, theme: str) -> list[Quest]:
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    created: list[Quest] = []
    today = today_key()
    week_start = week_start_key()

    def has_active(qtype: str, activity_id=None, keyword=None) -> bool:
        q = db.query(Quest).filter(
            Quest.user_id == user.id,
            Quest.quest_type == qtype,
            Quest.status == "active",
        )
        rows = q.all()
        if activity_id is not None:
            return any(r.activity_id == activity_id for r in rows)
        if keyword is not None:
            return any(keyword.lower() in r.title_text.lower() for r in rows)
        if qtype == "daily":
            return any(r.created_at.startswith(today) for r in rows)
        if qtype == "weekly":
            return any((r.created_at or "")[:10] >= week_start for r in rows)
        return len(rows) > 0

    def add(qtype: str, title_text: str, activity_id=None):
        quest = Quest(
            user_id=user.id,
            activity_id=activity_id,
            quest_type=qtype,
            theme=theme,
            title_text=title_text,
            status="active",
            created_at=now_iso(),
            completed_at=None,
        )
        db.add(quest)
        created.append(quest)

    todays = [a for a in acts if a.date == today]
    if todays and not has_active("daily") and not _completed_today(db, user.id, "daily"):
        add(
            "daily",
            flavor_quest(theme, "daily", n=DAILY_TARGET, title=_titles_today(acts)),
        )

    streak = compute_streak(acts)
    if streak >= 1 and not has_active("streak") and not _completed_today(db, user.id, "streak"):
        add("streak", flavor_quest(theme, "streak", n=STREAK_TARGET, title=_titles_today(acts)))

    week_acts = [a for a in acts if a.date >= week_start]
    if week_acts and not has_active("weekly") and not _completed_this_week(db, user.id, "weekly"):
        add(
            "weekly",
            flavor_quest(theme, "weekly", n=WEEKLY_TARGET, title=_titles_today(acts)),
        )

    keyword = _focus_keyword(acts)
    if keyword and not has_active("focus", keyword=keyword):
        add(
            "focus",
            flavor_quest(theme, "focus", keyword=keyword, n=1, title=keyword),
        )

    for act in acts:
        if act.priority and not act.completed and not has_active("boss", activity_id=act.id):
            add(
                "boss",
                flavor_quest(theme, "boss", title=act.title, n=1),
                activity_id=act.id,
            )

    db.flush()
    return created


def _completed_today(db: DbSession, user_id: int, qtype: str) -> bool:
    today = today_key()
    rows = (
        db.query(Quest)
        .filter(Quest.user_id == user_id, Quest.quest_type == qtype, Quest.status == "completed")
        .all()
    )
    return any((r.completed_at or "").startswith(today) for r in rows)


def _completed_this_week(db: DbSession, user_id: int, qtype: str) -> bool:
    week_start = week_start_key()
    rows = (
        db.query(Quest)
        .filter(Quest.user_id == user_id, Quest.quest_type == qtype, Quest.status == "completed")
        .all()
    )
    return any((r.completed_at or "")[:10] >= week_start for r in rows)


def _focus_keyword(acts: list[Activity]) -> str | None:
    words: list[str] = []
    for a in acts:
        blob = f"{a.title} {a.notes}".lower()
        words.extend(re.findall(r"[a-z]{4,}", blob))
    counted = Counter(w for w in words if w not in STOPWORDS)
    for word, n in counted.most_common():
        if n >= 2:
            return word
    return None


def quest_progress(quest: Quest, acts: list[Activity]) -> tuple[int, int]:
    today = today_key()
    week_start = week_start_key()
    if quest.quest_type == "daily":
        done = sum(1 for a in acts if a.date == today and a.completed)
        return min(done, DAILY_TARGET), DAILY_TARGET
    if quest.quest_type == "streak":
        return min(compute_streak(acts), STREAK_TARGET), STREAK_TARGET
    if quest.quest_type == "weekly":
        done = sum(1 for a in acts if a.date >= week_start and a.completed)
        return min(done, WEEKLY_TARGET), WEEKLY_TARGET
    if quest.quest_type == "focus":
        match = re.search(r"'([^']+)'", quest.title_text)
        keyword = (match.group(1) if match else "").lower()
        group = [a for a in acts if keyword and keyword in f"{a.title} {a.notes}".lower()]
        done = sum(1 for a in group if a.completed)
        return done, max(len(group), 1)
    if quest.quest_type == "boss":
        target = next((a for a in acts if a.id == quest.activity_id), None)
        return (1, 1) if target and target.completed else (0, 1)
    return 0, 1


def complete_ready_quests(db: DbSession, user: User) -> list[Quest]:
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    newly: list[Quest] = []
    active = (
        db.query(Quest)
        .filter(Quest.user_id == user.id, Quest.status == "active")
        .all()
    )
    for quest in active:
        current, target = quest_progress(quest, acts)
        if target > 0 and current >= target:
            quest.status = "completed"
            quest.completed_at = now_iso()
            newly.append(quest)
    return newly


def sync_progress(
    db: DbSession,
    user: User,
    theme: str | None,
    mentor: str | None,
    event_hint: str | None = None,
    detail: str = "",
) -> dict:
    progress = ensure_progress(db, user)
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    streak = compute_streak(acts)
    completed_count = sum(1 for a in acts if a.completed)
    xp = xp_total(completed_count, streak)
    old_level = progress.level
    old_rank = rank_for(progress.theme or theme or "onepiece", old_level) if (progress.theme or theme) else ""
    level, into, need = level_from_xp(xp)

    progress.xp = xp
    progress.level = level
    progress.streak_cached = streak
    if theme:
        progress.theme = theme
    if mentor:
        progress.mentor = mentor

    locked_theme = progress.theme
    locked_mentor = progress.mentor
    new_rank = rank_for(locked_theme, level) if locked_theme else ""

    events: list[str] = []
    if event_hint:
        events.append(event_hint)
    if level > old_level:
        events.append("level_up")
    if locked_theme and new_rank != old_rank and old_rank:
        events.append("rank_up")
        award_badge(db, user.id, f"rank:{new_rank}", locked_theme)
    if locked_theme:
        if xp >= 100:
            award_badge(db, user.id, "xp:100", locked_theme)
        if xp >= 250:
            award_badge(db, user.id, "xp:250", locked_theme)
        if xp >= 500:
            award_badge(db, user.id, "xp:500", locked_theme)
        if streak >= 3:
            award_badge(db, user.id, "streak:3", locked_theme)
        if streak >= 7:
            award_badge(db, user.id, "streak:7", locked_theme)

    assigned: list[Quest] = []
    completed_quests: list[Quest] = []
    if locked_theme:
        assigned = generate_quests(db, user, locked_theme)
        completed_quests = complete_ready_quests(db, user)
        if assigned:
            events.append("quest_assigned")
        if completed_quests:
            events.append("quest_completed")
        if streak in (3, 7, 14) and event_hint in ("activity_complete", "login"):
            events.append("streak")

    mentor_text = None
    mentor_event = None
    if locked_mentor and events:
        priority = [
            "rank_up",
            "level_up",
            "streak",
            "quest_completed",
            "quest_assigned",
            "login",
        ]
        chosen = next((e for e in priority if e in events), events[-1])
        meta_detail = detail
        if chosen == "quest_assigned" and assigned:
            meta_detail = assigned[0].title_text
        if chosen == "quest_completed" and completed_quests:
            meta_detail = completed_quests[0].title_text
        mentor_text = set_mentor_message(
            progress,
            locked_mentor,
            chosen,
            detail=meta_detail or "the next log",
            streak=streak,
            level=level,
            rank=new_rank or "Trainee",
        )
        mentor_event = chosen

    db.commit()
    db.refresh(progress)

    meta = mentor_meta(locked_theme, locked_mentor) if locked_theme and locked_mentor else None
    return {
        "xp": xp,
        "xp_into_level": into,
        "xp_for_next": need,
        "level": level,
        "rank": new_rank,
        "streak": streak,
        "theme": locked_theme,
        "mentor": locked_mentor,
        "mentor_name": meta["name"] if meta else None,
        "mentor_title": meta["title"] if meta else None,
        "mentor_event": mentor_event or progress.mentor_event,
        "mentor_text": mentor_text or progress.mentor_text,
        "rank_up": "rank_up" in events,
        "level_up": "level_up" in events,
        "assigned_count": len(assigned),
        "completed_quest_count": len(completed_quests),
    }


def snapshot_progress(db: DbSession, user: User, theme: str | None, mentor: str | None) -> dict:
    """Read-only snapshot. Does not generate quests or rewrite mentor lines."""
    progress = ensure_progress(db, user)
    acts = db.query(Activity).filter(Activity.user_id == user.id).all()
    streak = compute_streak(acts)
    completed_count = sum(1 for a in acts if a.completed)
    xp = xp_total(completed_count, streak)
    level, into, need = level_from_xp(xp)
    progress.xp = xp
    progress.level = level
    progress.streak_cached = streak
    locked_theme = theme or progress.theme
    locked_mentor = mentor or progress.mentor
    db.commit()
    meta = mentor_meta(locked_theme, locked_mentor) if locked_theme and locked_mentor else None
    return {
        "xp": xp,
        "xp_into_level": into,
        "xp_for_next": need,
        "level": level,
        "rank": rank_for(locked_theme, level) if locked_theme else None,
        "streak": streak,
        "theme": locked_theme,
        "mentor": locked_mentor,
        "mentor_name": meta["name"] if meta else None,
        "mentor_title": meta["title"] if meta else None,
        "mentor_event": progress.mentor_event,
        "mentor_text": progress.mentor_text,
        "rank_up": False,
        "level_up": False,
        "assigned_count": 0,
        "completed_quest_count": 0,
    }


def serialize_quest(quest: Quest, acts: list[Activity]) -> dict:
    current, target = quest_progress(quest, acts)
    return {
        "id": quest.id,
        "activity_id": quest.activity_id,
        "quest_type": quest.quest_type,
        "theme": quest.theme,
        "title_text": quest.title_text,
        "status": quest.status,
        "created_at": quest.created_at,
        "completed_at": quest.completed_at,
        "current": current,
        "target": target,
        "progress": 0 if target == 0 else round(100 * current / target),
    }


def badge_label(key: str) -> str:
    if key.startswith("rank:"):
        return f"Rank unlocked: {key.split(':', 1)[1]}"
    labels = {
        "xp:100": "100 XP milestone",
        "xp:250": "250 XP milestone",
        "xp:500": "500 XP milestone",
        "streak:3": "3-day streak",
        "streak:7": "7-day streak",
    }
    return labels.get(key, key)
