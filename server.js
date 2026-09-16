import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================================
// CATALOG DATA & CONFIGURATION
// ============================================================================

const DAILY_TARGET = 3;
const STREAK_TARGET = 3;
const WEEKLY_TARGET = 5;
const BASE_XP = 20;
const STREAK_XP = 8;
const INCOMPLETE_PENALTY_XP = 15;

const THEMES = {
  onepiece: {
    label: "One Piece",
    mentors: {
      zoro: { name: "Zoro", title: "Swordsman Guide" },
      luffy: { name: "Luffy", title: "Captain Guide" },
      rayleigh: { name: "Rayleigh", title: "Veteran Coach" },
    },
    ranks: [
      [1, "Rookie Sailor"],
      [3, "Supernova"],
      [6, "Emperor-Class"],
    ],
    quest: {
      daily: "Bounty board: close {n} logs today — including '{title}'.",
      days_logged: "Log Pose: Log real activities across {n} distinct sailing days.",
      speed_blitz: "Swift Blade: Complete an activity in under 60 minutes from logging it.",
      clean_sweep: "Deck Cleared: Finish all scheduled logs today with zero unfinished tasks.",
      morning_spark: "Dawn Anchor: Complete your first log before midday sun (12:00 PM).",
      streak: "Keep the crew's chain alive for {n} straight days.",
      focus: "Chart a course through every log tagged '{keyword}'.",
      weekly: "Week's voyage: finish {n} real logs before the next tide.",
      boss: "High-seas challenge: finish '{title}' before sundown.",
    },
  },
  bleach: {
    label: "Bleach",
    mentors: {
      ichigo: { name: "Ichigo", title: "Substitute Guide" },
      urahara: { name: "Kisuke Urahara", title: "Shopkeeper Coach" },
      aizen: { name: "Aizen", title: "Tactical Observer" },
    },
    ranks: [
      [1, "Unseated Officer"],
      [3, "Seated Officer"],
      [5, "Lieutenant"],
      [7, "Captain"],
    ],
    quest: {
      daily: "Duty roster: resolve {n} assignments today, starting with '{title}'.",
      days_logged: "Shinigami Patrol: Check in and file assignments across {n} distinct duty days.",
      speed_blitz: "Flash Step (Shunpo): Resolve a duty within 60 minutes of noting it down.",
      clean_sweep: "Roster Purge: Resolve every spiritual assignment on today's roster with 0 remaining.",
      morning_spark: "Morning Gate: Resolve a spiritual disturbance before noon (12:00 PM).",
      streak: "Hold spiritual discipline for {n} consecutive days.",
      focus: "Clear every assignment sharing the mark '{keyword}'.",
      weekly: "Weekly patrol: complete {n} assignments this week.",
      boss: "Priority seal: finish '{title}' without delay.",
    },
  },
  naruto: {
    label: "Naruto",
    mentors: {
      naruto: { name: "Naruto", title: "Squad Spark" },
      kakashi: { name: "Kakashi", title: "Field Instructor" },
      guy: { name: "Might Guy", title: "Youth Coach" },
    },
    ranks: [
      [1, "Academy Student"],
      [2, "Genin"],
      [4, "Chunin"],
      [6, "Jonin"],
      [8, "Hokage"],
    ],
    quest: {
      daily: "Mission slate: wrap {n} tasks today, including '{title}'.",
      days_logged: "Shinobi Service: File mission logs across {n} active days.",
      speed_blitz: "Flying Raijin: Wrap up a mission in under 60 minutes from assignment.",
      clean_sweep: "Flawless Operation: Finish all today's missions with zero pending tasks left.",
      morning_spark: "Morning Jutsu: Finish a mission before noon bells (12:00 PM).",
      streak: "Protect the village streak for {n} days in a row.",
      focus: "Finish every mission mentioning '{keyword}'.",
      weekly: "Weekly trial: complete {n} missions this week.",
      boss: "Ranked mission: complete '{title}' — it's marked vital.",
    },
  },
  blackclover: {
    label: "Black Clover",
    mentors: {
      yami: { name: "Yami Sukehiro", title: "Squad Captain Guide" },
      asta: { name: "Asta", title: "Training Partner" },
    },
    ranks: [
      [1, "Junior Magic Knight"],
      [3, "Intermediate Knight"],
      [5, "Senior Knight"],
      [7, "Squad Captain"],
      [9, "Wizard King"],
    ],
    quest: {
      daily: "Squad orders: knock out {n} duties today, including '{title}'.",
      days_logged: "Knight's Grimoire: Inscribe squad duties across {n} distinct service days.",
      speed_blitz: "Black Dash: Smash an assignment in under 60 minutes from start.",
      clean_sweep: "Clean Slate: Wipe out every squad order today — nothing left behind.",
      morning_spark: "Sunrise Strike: Finish a squad duty before midday (12:00 PM).",
      streak: "Don't break the grind — {n} days without a gap.",
      focus: "Crush every duty that mentions '{keyword}'.",
      weekly: "Weekly trial: complete {n} duties this week.",
      boss: "Captain's mark: '{title}' is the one that matters — finish it.",
    },
  },
};

const MENTOR_LINES = {
  zoro: {
    login: "You picked a direction. Now walk it — the logbook doesn't fill itself.",
    none_logged: "Your logbook is blank today. Add your first cut and let's get moving.",
    all_pending: "You've got {total} tasks in front of you. Stop staring and make the first strike.",
    in_progress: "Good cut. {done} down, {remaining} to go. Keep your stance and press forward.",
    all_completed: "All {total} tasks cleared today. Sharp and disciplined. Rest your blade.",
    evening_urgent: "Night's falling and {remaining} tasks remain. Move before midnight snaps our streak.",
    activity_completed: "Clean finish on '{title}'. No wasted motion. Next cut is waiting.",
    penalty_streak_break: "We took a hit on yesterday's incomplete work (-{penalty} XP) and lost the streak. Don't look back — draw your blade and clear today's slate.",
    quest_assigned: "A real cut, not a pose. Handle '{detail}' like you meant it.",
    quest_completed: "Clean finish. No extra words. Next cut is waiting.",
    streak: "{streak} days without dropping the blade. Stay lost if you want — just don't stop.",
    level_up: "Level {level}. Stronger grip. Don't get sloppy about it.",
    rank_up: "New rank: {rank}. Titles are noise. The work isn't.",
  },
  luffy: {
    login: "Alright — crew's here! Let's knock today's logs down and feast after!",
    none_logged: "Nothing written down yet! What's our first adventure for today? Let's add it!",
    all_pending: "We've got {total} things to do! Let's blast through the first one right now!",
    in_progress: "Yahoo! {done} finished! Only {remaining} left and today's victory is ours!",
    all_completed: "SHISHISHI! Every single task is done! Victory feast time!",
    evening_urgent: "Hey! Night is coming and we still have {remaining} tasks left! Don't let our streak burn out!",
    activity_completed: "Awesome! '{title}' is DONE! Let's keep this momentum going!",
    penalty_streak_break: "Gah, we left tasks unfinished yesterday and lost {penalty} XP! But we're not giving up — let's win our streak back today!",
    quest_assigned: "That one looks fun: '{detail}'. We finish it, then we celebrate.",
    quest_completed: "See? You did it! That's the good kind of hungry.",
    streak: "{streak}-day streak! That's a feast of showing up.",
    level_up: "Level {level}! You got bigger — in the useful way!",
    rank_up: "Look at that rank: {rank}! Still the same job — help the crew finish the list!",
  },
  rayleigh: {
    login: "Charts are out. A quiet start still counts as a start.",
    none_logged: "The waters are calm this morning. Chart your first objective for the day.",
    all_pending: "A voyage begins with a single reef passed. Focus entirely on your first task.",
    in_progress: "{done} logs secured, {remaining} remaining. A steady pace is the mark of a veteran.",
    all_completed: "Every log resolved with clean precision. You commanded today's voyage masterfully.",
    evening_urgent: "The tide turns as night arrives. Clear those {remaining} logs to protect your chain.",
    activity_completed: "Well navigated on '{title}'. Experience builds with every completed task.",
    penalty_streak_break: "An incomplete log yesterday cost us {penalty} XP. Experience teaches through stumbles; steady your footing and begin again.",
    quest_assigned: "Pay attention to '{detail}'. Haste is how crews lose the afternoon.",
    quest_completed: "Well done. Experience is just finished work, stacked.",
    streak: "{streak} days. That's not luck. That's a habit wearing a grin.",
    level_up: "Level {level}. Power without judgment is just noise. You earned this one.",
    rank_up: "{rank} suits the work you've already done — not the work you talk about.",
  },
  ichigo: {
    login: "Don't overthink it. Open the list and take the first hit.",
    none_logged: "The duty sheet is empty. Put down your first assignment and let's handle it.",
    all_pending: "All {total} assignments are waiting. Stop hesitating and take the first swing.",
    in_progress: "{done} down. Keep your grip firm and finish the remaining {remaining} before they pile up.",
    all_completed: "Everything on today's sheet is cleared. Clean slate. You earned your peace tonight.",
    evening_urgent: "It's late and you've got {remaining} tasks hanging over your head. Finish them before midnight.",
    activity_completed: "That's '{title}' cleared. One less burden on your shoulders.",
    penalty_streak_break: "We slipped up yesterday and took a {penalty} XP deduction. Stop dwelling on it — focus on today's assignments.",
    quest_assigned: "'{detail}' is in front of you. Swing until it's done.",
    quest_completed: "That's one less thing hanging over you. Good.",
    streak: "{streak} days in a row. Stubborn beats fancy every time.",
    level_up: "Level {level}. You got louder in the right way.",
    rank_up: "{rank}. Wear it if you want. Just keep covering your people.",
  },
  urahara: {
    login: "Ah, back again. Shall we make today's pile slightly less tragic?",
    none_logged: "No plans noted down yet? Even a small task is better than idling away the morning.",
    all_pending: "All {total} tasks remain untouched. May I suggest starting before time decides for you?",
    in_progress: "{done} cleared, {remaining} to go. The momentum looks promising; do maintain it.",
    all_completed: "Remarkable. 100% completion with zero debt. Even I have nothing to criticize.",
    evening_urgent: "The clock is ticking toward midnight. {remaining} tasks left — or tomorrow brings an unpleasant XP penalty.",
    activity_completed: "Delightful execution on '{title}'. Progress without drama is my favorite kind.",
    penalty_streak_break: "My, an incomplete day has reduced our XP by {penalty} and reset the chain. A pity, but a clean slate is an opportunity.",
    quest_assigned: "A puzzle for you: '{detail}'. Try solving it before it solves you.",
    quest_completed: "Neatly done. I do enjoy when a plan survives contact with effort.",
    streak: "{streak} days. Consistency is the least theatrical magic, and the best.",
    level_up: "Level {level}. Curious. You're becoming inconveniently capable.",
    rank_up: "{rank}. A hat tip — purely metaphorical, of course.",
  },
  aizen: {
    login: "You've arrived. Order follows those who actually open the ledger.",
    none_logged: "A blank ledger is an unguided mind. Register your primary objective.",
    all_pending: "{total} items awaiting execution. Hesitation produces no results; begin.",
    in_progress: "{done} resolved. {remaining} left. Maintain efficiency until the final record is closed.",
    all_completed: "Total execution achieved. Every task completed as intended. Flawless control.",
    evening_urgent: "Time is expiring. {remaining} incomplete duties will compromise your streak. Eliminate them swiftly.",
    activity_completed: "'{title}' eliminated according to schedule. As it should be.",
    penalty_streak_break: "Unfinished duties yesterday yielded predictable setbacks (-{penalty} XP). Correct your discipline today; follow-through is mandatory.",
    quest_assigned: "Consider '{detail}' inevitable. Completing it is simply efficient.",
    quest_completed: "As expected. Follow-through is a kind of control.",
    streak: "{streak} consecutive days. Pattern recognized. Continue.",
    level_up: "Level {level}. Growth is only impressive when it is deliberate.",
    rank_up: "{rank}. A title is a tool. Use it; don't admire it.",
  },
  naruto: {
    login: "We're here! Today's list doesn't stand a chance if we don't quit!",
    none_logged: "Hey! The mission board is empty! Add your tasks so we can crush them!",
    all_pending: "{total} missions waiting! Pick number one and let's do this, dattebayo!",
    in_progress: "{done} down! Only {remaining} left! We're on a roll, let's blast through the rest!",
    all_completed: "BELIEVE IT! Every single mission cleared today! That's true ninja discipline!",
    evening_urgent: "It's almost bedtime and we still have {remaining} missions! Hustle up so our streak doesn't drop!",
    activity_completed: "Yeah! We nailed '{title}'! Keep that chakra flowing!",
    penalty_streak_break: "Our streak broke and we lost {penalty} XP from yesterday! But ninjas never give up — let's hustle and rebuild it right now!",
    quest_assigned: "Believe it or don't — '{detail}' is getting finished.",
    quest_completed: "That's what I'm talking about! One more proof you showed up.",
    streak: "{streak} days! That's a team that doesn't ghost the mission board.",
    level_up: "Level {level}! Hard work looks good on you.",
    rank_up: "{rank}! Cool title. Cooler that you earned it with actual tasks.",
  },
  kakashi: {
    login: "On time enough. Let's treat the list like a real briefing.",
    none_logged: "Blank roster. Write down your mission plan before you head into the field.",
    all_pending: "{total} objectives pending. Identify the highest priority and move out.",
    in_progress: "{done} objectives secured. {remaining} in play. Maintain perimeter focus.",
    all_completed: "Mission accomplished across the board. Exemplary field discipline. Debrief complete.",
    evening_urgent: "Evening briefing: {remaining} objectives unfinished. Wrap them up before end of day.",
    activity_completed: "'{title}' logged as complete. Good tactical execution.",
    penalty_streak_break: "Mission failure yesterday cost us {penalty} XP. Review the errors, adjust your pace, and let's execute today properly.",
    quest_assigned: "'{detail}' is the assignment. Copy, complete, debrief later.",
    quest_completed: "Solid. I'd call that a pass — no extra lecture.",
    streak: "{streak} days. Showing up is the unglamorous jutsu that works.",
    level_up: "Level {level}. Keep both eyes on the next objective.",
    rank_up: "{rank}. Don't let the badge make you sloppy in the field.",
  },
  guy: {
    login: "YOUTH! The page is blank until we fill it with effort!",
    none_logged: "THE MORNING CALLS! Register your youth workout goals immediately!",
    all_pending: "{total} challenges standing before you! Attack the first one with the power of youth!",
    in_progress: "SPLENDID! {done} victories won, {remaining} trials left! PUSH TO MAXIMUM YOUTH!",
    all_completed: "TEARS OF YOUTH! You conquered every single trial today! A dazzling victory!",
    evening_urgent: "THE MIDNIGHT FLAME IS THREATENED! Burn your brightest to clear those {remaining} duties before 10 PM!",
    activity_completed: "DYNAMIC FINISH on '{title}'! Feel the youth coursing through your veins!",
    penalty_streak_break: "THE FLAME OF YOUTH NEVER DIES! Yesterday had gaps and cost us {penalty} XP, but today we burn hotter than ever! Let's conquer the board!",
    quest_assigned: "Burn bright on '{detail}'. Sweat is the point.",
    quest_completed: "YES! That finish had spirit. Take a breath — then another step.",
    streak: "{streak} days of flame! Do not let the fire nap.",
    level_up: "Level {level}! Power born from repetition, not shortcuts.",
    rank_up: "{rank}! Pose optional. Persistence mandatory.",
  },
  yami: {
    login: "Sit down. Open the book. Magic without guts is just sparkles.",
    none_logged: "Page is empty. Don't make me kick you into gear — write your duties down.",
    all_pending: "{total} tasks sitting there doing nothing. Get off your ass and finish the first one.",
    in_progress: "{done} done. Don't start celebrating early — you still have {remaining} jobs. Push past your limits!",
    all_completed: "Look at that — you actually finished all of them. Not bad, kid. That's what a Black Bull does.",
    evening_urgent: "It's late. Stop hesitating and finish the remaining {remaining} tasks before your streak dies.",
    activity_completed: "Crushed '{title}'. That's how it's done. On to the next.",
    penalty_streak_break: "You left yesterday's work half-baked and lost {penalty} XP. Stop slacking, push past your limits, and finish today's jobs.",
    quest_assigned: "'{detail}' is on you. Stop flinching and finish the thing.",
    quest_completed: "Not bad. That's how a squad actually moves.",
    streak: "{streak} days. Grit looks boring until it saves the week.",
    level_up: "Level {level}. Stronger. Don't get cocky about it.",
    rank_up: "{rank}. Congrats. Now do the next ugly job anyway.",
  },
  asta: {
    login: "I'm not tired yet — and neither is this list. Let's go!",
    none_logged: "Zero missions?! Let's add some! I'm ready to train all day!",
    all_pending: "{total} duties on the board! I'm tackling the first one right now with full power!",
    in_progress: "{done} conquered! Just {remaining} more! I'm not tired at all, let's keep going!",
    all_completed: "WE DID IT! ALL {total} COMPLETED! Hard work never betrays! Best feeling in the world!",
    evening_urgent: "The clock is running out! I'm not letting our streak break tonight! Let's crush those {remaining} tasks!",
    activity_completed: "'{title}' IS FINISHED! I never give up, and neither did you!",
    penalty_streak_break: "We lost {penalty} XP yesterday?! NOT YET! I'm gonna work ten times harder today to earn it all back! Let's go!",
    quest_assigned: "We'll smash '{detail}' even if it takes extra reps.",
    quest_completed: "FINISHED! That's the feeling. Chase it again.",
    streak: "{streak} days without quitting. That's my kind of training.",
    level_up: "Level {level}! Hard work is the magic. Always was.",
    rank_up: "{rank}! We earned this with sweat, not luck.",
  },
};

const STOPWORDS = new Set([
  "about", "after", "check", "from", "have", "include", "just", "that",
  "this", "with", "your", "the", "and", "for", "are", "was", "were",
]);

function validateThemeMentor(theme, mentor) {
  if (!THEMES[theme]) {
    throw new Error("Unknown theme");
  }
  if (!THEMES[theme].mentors[mentor]) {
    throw new Error("Mentor does not match theme");
  }
}

function mentorMeta(theme, mentor) {
  return THEMES[theme]?.mentors[mentor] || null;
}

function rankFor(theme, level) {
  const ranks = THEMES[theme]?.ranks || [[1, "Trainee"]];
  let current = ranks[0][1];
  for (const [threshold, label] of ranks) {
    if (level >= threshold) {
      current = label;
    }
  }
  return current;
}

function formatString(template, vars) {
  return template.replace(/{(\w+)}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
}

function flavorQuest(theme, questType, vars = {}) {
  const template = THEMES[theme]?.quest[questType] || "";
  return formatString(template, vars);
}

function mentorLine(mentor, event, vars = {}) {
  const lines = MENTOR_LINES[mentor] || MENTOR_LINES.zoro;
  const text = lines[event] || lines["quest_completed"] || lines["login"] || "Keep moving forward.";
  return formatString(text, vars);
}

function badgeLabel(key) {
  if (key.startsWith("rank:")) {
    return `Rank unlocked: ${key.slice(5)}`;
  }
  const labels = {
    "xp:100": "100 XP milestone",
    "xp:250": "250 XP milestone",
    "xp:500": "500 XP milestone",
    "streak:3": "3-day streak",
    "streak:7": "7-day streak",
    "sweep:first": "Clean Sweep Champion",
    "speed:first": "Speed Blitz Runner",
  };
  return labels[key] || key;
}

// ============================================================================
// DATE & TIME HELPERS
// ============================================================================

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return formatDate(new Date());
}

function weekStartKey(referenceDateStr) {
  const d = referenceDateStr ? new Date(referenceDateStr + "T00:00:00") : new Date();
  const day = d.getDay();
  // Monday as week start (day 1), Sunday is 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return formatDate(monday);
}

function nowIso() {
  return new Date().toISOString();
}

function nowTime() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes} ${ampm}`;
}

// ============================================================================
// PERSISTENCE LAYER (Zero-default / User-only activities)
// ============================================================================
// STORAGE & DATABASE PERSISTENCE LAYER (SUPABASE POSTGRESQL & FALLBACK)
// ============================================================================
// Unified database operations are abstracted in ./db.js (Supabase / PG / Local)


// ============================================================================
// GAMEPLAY LOGIC & STREAK / PENALTY
// ============================================================================

function computeStreakAndPenalty(acts, clientToday) {
  const pastActs = acts.filter((a) => a.date < clientToday);
  const incompletePast = pastActs.filter((a) => !a.completed);
  const penaltyXp = incompletePast.length * INCOMPLETE_PENALTY_XP;

  // Group activities by date
  const dateMap = new Map();
  for (const a of acts) {
    if (!dateMap.has(a.date)) dateMap.set(a.date, []);
    dateMap.get(a.date).push(a);
  }

  // Streak logic:
  // Consecutive calendar days where every logged activity was completed.
  // If a past day had incomplete activities, that broke the streak on that day!
  let streak = 0;
  const todayActs = dateMap.get(clientToday) || [];
  const todayCompleted = todayActs.filter((a) => a.completed).length;

  // If today has tasks, all are done, and at least 1 is done, today counts
  if (todayCompleted > 0 && todayActs.every((a) => a.completed)) {
    streak++;
  }

  // Count backwards from yesterday
  const cursor = new Date(clientToday + "T00:00:00");
  cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const dStr = formatDate(cursor);
    const dayTasks = dateMap.get(dStr);
    if (!dayTasks || dayTasks.length === 0) {
      // Inactive day breaks streak
      break;
    }
    if (dayTasks.some((a) => !a.completed)) {
      // Incomplete day breaks streak
      break;
    }
    // Fully completed active day
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const streakBroken = incompletePast.length > 0;

  return {
    streak,
    penaltyXp,
    incompletePastCount: incompletePast.length,
    streakBroken,
    incompletePastDates: Array.from(new Set(incompletePast.map((a) => a.date))),
  };
}

function levelFromXp(xp) {
  let level = 1;
  let remaining = Math.max(0, xp);
  let need = 60;
  while (remaining >= need) {
    remaining -= need;
    level++;
    need = 60 + (level - 1) * 35;
  }
  return { level, into: remaining, need };
}

async function ensureProgress(userId) {
  let progress = await db.getUserProgress(userId);
  if (!progress) {
    progress = {
      userId,
      xp: 0,
      level: 1,
      theme: null,
      mentor: null,
      streakCached: 0,
      mentorEvent: null,
      mentorText: null,
    };
    await db.saveUserProgress(userId, progress);
  }
  return progress;
}

async function awardBadge(userId, key, theme, currentBadges = []) {
  const exists = currentBadges.some((b) => b.badgeKey === key);
  if (exists) return false;
  const created = await db.createBadge({
    userId,
    badgeKey: key,
    theme,
  });
  currentBadges.push(created);
  return true;
}

function titlesToday(acts, clientToday) {
  const todays = acts.filter((a) => a.date === clientToday).map((a) => a.title);
  return todays[0] || "today's log";
}

function focusKeyword(acts) {
  const words = [];
  for (const a of acts) {
    const blob = `${a.title} ${a.notes}`.toLowerCase();
    const matches = blob.match(/[a-z]{4,}/g) || [];
    words.push(...matches);
  }
  const counts = new Map();
  for (const w of words) {
    if (!STOPWORDS.has(w)) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  for (const [word, n] of counts.entries()) {
    if (n >= 2) return word;
  }
  return null;
}

function questProgress(quest, acts, clientToday) {
  const weekStart = weekStartKey(clientToday);
  const todays = acts.filter((a) => a.date === clientToday);

  if (quest.questType === "daily") {
    const done = todays.filter((a) => a.completed).length;
    return [Math.min(done, DAILY_TARGET), DAILY_TARGET];
  }
  if (quest.questType === "days_logged") {
    const distinctDays = new Set(acts.map((a) => a.date)).size;
    const target = quest.target || 3;
    return [Math.min(distinctDays, target), target];
  }
  if (quest.questType === "speed_blitz") {
    const fastDone = todays.filter((a) => {
      if (!a.completed || !a.createdAt || !a.completedAt) return false;
      const diffMs = new Date(a.completedAt).getTime() - new Date(a.createdAt).getTime();
      return diffMs >= 0 && diffMs <= 60 * 60 * 1000;
    }).length;
    return [Math.min(fastDone, 1), 1];
  }
  if (quest.questType === "clean_sweep") {
    const done = todays.filter((a) => a.completed).length;
    const isSweep = todays.length >= 2 && done === todays.length;
    return [isSweep ? 1 : 0, 1];
  }
  if (quest.questType === "morning_spark") {
    const morningDone = todays.filter((a) => {
      if (!a.completed) return false;
      if (a.completedAt) {
        const h = new Date(a.completedAt).getHours();
        return h < 12;
      }
      return a.time && (a.time.includes("AM") || (a.time.startsWith("12:") && a.time.includes("PM")));
    }).length;
    return [Math.min(morningDone, 1), 1];
  }
  if (quest.questType === "streak") {
    const { streak } = computeStreakAndPenalty(acts, clientToday);
    return [Math.min(streak, STREAK_TARGET), STREAK_TARGET];
  }
  if (quest.questType === "weekly") {
    const done = acts.filter((a) => a.date >= weekStart && a.completed).length;
    return [Math.min(done, WEEKLY_TARGET), WEEKLY_TARGET];
  }
  if (quest.questType === "focus") {
    const match = quest.titleText.match(/'([^']+)'/);
    const keyword = (match ? match[1] : "").toLowerCase();
    const group = acts.filter((a) => keyword && `${a.title} ${a.notes}`.toLowerCase().includes(keyword));
    const done = group.filter((a) => a.completed).length;
    return [done, Math.max(group.length, 1)];
  }
  if (quest.questType === "boss") {
    const target = acts.find((a) => a.id === quest.activityId);
    return target && target.completed ? [1, 1] : [0, 1];
  }
  return [0, 1];
}

async function completeReadyQuests(userId, clientToday, acts, quests) {
  const newly = [];
  const active = quests.filter((q) => q.userId === userId && q.status === "active");
  for (const quest of active) {
    const [current, target] = questProgress(quest, acts, clientToday);
    if (target > 0 && current >= target) {
      quest.status = "completed";
      quest.completedAt = nowIso();
      await db.updateQuest(quest.id, {
        status: "completed",
        completedAt: quest.completedAt,
      });
      newly.push(quest);
    }
  }
  return newly;
}

async function generateQuests(userId, theme, clientToday, acts, quests) {
  const created = [];
  const weekStart = weekStartKey(clientToday);

  function hasActive(qtype, activityId = null, keyword = null) {
    const rows = quests.filter((q) => q.userId === userId && q.questType === qtype && q.status === "active");
    if (activityId !== null) return rows.some((r) => r.activityId === activityId);
    if (keyword !== null) return rows.some((r) => r.titleText.toLowerCase().includes(keyword.toLowerCase()));
    if (["daily", "clean_sweep", "morning_spark", "speed_blitz"].includes(qtype)) {
      return rows.some((r) => (r.createdAt || "").startsWith(clientToday));
    }
    if (qtype === "weekly") return rows.some((r) => (r.createdAt || "").slice(0, 10) >= weekStart);
    return rows.length > 0;
  }

  function completedToday(qtype) {
    return quests.filter((q) => q.userId === userId && q.questType === qtype && q.status === "completed")
      .some((r) => (r.completedAt || "").startsWith(clientToday));
  }

  function completedThisWeek(qtype) {
    return quests.filter((q) => q.userId === userId && q.questType === qtype && q.status === "completed")
      .some((r) => (r.completedAt || "").slice(0, 10) >= weekStart);
  }

  async function add(qtype, titleText, activityId = null, target = 1) {
    const quest = await db.createQuest({
      userId,
      activityId,
      questType: qtype,
      theme,
      titleText,
      target,
    });
    quests.push(quest);
    created.push(quest);
  }

  const todays = acts.filter((a) => a.date === clientToday);

  // 1. Daily Volume Quest
  if (todays.length > 0 && !hasActive("daily") && !completedToday("daily")) {
    await add("daily", flavorQuest(theme, "daily", { n: DAILY_TARGET, title: titlesToday(acts, clientToday) }), null, DAILY_TARGET);
  }

  // 2. Days Logged Quest
  const distinctDays = new Set(acts.map((a) => a.date)).size;
  if (distinctDays >= 1 && !hasActive("days_logged") && !quests.some((q) => q.userId === userId && q.questType === "days_logged" && q.status === "completed")) {
    await add("days_logged", flavorQuest(theme, "days_logged", { n: 3 }), null, 3);
  }

  // 3. Speed Blitz Quest (complete task in under 60 mins)
  if (todays.length > 0 && !hasActive("speed_blitz") && !completedToday("speed_blitz")) {
    await add("speed_blitz", flavorQuest(theme, "speed_blitz", {}), null, 1);
  }

  // 4. Clean Sweep Quest (2+ tasks, 0 left)
  if (todays.length >= 2 && !hasActive("clean_sweep") && !completedToday("clean_sweep")) {
    await add("clean_sweep", flavorQuest(theme, "clean_sweep", {}), null, 1);
  }

  // 5. Morning Spark Quest (before 12 PM)
  if (todays.length > 0 && !hasActive("morning_spark") && !completedToday("morning_spark")) {
    await add("morning_spark", flavorQuest(theme, "morning_spark", {}), null, 1);
  }

  // 6. Streak Quest
  const { streak } = computeStreakAndPenalty(acts, clientToday);
  if (streak >= 1 && !hasActive("streak") && !completedToday("streak")) {
    await add("streak", flavorQuest(theme, "streak", { n: STREAK_TARGET }), null, STREAK_TARGET);
  }

  // 7. Weekly Quest
  const weekActs = acts.filter((a) => a.date >= weekStart);
  if (weekActs.length > 0 && !hasActive("weekly") && !completedThisWeek("weekly")) {
    await add("weekly", flavorQuest(theme, "weekly", { n: WEEKLY_TARGET }), null, WEEKLY_TARGET);
  }

  // 8. Focus Tag / Keyword
  const keyword = focusKeyword(acts);
  if (keyword && !hasActive("focus", null, keyword)) {
    await add("focus", flavorQuest(theme, "focus", { keyword, n: 1, title: keyword }), null, 1);
  }

  // 9. Boss Priority Challenge
  for (const act of acts) {
    if (act.priority && !act.completed && !hasActive("boss", act.id)) {
      await add("boss", flavorQuest(theme, "boss", { title: act.title, n: 1 }), act.id, 1);
    }
  }

  return created;
}

// Compute completion-based dynamic mentor advice
function getCompletionMentorAdvice(mentor, {
  totalToday,
  completedToday,
  pendingToday,
  hasIncompletePast,
  incompletePastCount,
  penaltyXp,
  recentCompletedTitle,
  hour,
}) {
  const lines = MENTOR_LINES[mentor] || MENTOR_LINES.zoro;

  if (hasIncompletePast) {
    return formatString(lines.penalty_streak_break || "We lost {penalty} XP from incomplete tasks yesterday. Clear today's slate to rebuild your streak!", {
      penalty: penaltyXp,
      count: incompletePastCount,
    });
  }

  if (recentCompletedTitle) {
    return formatString(lines.activity_completed || "Clean finish on '{title}'. Next cut is waiting.", {
      title: recentCompletedTitle,
      done: completedToday,
      total: totalToday,
      remaining: pendingToday,
    });
  }

  if (totalToday === 0) {
    return formatString(lines.none_logged || "Your logbook is blank today. Add your first goal.", {});
  }

  if (completedToday === totalToday && totalToday > 0) {
    return formatString(lines.all_completed || "All {total} tasks cleared today! Flawless execution.", {
      total: totalToday,
    });
  }

  if (hour >= 20 && pendingToday > 0) {
    return formatString(lines.evening_urgent || "Night's falling and {remaining} tasks remain! Finish them before midnight!", {
      remaining: pendingToday,
    });
  }

  if (completedToday === 0 && pendingToday > 0) {
    return formatString(lines.all_pending || "{total} tasks waiting. Take the first strike now.", {
      total: totalToday,
    });
  }

  if (completedToday > 0 && pendingToday > 0) {
    return formatString(lines.in_progress || "Good cut. {done} down, {remaining} to go. Keep pressing forward!", {
      done: completedToday,
      remaining: pendingToday,
      total: totalToday,
    });
  }

  return lines.login || "Stay focused and finish strong.";
}

async function syncProgress(userId, theme, mentor, clientToday, eventHint = null, detail = "") {
  const progress = await ensureProgress(userId);
  const acts = await db.getActivities(userId);
  const badges = await db.getBadges(userId);
  const quests = await db.getQuests(userId);

  const { streak, penaltyXp, incompletePastCount, streakBroken } = computeStreakAndPenalty(acts, clientToday);
  const completedCount = acts.filter((a) => a.completed).length;

  const rawXp = completedCount * BASE_XP + streak * STREAK_XP;
  const netXp = Math.max(0, rawXp - penaltyXp);

  const oldLevel = progress.level;
  const oldRank = (progress.theme || theme) ? rankFor(progress.theme || theme || "onepiece", oldLevel) : "";
  const { level, into, need } = levelFromXp(netXp);

  progress.xp = netXp;
  progress.level = level;
  progress.streakCached = streak;
  if (theme) progress.theme = theme;
  if (mentor) progress.mentor = mentor;

  const lockedTheme = progress.theme;
  const lockedMentor = progress.mentor;
  const newRank = lockedTheme ? rankFor(lockedTheme, level) : "";

  const events = [];
  if (eventHint) events.push(eventHint);
  if (level > oldLevel) events.push("level_up");
  if (lockedTheme && newRank !== oldRank && oldRank) {
    events.push("rank_up");
    await awardBadge(userId, `rank:${newRank}`, lockedTheme, badges);
  }
  if (lockedTheme) {
    if (netXp >= 100) await awardBadge(userId, "xp:100", lockedTheme, badges);
    if (netXp >= 250) await awardBadge(userId, "xp:250", lockedTheme, badges);
    if (netXp >= 500) await awardBadge(userId, "xp:500", lockedTheme, badges);
    if (streak >= 3) await awardBadge(userId, "streak:3", lockedTheme, badges);
    if (streak >= 7) await awardBadge(userId, "streak:7", lockedTheme, badges);
  }

  let assigned = [];
  let completedQuests = [];
  if (lockedTheme) {
    assigned = await generateQuests(userId, lockedTheme, clientToday, acts, quests);
    completedQuests = await completeReadyQuests(userId, clientToday, acts, quests);
    if (assigned.length > 0) events.push("quest_assigned");
    if (completedQuests.length > 0) events.push("quest_completed");
  }

  const todays = acts.filter((a) => a.date === clientToday);
  const totalToday = todays.length;
  const completedToday = todays.filter((a) => a.completed).length;
  const pendingToday = totalToday - completedToday;
  const hour = new Date().getHours();

  let mentorText = null;
  let mentorEvent = eventHint || "status";

  if (lockedMentor) {
    if (events.includes("rank_up")) {
      mentorText = mentorLine(lockedMentor, "rank_up", { rank: newRank });
      mentorEvent = "rank_up";
    } else if (events.includes("level_up")) {
      mentorText = mentorLine(lockedMentor, "level_up", { level });
      mentorEvent = "level_up";
    } else if (events.includes("quest_completed") && completedQuests.length > 0) {
      mentorText = mentorLine(lockedMentor, "quest_completed", { detail: completedQuests[0].titleText });
      mentorEvent = "quest_completed";
    } else {
      // Direct completion-based mentor advice
      mentorText = getCompletionMentorAdvice(lockedMentor, {
        totalToday,
        completedToday,
        pendingToday,
        hasIncompletePast: streakBroken,
        incompletePastCount,
        penaltyXp,
        recentCompletedTitle: eventHint === "activity_complete" ? detail : "",
        hour,
      });
      progress.mentorEvent = mentorEvent;
      progress.mentorText = mentorText;
    }
  }

  await db.saveUserProgress(userId, progress);

  const meta = lockedTheme && lockedMentor ? mentorMeta(lockedTheme, lockedMentor) : null;
  return {
    xp: netXp,
    raw_xp: rawXp,
    penalty_xp: penaltyXp,
    incomplete_past_count: incompletePastCount,
    streak_broken: streakBroken,
    xp_into_level: into,
    xp_for_next: need,
    level,
    rank: newRank,
    streak,
    theme: lockedTheme,
    mentor: lockedMentor,
    mentor_name: meta ? meta.name : null,
    mentor_title: meta ? meta.title : null,
    mentor_event: mentorEvent || progress.mentorEvent,
    mentor_text: mentorText || progress.mentorText,
    rank_up: events.includes("rank_up"),
    level_up: events.includes("level_up"),
    assigned_count: assigned.length,
    completed_quest_count: completedQuests.length,
  };
}

async function snapshotProgress(userId, theme, mentor, clientToday) {
  const progress = await ensureProgress(userId);
  const acts = await db.getActivities(userId);
  const { streak, penaltyXp, incompletePastCount, streakBroken } = computeStreakAndPenalty(acts, clientToday);
  const completedCount = acts.filter((a) => a.completed).length;

  const rawXp = completedCount * BASE_XP + streak * STREAK_XP;
  const netXp = Math.max(0, rawXp - penaltyXp);
  const { level, into, need } = levelFromXp(netXp);

  progress.xp = netXp;
  progress.level = level;
  progress.streakCached = streak;

  const lockedTheme = theme || progress.theme;
  const lockedMentor = mentor || progress.mentor;
  const meta = lockedTheme && lockedMentor ? mentorMeta(lockedTheme, lockedMentor) : null;

  const todays = acts.filter((a) => a.date === clientToday);
  const totalToday = todays.length;
  const completedToday = todays.filter((a) => a.completed).length;
  const pendingToday = totalToday - completedToday;
  const hour = new Date().getHours();

  let advice = progress.mentorText;
  if (lockedMentor) {
    advice = getCompletionMentorAdvice(lockedMentor, {
      totalToday,
      completedToday,
      pendingToday,
      hasIncompletePast: streakBroken,
      incompletePastCount,
      penaltyXp,
      recentCompletedTitle: "",
      hour,
    });
    progress.mentorText = advice;
  }

  await db.saveUserProgress(userId, progress);

  return {
    xp: netXp,
    raw_xp: rawXp,
    penalty_xp: penaltyXp,
    incomplete_past_count: incompletePastCount,
    streak_broken: streakBroken,
    xp_into_level: into,
    xp_for_next: need,
    level,
    rank: lockedTheme ? rankFor(lockedTheme, level) : null,
    streak,
    theme: lockedTheme,
    mentor: lockedMentor,
    mentor_name: meta ? meta.name : null,
    mentor_title: meta ? meta.title : null,
    mentor_event: progress.mentorEvent || "status",
    mentor_text: advice,
    rank_up: false,
    level_up: false,
    assigned_count: 0,
    completed_quest_count: 0,
  };
}

function serializeQuest(quest, acts, clientToday) {
  const [current, target] = questProgress(quest, acts, clientToday);
  return {
    id: quest.id,
    activity_id: quest.activityId,
    quest_type: quest.questType,
    theme: quest.theme,
    title_text: quest.titleText,
    status: quest.status,
    created_at: quest.createdAt,
    completed_at: quest.completedAt,
    current,
    target,
    progress: target === 0 ? 0 : Math.round((100 * current) / target),
  };
}

function serializeActivity(a) {
  return {
    id: a.id,
    user_id: a.userId,
    title: a.title,
    notes: a.notes || "",
    date: a.date,
    completed: a.completed,
    time: a.time || null,
    priority: !!a.priority,
    created_at: a.createdAt || null,
    completed_at: a.completedAt || null,
  };
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

function getClientDate(req) {
  const headerDate = req.headers["x-client-date"];
  if (headerDate && /^\d{4}-\d{2}-\d{2}$/.test(headerDate)) {
    return headerDate;
  }
  return todayKey();
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ detail: "Not signed in" });
  }
  const token = authHeader.slice(7).trim();
  const session = await db.findSession(token);
  if (!session) {
    return res.status(401).json({ detail: "Session expired" });
  }
  const user = await db.findUserById(session.userId);
  if (!user) {
    return res.status(401).json({ detail: "User not found" });
  }
  req.user = user;
  req.session = session;
  next();
}

// ============================================================================
// API ROUTES
// ============================================================================

app.get("/api/db-status", async (req, res) => {
  try {
    const status = await db.testConnection();
    res.json(status);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body || {};
  const cleanName = (username || "").trim();

  if (!cleanName || cleanName.length < 3) {
    return res.status(400).json({ detail: "Username must be at least 3 characters long" });
  }
  if (cleanName.length > 24) {
    return res.status(400).json({ detail: "Username cannot exceed 24 characters" });
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(cleanName)) {
    return res.status(400).json({ detail: "Username can only contain letters, numbers, hyphens, and underscores" });
  }
  if (!password || String(password).length < 4) {
    return res.status(400).json({ detail: "Passcode must be at least 4 characters long" });
  }

  const existing = await db.findUserByUsername(cleanName);
  if (existing) {
    return res.status(409).json({ detail: "Username is already taken. Please pick another or sign in." });
  }

  const newUser = await db.createUser({ username: cleanName, password: String(password) });
  const token = crypto.randomBytes(32).toString("hex");
  await db.createSession({ token, userId: newUser.id });

  res.status(201).json({ token, username: newUser.username, userId: newUser.id, isNew: true });
});

// Alias for signup
app.post("/api/register", (req, res) => {
  req.url = "/api/signup";
  return app._router.handle(req, res);
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const queryName = (username || "").trim();
  const user = await db.findUserByUsername(queryName);
  if (!user || String(user.password) !== String(password)) {
    return res.status(401).json({ detail: "Incorrect username or passcode" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  await db.createSession({ token, userId: user.id });
  res.json({ token, username: user.username });
});

app.post("/api/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    await db.deleteSession(token);
  }
  res.json({ ok: true });
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({
    username: req.user.username,
    theme: req.session.theme,
    mentor: req.session.mentor,
  });
});

app.post("/api/session/start", authMiddleware, async (req, res) => {
  const session = req.session;
  if (session.theme && session.mentor) {
    // If already locked, return current progress rather than erroring out
    const clientToday = getClientDate(req);
    const payload = await snapshotProgress(req.user.id, session.theme, session.mentor, clientToday);
    return res.json(payload);
  }
  const { theme, mentor } = req.body || {};
  try {
    validateThemeMentor(theme, mentor);
  } catch (exc) {
    return res.status(422).json({ detail: exc.message });
  }
  await db.updateSession(session.token, { theme, mentor });
  session.theme = theme;
  session.mentor = mentor;

  const clientToday = getClientDate(req);
  const payload = await syncProgress(req.user.id, session.theme, session.mentor, clientToday, "login");
  res.json(payload);
});

app.get("/api/progress", authMiddleware, async (req, res) => {
  const clientToday = getClientDate(req);
  const payload = await snapshotProgress(req.user.id, req.session.theme, req.session.mentor, clientToday);
  res.json(payload);
});

app.get("/api/quests", authMiddleware, async (req, res) => {
  const clientToday = getClientDate(req);
  const acts = await db.getActivities(req.user.id);
  const quests = await db.getQuests(req.user.id);
  res.json(quests.map((q) => serializeQuest(q, acts, clientToday)));
});

app.post("/api/quests/generate", authMiddleware, async (req, res) => {
  if (!req.session.theme) {
    return res.status(400).json({ detail: "Start a session with a theme first" });
  }
  const clientToday = getClientDate(req);
  const payload = await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, "quest_assigned");
  const acts = await db.getActivities(req.user.id);
  const quests = await db.getQuests(req.user.id);
  res.json({ progress: payload, quests: quests.map((q) => serializeQuest(q, acts, clientToday)) });
});

app.get("/api/badges", authMiddleware, async (req, res) => {
  const badges = await db.getBadges(req.user.id);
  res.json(
    badges.map((b) => ({
      id: b.id,
      badge_key: b.badgeKey,
      label: badgeLabel(b.badgeKey),
      theme: b.theme,
      earned_at: b.earnedAt,
    }))
  );
});

app.get("/api/mentor/message", authMiddleware, async (req, res) => {
  if (!req.session.mentor) {
    return res.status(400).json({ detail: "No mentor locked for this session" });
  }
  const clientToday = getClientDate(req);
  const progress = await snapshotProgress(req.user.id, req.session.theme, req.session.mentor, clientToday);
  const meta = mentorMeta(req.session.theme, req.session.mentor) || { name: req.session.mentor, title: "Guide" };
  const linesDict = MENTOR_LINES[req.session.mentor] || {};
  const quotes = Object.values(linesDict).filter((v) => typeof v === "string");
  res.json({
    mentor: meta.name,
    mentor_id: req.session.mentor,
    title: meta.title,
    event: progress.mentor_event,
    text: progress.mentor_text,
    quotes,
  });
});

app.get("/api/activities", authMiddleware, async (req, res) => {
  const q = req.query.q;
  const filter = (q && typeof q === "string") ? q.trim() : "";
  const rows = await db.getActivities(req.user.id, filter);
  res.json(rows.map(serializeActivity));
});

app.post("/api/activities", authMiddleware, async (req, res) => {
  const { title, notes, priority, date } = req.body || {};
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) {
    return res.status(422).json({ detail: "Title is required" });
  }
  const clientToday = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : getClientDate(req);

  const activity = await db.createActivity({
    userId: req.user.id,
    title: cleanTitle,
    notes: (notes || "").trim(),
    date: clientToday,
    priority: !!priority,
  });

  if (req.session.theme) {
    await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, "quest_assigned", activity.title);
  }
  res.status(201).json(serializeActivity(activity));
});

app.put("/api/activities/:id", authMiddleware, async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const { title, notes, priority } = req.body || {};
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) {
    return res.status(422).json({ detail: "Title is required" });
  }
  const updated = await db.updateActivity(activityId, req.user.id, {
    title: cleanTitle,
    notes: (notes || "").trim(),
    priority,
  });
  if (!updated) {
    return res.status(404).json({ detail: "Activity not found" });
  }

  const clientToday = getClientDate(req);
  if (req.session.theme) {
    await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, "quest_assigned", updated.title);
  }
  res.json(serializeActivity(updated));
});

app.patch("/api/activities/:id/toggle", authMiddleware, async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const toggled = await db.toggleActivity(activityId, req.user.id, nowTime());
  if (!toggled) {
    return res.status(404).json({ detail: "Activity not found" });
  }

  const clientToday = getClientDate(req);
  if (req.session.theme) {
    const hint = toggled.completed ? "activity_complete" : null;
    await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, hint, toggled.title);
  }
  res.json(serializeActivity(toggled));
});

app.delete("/api/activities/:id", authMiddleware, async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const existing = await db.getActivityById(activityId, req.user.id);
  if (!existing) {
    return res.status(404).json({ detail: "Activity not found" });
  }
  await db.deleteActivity(activityId, req.user.id);

  const clientToday = getClientDate(req);
  if (req.session.theme) {
    await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday);
  }
  res.json({ ok: true });
});

// ============================================================================
// STATIC ASSET SERVING
// ============================================================================

const assetsDir = path.join(__dirname, "assets");
if (fs.existsSync(assetsDir)) {
  app.use("/assets", express.static(assetsDir, { maxAge: "1d" }));
}

const frontendAssetsDir = path.join(__dirname, "frontend", "assets");
if (fs.existsSync(frontendAssetsDir)) {
  app.use("/frontend/assets", express.static(frontendAssetsDir, { maxAge: "1d" }));
}

app.get("/style.css", (req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/script.js", (req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "script.js"));
});

app.get("/", (req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "index.html"));
});

// Fallback to index.html for SPA behavior
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Daybook server listening on port ${PORT} (0.0.0.0)`);
  console.log(`Active Database Adapter: ${db.getBackendType()}`);
  if (db.getBackendType() === "supabase") {
    db.syncLocalDataToSupabase().catch((err) => {
      console.warn("[Database] Background initial sync to Supabase:", err.message);
    });
  }
});
