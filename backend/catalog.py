DAILY_TARGET = 3
STREAK_TARGET = 3
WEEKLY_TARGET = 5
BASE_XP = 20
STREAK_XP = 8

THEMES = {
    "onepiece": {
        "label": "One Piece",
        "mentors": {
            "zoro": {"name": "Zoro", "title": "Swordsman Guide"},
            "luffy": {"name": "Luffy", "title": "Captain Guide"},
            "rayleigh": {"name": "Rayleigh", "title": "Veteran Coach"},
        },
        "ranks": [(1, "Rookie Sailor"), (3, "Supernova"), (6, "Emperor-Class")],
        "quest": {
            "daily": "Bounty board: close {n} logs today — including '{title}'.",
            "streak": "Keep the crew's chain alive for {n} straight days.",
            "focus": "Chart a course through every log tagged '{keyword}'.",
            "weekly": "Week's voyage: finish {n} real logs before the next tide.",
            "boss": "High-seas challenge: finish '{title}' before sundown.",
        },
    },
    "bleach": {
        "label": "Bleach",
        "mentors": {
            "ichigo": {"name": "Ichigo", "title": "Substitute Guide"},
            "urahara": {"name": "Kisuke Urahara", "title": "Shopkeeper Coach"},
            "aizen": {"name": "Aizen", "title": "Tactical Observer"},
        },
        "ranks": [
            (1, "Unseated Officer"),
            (3, "Seated Officer"),
            (5, "Lieutenant"),
            (7, "Captain"),
        ],
        "quest": {
            "daily": "Duty roster: resolve {n} assignments today, starting with '{title}'.",
            "streak": "Hold spiritual discipline for {n} consecutive days.",
            "focus": "Clear every assignment sharing the mark '{keyword}'.",
            "weekly": "Weekly patrol: complete {n} assignments this week.",
            "boss": "Priority seal: finish '{title}' without delay.",
        },
    },
    "naruto": {
        "label": "Naruto",
        "mentors": {
            "naruto": {"name": "Naruto", "title": "Squad Spark"},
            "kakashi": {"name": "Kakashi", "title": "Field Instructor"},
            "guy": {"name": "Might Guy", "title": "Youth Coach"},
        },
        "ranks": [
            (1, "Academy Student"),
            (2, "Genin"),
            (4, "Chunin"),
            (6, "Jonin"),
            (8, "Kage"),
        ],
        "quest": {
            "daily": "Mission slate: wrap {n} tasks today, including '{title}'.",
            "streak": "Protect the village streak for {n} days in a row.",
            "focus": "Finish every mission mentioning '{keyword}'.",
            "weekly": "Weekly trial: complete {n} missions this week.",
            "boss": "Ranked mission: complete '{title}' — it's marked vital.",
        },
    },
    "blackclover": {
        "label": "Black Clover",
        "mentors": {
            "yami": {"name": "Yami Sukehiro", "title": "Squad Captain Guide"},
            "asta": {"name": "Asta", "title": "Training Partner"},
        },
        "ranks": [
            (1, "Junior Magic Knight"),
            (3, "Intermediate Knight"),
            (5, "Senior Knight"),
            (7, "Squad Captain"),
        ],
        "quest": {
            "daily": "Squad orders: knock out {n} duties today, including '{title}'.",
            "streak": "Don't break the grind — {n} days without a gap.",
            "focus": "Crush every duty that mentions '{keyword}'.",
            "weekly": "Weekly trial: complete {n} duties this week.",
            "boss": "Captain's mark: '{title}' is the one that matters — finish it.",
        },
    },
}

# Original lines only — tone-matched, not source dialogue.
MENTOR_LINES = {
    "zoro": {
        "login": "You picked a direction. Now walk it — the logbook doesn't fill itself.",
        "quest_assigned": "A real cut, not a pose. Handle '{detail}' like you meant it.",
        "quest_completed": "Clean finish. No extra words. Next cut is waiting.",
        "streak": "{streak} days without dropping the blade. Stay lost if you want — just don't stop.",
        "level_up": "Level {level}. Stronger grip. Don't get sloppy about it.",
        "rank_up": "New rank: {rank}. Titles are noise. The work isn't.",
    },
    "luffy": {
        "login": "Alright — crew's here. Let's knock today's logs down and eat after.",
        "quest_assigned": "That one looks fun: '{detail}'. We finish it, then we celebrate.",
        "quest_completed": "See? You did it. That's the good kind of hungry.",
        "streak": "{streak}-day streak! That's a feast of showing up.",
        "level_up": "Level {level}! You got bigger — in the useful way.",
        "rank_up": "Look at that rank: {rank}. Still the same job — help the crew finish the list.",
    },
    "rayleigh": {
        "login": "Charts are out. A quiet start still counts as a start.",
        "quest_assigned": "Pay attention to '{detail}'. Haste is how crews lose the afternoon.",
        "quest_completed": "Well done. Experience is just finished work, stacked.",
        "streak": "{streak} days. That's not luck. That's a habit wearing a grin.",
        "level_up": "Level {level}. Power without judgment is just noise. You earned this one.",
        "rank_up": "{rank} suits the work you've already done — not the work you talk about.",
    },
    "ichigo": {
        "login": "Don't overthink it. Open the list and take the first hit.",
        "quest_assigned": "'{detail}' is in front of you. Swing until it's done.",
        "quest_completed": "That's one less thing hanging over you. Good.",
        "streak": "{streak} days in a row. Stubborn beats fancy every time.",
        "level_up": "Level {level}. You got louder in the right way.",
        "rank_up": "{rank}. Wear it if you want. Just keep covering your people.",
    },
    "urahara": {
        "login": "Ah, back again. Shall we make today's pile slightly less tragic?",
        "quest_assigned": "A puzzle for you: '{detail}'. Try solving it before it solves you.",
        "quest_completed": "Neatly done. I do enjoy when a plan survives contact with effort.",
        "streak": "{streak} days. Consistency is the least theatrical magic, and the best.",
        "level_up": "Level {level}. Curious. You're becoming inconveniently capable.",
        "rank_up": "{rank}. A hat tip — purely metaphorical, of course.",
    },
    "aizen": {
        "login": "You've arrived. Order follows those who actually open the ledger.",
        "quest_assigned": "Consider '{detail}' inevitable. Completing it is simply efficient.",
        "quest_completed": "As expected. Follow-through is a kind of control.",
        "streak": "{streak} consecutive days. Pattern recognized. Continue.",
        "level_up": "Level {level}. Growth is only impressive when it is deliberate.",
        "rank_up": "{rank}. A title is a tool. Use it; don't admire it.",
    },
    "naruto": {
        "login": "We're here! Today's list doesn't stand a chance if we don't quit.",
        "quest_assigned": "Believe it or don't — '{detail}' is getting finished.",
        "quest_completed": "That's what I'm talking about! One more proof you showed up.",
        "streak": "{streak} days! That's a team that doesn't ghost the mission board.",
        "level_up": "Level {level}! Hard work looks good on you.",
        "rank_up": "{rank}! Cool title. Cooler that you earned it with actual tasks.",
    },
    "kakashi": {
        "login": "On time enough. Let's treat the list like a real briefing.",
        "quest_assigned": "'{detail}' is the assignment. Copy, complete, debrief later.",
        "quest_completed": "Solid. I'd call that a pass — no extra lecture.",
        "streak": "{streak} days. Showing up is the unglamorous jutsu that works.",
        "level_up": "Level {level}. Keep both eyes on the next objective.",
        "rank_up": "{rank}. Don't let the badge make you sloppy in the field.",
    },
    "guy": {
        "login": "YOUTH! The page is blank until we fill it with effort.",
        "quest_assigned": "Burn bright on '{detail}'. Sweat is the point.",
        "quest_completed": "YES! That finish had spirit. Take a breath — then another step.",
        "streak": "{streak} days of flame! Do not let the fire nap.",
        "level_up": "Level {level}! Power born from repetition, not shortcuts.",
        "rank_up": "{rank}! Pose optional. Persistence mandatory.",
    },
    "yami": {
        "login": "Sit down. Open the book. Magic without guts is just sparkles.",
        "quest_assigned": "'{detail}' is on you. Stop flinching and finish the thing.",
        "quest_completed": "Not bad. That's how a squad actually moves.",
        "streak": "{streak} days. Grit looks boring until it saves the week.",
        "level_up": "Level {level}. Stronger. Don't get cocky about it.",
        "rank_up": "{rank}. Congrats. Now do the next ugly job anyway.",
    },
    "asta": {
        "login": "I'm not tired yet — and neither is this list. Let's go.",
        "quest_assigned": "We'll smash '{detail}' even if it takes extra reps.",
        "quest_completed": "FINISHED! That's the feeling. Chase it again.",
        "streak": "{streak} days without quitting. That's my kind of training.",
        "level_up": "Level {level}! Hard work is the magic. Always was.",
        "rank_up": "{rank}! We earned this with sweat, not luck.",
    },
}


def validate_theme_mentor(theme: str, mentor: str) -> None:
    if theme not in THEMES:
        raise ValueError("Unknown theme")
    if mentor not in THEMES[theme]["mentors"]:
        raise ValueError("Mentor does not match theme")


def mentor_meta(theme: str, mentor: str) -> dict:
    return THEMES[theme]["mentors"][mentor]


def rank_for(theme: str, level: int) -> str:
    ranks = THEMES.get(theme, {}).get("ranks") or [(1, "Trainee")]
    current = ranks[0][1]
    for threshold, label in ranks:
        if level >= threshold:
            current = label
    return current


def flavor_quest(theme: str, quest_type: str, **kwargs) -> str:
    template = THEMES[theme]["quest"][quest_type]
    return template.format(**kwargs)


def mentor_line(mentor: str, event: str, **kwargs) -> str:
    lines = MENTOR_LINES.get(mentor, {})
    text = lines.get(event) or lines.get("quest_completed") or lines.get("login") or "Keep moving forward."
    try:
        return text.format(**kwargs)
    except Exception:
        return text
