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
const QUEST_XP = 25;

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
    schedule_tomorrow: "Before night falls, schedule your training for tomorrow. A dull blade waits for morning; a sharp one prepares tonight.",
    activity_completed: "Clean finish on '{title}'. No wasted motion. Next cut is waiting.",
    penalty_streak_break: "We took a hit on yesterday's incomplete work (-{penalty} XP) and lost the streak. Don't look back — draw your blade and clear today's slate.",
    quest_assigned: "A real cut, not a pose. Handle '{detail}' like you meant it.",
    quest_completed: "Clean finish on '{detail}'. No extra words. Next cut is waiting.",
    streak: "{streak} days without dropping the blade. Stay lost if you want — just don't stop.",
    level_up: "Level {level}. Stronger grip. Don't get sloppy about it.",
    rank_up: "New rank: {rank}. Titles are noise. The work isn't.",
    badge_earned: "New medal forged: '{badge}'. True proof of steel.",
    real_advises: [
      "A wound that would slay an ordinary man will not defeat you. Focus on one task and cut through it.",
      "If you don't master your own discipline, your blade is nothing more than bent iron.",
      "Never look back once you draw your sword. Pick your hardest task first and don't hesitate.",
      "When the world pushes you down, you don't complain — you push back with twice the force.",
      "Scars on the back are a swordsman's shame. Face your obligations head-on without flinching.",
      "Do not waste energy on idle talk. Let your completed work do the speaking.",
      "If you die here, it only means you weren't meant to go any further. So stay alive and finish the day.",
      "Solitude and repetition forge true strength. Don't look for shortcuts that do not exist."
    ],
  },
  luffy: {
    login: "Alright — crew's here! Let's knock today's logs down and feast after!",
    none_logged: "Nothing written down yet! What's our first adventure for today? Let's add it!",
    all_pending: "We've got {total} things to do! Let's blast through the first one right now!",
    in_progress: "Yahoo! {done} finished! Only {remaining} left and today's victory is ours!",
    all_completed: "SHISHISHI! Every single one of all {total} tasks is done! Victory feast time!",
    evening_urgent: "Hey! Night is coming and we still have {remaining} tasks left! Don't let our streak burn out!",
    schedule_tomorrow: "Hey! Before night gets here, let's schedule tomorrow's adventures! That way we can wake up ready to blast through them!",
    activity_completed: "Awesome! '{title}' is DONE! Let's keep this momentum going!",
    penalty_streak_break: "Gah, we left tasks unfinished yesterday and lost {penalty} XP! But we're not giving up — let's win our streak back today!",
    quest_assigned: "That one looks fun: '{detail}'. We finish it, then we celebrate.",
    quest_completed: "See? You did it! '{detail}' is crushed! That's the good kind of hungry.",
    streak: "{streak}-day streak! That's a feast of showing up.",
    level_up: "Level {level}! You got bigger — in the useful way!",
    rank_up: "Look at that rank: {rank}! Still the same job — help the crew finish the list!",
    badge_earned: "WOOHOO! We earned the '{badge}' badge! Add it to our pirate treasure!",
    real_advises: [
      "If you don't take risks, you can't create a future! Start with the task that scares you most!",
      "Being alone hurts worse than getting hurt! Lean on your crew when you need to, but pull your weight!",
      "I don't know how to navigate or cook or lie... but I know how to finish what I started!",
      "No matter how impossible it looks, if you want it, you just keep punching until it's done!",
      "Forget about yesterday's mistakes! Today is a whole new island to conquer!",
      "If you're hungry to win, you can't sit around waiting for food to fall from the sky. Go hunt it down!",
      "Smile through the grind! A miserable captain makes a miserable voyage!"
    ],
  },
  rayleigh: {
    login: "Charts are out. A quiet start still counts as a start.",
    none_logged: "The waters are calm this morning. Chart your first objective for the day.",
    all_pending: "A voyage begins with a single reef passed. Focus entirely on your first task of {total}.",
    in_progress: "{done} logs secured, {remaining} remaining. A steady pace is the mark of a veteran.",
    all_completed: "Every log resolved with clean precision. All {total} cleared. You commanded today's voyage masterfully.",
    evening_urgent: "The tide turns as night arrives. Clear those {remaining} logs to protect your chain.",
    schedule_tomorrow: "The sun is setting on today's voyage. Before night settles, chart and schedule your activities for tomorrow.",
    activity_completed: "Well navigated on '{title}'. Experience builds with every completed task.",
    penalty_streak_break: "An incomplete log yesterday cost us {penalty} XP. Experience teaches through stumbles; steady your footing and begin again.",
    quest_assigned: "Pay attention to '{detail}'. Haste is how crews lose the afternoon.",
    quest_completed: "Well done on '{detail}'. Experience is just finished work, stacked.",
    streak: "{streak} days. That's not luck. That's a habit wearing a grin.",
    level_up: "Level {level}. Power without judgment is just noise. You earned this one.",
    rank_up: "{rank} suits the work you've already done — not the work you talk about.",
    badge_earned: "The '{badge}' mark is well-deserved. You've earned your place in this sea.",
    real_advises: [
      "Charts and plans are only useful if you hoist the sails. Begin with a single deliberate action.",
      "Experience isn't something granted by title — it's stacked daily through quiet, honest execution.",
      "Do not rush into rough seas without reading the wind. Prioritize what matters before sunset.",
      "Power without self-control is merely reckless noise. Master your focus before you expand your scope.",
      "Even the greatest pirates started in wooden dinghies. Respect the foundational chores.",
      "A calm mind steers through any tempest. When the task list overwhelms you, breathe and handle one log.",
      "Discipline is the unglamorous rudder that keeps ambition from crashing onto the reefs."
    ],
  },
  ichigo: {
    login: "Don't overthink it. Open the list and take the first hit.",
    none_logged: "The duty sheet is empty. Put down your first assignment and let's handle it.",
    all_pending: "All {total} assignments are waiting. Stop hesitating and take the first swing.",
    in_progress: "{done} down. Keep your grip firm and finish the remaining {remaining} before they pile up.",
    all_completed: "All {total} tasks cleared from today's sheet. Clean slate. You earned your peace tonight.",
    evening_urgent: "It's late and you've got {remaining} tasks hanging over your head. Finish them before midnight.",
    schedule_tomorrow: "Before night falls, schedule your duties for tomorrow. Don't wake up scrambling to figure out what you need to do.",
    activity_completed: "That's '{title}' cleared. One less burden on your shoulders.",
    penalty_streak_break: "We slipped up yesterday and took a {penalty} XP deduction. Stop dwelling on it — focus on today's assignments.",
    quest_assigned: "'{detail}' is in front of you. Swing until it's done.",
    quest_completed: "Trial '{detail}' cleared. That's one less thing hanging over you. Good.",
    streak: "{streak} days in a row. Stubborn beats fancy every time.",
    level_up: "Level {level}. You got louder in the right way.",
    rank_up: "{rank}. Wear it if you want. Just keep covering your people.",
    badge_earned: "'{badge}' badge unlocked. Wear it with pride.",
    real_advises: [
      "Don't overthink every swing. Plant your feet, look at the task in front of you, and strike.",
      "I fight because there are things I won't let slip away. Find your reason and finish what you started.",
      "If fate is a millstone, then we're the ones who shatter it. Don't let laziness dictate your day.",
      "Confidence doesn't come from sitting back — it comes from taking hits and staying on your feet.",
      "Stop treating your responsibilities like heavy burdens. Treat them like battles you intend to win.",
      "When your back is against the wall, that's when you find out what you're really made of.",
      "Clear your mind of the noise. One swing, one duty, until the board is completely empty."
    ],
  },
  urahara: {
    login: "Ah, back again. Shall we make today's pile slightly less tragic?",
    none_logged: "No plans noted down yet? Even a small task is better than idling away the morning.",
    all_pending: "All {total} tasks remain untouched. May I suggest starting before time decides for you?",
    in_progress: "{done} cleared, {remaining} to go. The momentum looks promising; do maintain it.",
    all_completed: "Remarkable! All {total} cleared with zero debt. Even I have nothing to criticize.",
    evening_urgent: "The clock is ticking toward midnight. {remaining} tasks left — or tomorrow brings an unpleasant XP penalty.",
    schedule_tomorrow: "Before the night draws in, might I recommend scheduling tomorrow's tasks? A little foresight prevents endless complications.",
    activity_completed: "Delightful execution on '{title}'. Progress without drama is my favorite kind.",
    penalty_streak_break: "My, an incomplete day has reduced our XP by {penalty} and reset the chain. A pity, but a clean slate is an opportunity.",
    quest_assigned: "A puzzle for you: '{detail}'. Try solving it before it solves you.",
    quest_completed: "Neatly done on '{detail}'. I do enjoy when a plan survives contact with effort.",
    streak: "{streak} days. Consistency is the least theatrical magic, and the best.",
    level_up: "Level {level}. Curious. You're becoming inconveniently capable.",
    rank_up: "{rank}. A hat tip — purely metaphorical, of course.",
    badge_earned: "My, you unlocked '{badge}'. An exceptional addition to the collection.",
    real_advises: [
      "Preparation is not a prelude to victory; preparation IS victory. Map out your steps before you dive in.",
      "A clever warrior expends three minutes of strategy to save three hours of exhausting labor.",
      "Expect the unexpected, prepare for the worst, and maintain an amused smile throughout.",
      "There is no nobility in suffering through avoidable chaos. Organize your workspace and execute cleanly.",
      "Direct confrontation is rarely the only path. Look for the leverage point in difficult problems.",
      "Consistency is the least theatrical kind of magic, and yet it consistently produces miracles.",
      "Never let yourself become predictable to your own bad habits. Disrupt procrastination before it settles."
    ],
  },
  aizen: {
    login: "You've arrived. Order follows those who actually open the ledger.",
    none_logged: "A blank ledger is an unguided mind. Register your primary objective.",
    all_pending: "{total} items awaiting execution. Hesitation produces no results; begin.",
    in_progress: "{done} resolved. {remaining} left. Maintain efficiency until the final record is closed.",
    all_completed: "Total execution achieved. All {total} tasks completed as intended. Flawless control.",
    evening_urgent: "Time is expiring. {remaining} incomplete duties will compromise your streak. Eliminate them swiftly.",
    schedule_tomorrow: "Before the evening concludes, schedule your objectives for tomorrow. True mastery begins with structuring what comes next.",
    activity_completed: "'{title}' eliminated according to schedule. As it should be.",
    penalty_streak_break: "Unfinished duties yesterday yielded predictable setbacks (-{penalty} XP). Correct your discipline today; follow-through is mandatory.",
    quest_assigned: "Consider '{detail}' inevitable. Completing it is simply efficient.",
    quest_completed: "Trial '{detail}' concluded as expected. Follow-through is a kind of control.",
    streak: "{streak} consecutive days. Pattern recognized. Continue.",
    level_up: "Level {level}. Growth is only impressive when it is deliberate.",
    rank_up: "{rank}. A title is a tool. Use it; don't admire it.",
    badge_earned: "'{badge}' acquired as planned. Another milestone in order.",
    real_advises: [
      "Admiration is the state furthest from understanding. Do not idolize success; calculate the exact steps to achieve it.",
      "Chaos is merely an unorganized system. Impose your will upon your schedule and control the outcome.",
      "Hesitation is the luxury of those who lack conviction. Decide, schedule, and execute without wavering.",
      "Reason exists for those who cannot live without clinging to it. Let discipline govern your hours.",
      "A master does not rush; a master constructs the board so that victory becomes the only mathematical conclusion.",
      "Do not celebrate ordinary diligence. Excellence is merely the baseline of what you must demand from yourself.",
      "Every objective on your ledger must serve a higher architecture. Eliminate frivolous distractions."
    ],
  },
  naruto: {
    login: "We're here! Today's list doesn't stand a chance if we don't quit!",
    none_logged: "Hey! The mission board is empty! Add your tasks so we can crush them!",
    all_pending: "{total} missions waiting! Pick number one and let's do this, dattebayo!",
    in_progress: "{done} down! Only {remaining} left! We're on a roll, let's blast through the rest!",
    all_completed: "BELIEVE IT! All {total} missions cleared today! That's true ninja discipline!",
    evening_urgent: "It's almost bedtime and we still have {remaining} missions! Hustle up so our streak doesn't drop!",
    schedule_tomorrow: "Hey, before night comes, let's schedule tomorrow's missions right now! A true ninja always plans ahead, dattebayo!",
    activity_completed: "Yeah! We nailed '{title}'! Keep that chakra flowing, dattebayo!",
    penalty_streak_break: "Our streak broke and we lost {penalty} XP from yesterday! But ninjas never give up — let's hustle and rebuild it right now!",
    quest_assigned: "Believe it or don't — '{detail}' is getting finished.",
    quest_completed: "That's what I'm talking about! '{detail}' crushed! Proof you showed up!",
    streak: "{streak} days! That's a ninja that doesn't ghost the mission board!",
    level_up: "Level {level}! Hard work looks good on you, dattebayo!",
    rank_up: "{rank}! Cool title. Cooler that you earned it with actual tasks!",
    badge_earned: "YAHOO! '{badge}' badge unlocked, dattebayo! The whole village will know!",
    real_advises: [
      "My ninja way is simple: I never go back on my word, and I never give up on a task, dattebayo!",
      "Hard work beats natural talent when talent doesn't hustle! Put in the reps today!",
      "Failing once or twice doesn't make you a failure. Quitting before you finish does!",
      "If you don't like your destiny, don't accept it. Have the courage to change it with your own hands!",
      "Even shadow clones disappear if you lose focus! Put all your chakra into one mission at a time!",
      "Look at how far you've already come! Don't you dare stop when the finish line is in sight!",
      "When things get tough, smile wide and dig deeper! That's how legends are made!"
    ],
  },
  kakashi: {
    login: "On time enough. Let's treat the list like a real briefing.",
    none_logged: "Blank roster. Write down your mission plan before you head into the field.",
    all_pending: "{total} objectives pending. Identify the highest priority and move out.",
    in_progress: "{done} objectives secured. {remaining} in play. Maintain perimeter focus.",
    all_completed: "Mission accomplished across all {total} objectives. Exemplary field discipline. Debrief complete.",
    evening_urgent: "Evening briefing: {remaining} objectives unfinished. Wrap them up before end of day.",
    schedule_tomorrow: "Debriefing before night: schedule your mission roster for tomorrow. Tomorrow's victory is prepared in the field tonight.",
    activity_completed: "'{title}' logged as complete. Good tactical execution.",
    penalty_streak_break: "Mission failure yesterday cost us {penalty} XP. Review the errors, adjust your pace, and let's execute today properly.",
    quest_assigned: "'{detail}' is the assignment. Copy, complete, debrief later.",
    quest_completed: "Solid on '{detail}'. I'd call that a tactical pass — no extra lecture.",
    streak: "{streak} days. Showing up is the unglamorous jutsu that works.",
    level_up: "Level {level}. Keep both eyes on the next objective.",
    rank_up: "{rank}. Don't let the badge make you sloppy in the field.",
    badge_earned: "'{badge}' citation awarded. Good tactical accomplishment.",
    real_advises: [
      "In the shinobi world, those who break rules are scum, but those who abandon their duties are worse.",
      "Assess the battlefield before making your move. Break complex assignments down into tactical stages.",
      "A calm assessment under pressure will accomplish more than ten panicked rushes.",
      "Consistency is not glamorous, but it's the jutsu that wins the war when flashy tricks fail.",
      "Don't let yesterday's failures cloud today's vision. Keep one eye on the goal and the other on the field.",
      "Mastering the fundamentals is what allows you to improvise when the plan falls apart.",
      "Finish your daily reconnaissance early. A prepared shinobi sleeps soundly at night."
    ],
  },
  guy: {
    login: "YOUTH! The page is blank until we fill it with effort!",
    none_logged: "THE MORNING CALLS! Register your youth workout goals immediately!",
    all_pending: "{total} challenges standing before you! Attack the first one with the power of youth!",
    in_progress: "SPLENDID! {done} victories won, {remaining} trials left! PUSH TO MAXIMUM YOUTH!",
    all_completed: "TEARS OF YOUTH! You conquered all {total} trials today! A DAZZLING VICTORY!",
    evening_urgent: "THE MIDNIGHT FLAME IS THREATENED! Burn your brightest to clear those {remaining} duties before 10 PM!",
    schedule_tomorrow: "SPLENDID DEDICATION! Before night claims the sky, schedule tomorrow's youthful challenges with blazing passion!",
    activity_completed: "DYNAMIC FINISH on '{title}'! Feel the fiery youth coursing through your veins!",
    penalty_streak_break: "THE FLAME OF YOUTH NEVER DIES! Yesterday had gaps and cost us {penalty} XP, but today we burn hotter than ever! Let's conquer the board!",
    quest_assigned: "Burn bright on '{detail}'. Sweat is the point.",
    quest_completed: "YES! Trial '{detail}' finished with fiery spirit! Take a breath, then another step!",
    streak: "{streak} days of flame! DO NOT LET THE FIRE NAP!",
    level_up: "Level {level}! Power born from repetition, not shortcuts! GLORIOUS!",
    rank_up: "{rank}! Pose optional. Persistence mandatory!",
    badge_earned: "THE SHINING MEDAL OF YOUTH: '{badge}'! A MAGNIFICENT ACHIEVEMENT!",
    real_advises: [
      "THE SPRINGTIME OF YOUTH NEVER ENDS AS LONG AS YOU REFUSE TO SURRENDER TO LAZINESS!",
      "IF YOU CANNOT RUN, WALK! IF YOU CANNOT WALK, CRAWL! BUT NEVER STAND STILL BEFORE A CHALLENGE!",
      "A real loser isn't someone who fails — it's someone who never dares to challenge their own limits!",
      "Sweat is the cologne of triumph! Pour genuine passion into even the smallest chore on your roster!",
      "When fatigue whispers that you should stop, let the roaring fire of youth answer with 50 more push-ups!",
      "Dedication without self-belief is hollow! Believe in the magnificent beast that sleeps within you!",
      "A sparkling smile and relentless discipline will blast through any brick wall standing in your way!"
    ],
  },
  yami: {
    login: "Sit down. Open the book. Magic without guts is just sparkles.",
    none_logged: "Page is empty. Don't make me kick you into gear — write your duties down.",
    all_pending: "{total} tasks sitting there doing nothing. Get off your ass and finish the first one.",
    in_progress: "{done} done. Don't start celebrating early — you still have {remaining} jobs. Push past your limits!",
    all_completed: "Look at that — you actually finished all {total} tasks. Not bad, kid. That's what a Black Bull does.",
    evening_urgent: "It's late. Stop hesitating and finish the remaining {remaining} tasks before your streak dies.",
    schedule_tomorrow: "Evening's setting in. Before you call it a night, schedule tomorrow's jobs so you don't wake up slacking off.",
    activity_completed: "Crushed '{title}'. That's how it's done. On to the next ugly job.",
    penalty_streak_break: "You left yesterday's work half-baked and lost {penalty} XP. Stop slacking, push past your limits, and finish today's jobs.",
    quest_assigned: "'{detail}' is on you. Stop flinching and finish the thing.",
    quest_completed: "Not bad on '{detail}'. That's how a squad actually moves.",
    streak: "{streak} days. Grit looks boring until it saves the week.",
    level_up: "Level {level}. Stronger. Don't get cocky about it.",
    rank_up: "{rank}. Congrats. Now do the next ugly job anyway.",
    badge_earned: "'{badge}' badge secured. Not bad, kid. Keep pushing.",
    real_advises: [
      "Surpass your limits. Right here. Right now. That's the only rule that matters in the Black Bulls.",
      "Magic without guts is just cheap fireworks. Put your back into the work and stop complaining.",
      "If you hit a wall, don't sit down and cry. Smash through the damn wall with your head if you have to.",
      "Stop overanalyzing your duties. Sit down, open the book, and finish the job before I kick your ass.",
      "Everyone's got flaws. The trick is to be stubborn enough that your flaws can't stop you from winning.",
      "Nobody is coming to do your work for you. Own your slate, swing your blade, and rest when it's done.",
      "When the pressure gets suffocating, take a deep puff, grin, and push past what you thought was possible."
    ],
  },
  asta: {
    login: "I'm not tired yet — and neither is this list. Let's go!",
    none_logged: "Zero missions?! Let's add some! I'm ready to train all day!",
    all_pending: "{total} duties on the board! I'm tackling the first one right now with full power!",
    in_progress: "{done} conquered! Just {remaining} more! I'm not tired at all, let's keep going!",
    all_completed: "WE DID IT! ALL {total} COMPLETED! Hard work never betrays! Best feeling in the world!",
    evening_urgent: "The clock is running out! I'm not letting our streak break tonight! Let's crush those {remaining} tasks!",
    schedule_tomorrow: "Before night falls, let's schedule our training and duties for tomorrow! Push past your limits every single day!",
    activity_completed: "'{title}' IS FINISHED! I never give up, and neither did you!",
    penalty_streak_break: "We lost {penalty} XP yesterday?! NOT YET! I'm gonna work ten times harder today to earn it all back! Let's go!",
    quest_assigned: "We'll smash '{detail}' even if it takes extra reps.",
    quest_completed: "FINISHED '{detail}'! That's the feeling. Chase it again with all your might!",
    streak: "{streak} days without quitting. That's my kind of training.",
    level_up: "Level {level}! Hard work is the magic. Always was!",
    rank_up: "{rank}! We earned this with sweat, not luck.",
    badge_earned: "'{badge}' UNLOCKED! We did it through pure sweat and hustle!",
    real_advises: [
      "MY MAGIC IS NEVER GIVING UP! Even with zero advantages, raw grit will beat pure genius every time!",
      "If you get knocked down a hundred times, you stand up a hundred and one times and yell even louder!",
      "Hard work never betrays! Every single rep, every single finished task makes you a centimeter stronger!",
      "I'm not letting fatigue decide when I stop! I stop when the board is completely clear, not before!",
      "Don't compare your pace to someone else's! Swing your own heavy sword at your own maximum power!",
      "Even when people doubt you, let your sweat do the talking! Let's blast through this together!",
      "Pushing past your limits isn't a speech — it's what you do right now on this exact task!"
    ],
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

function formatString(template, vars = {}) {
  if (!template || typeof template !== "string") return "";
  const defaults = {
    total: "0",
    done: "0",
    remaining: "0",
    title: "Task",
    streak: "1",
    level: "1",
    rank: "Member",
    penalty: "0",
    detail: "Objective",
    badge: "Honor Medal",
    count: "0",
    n: "1",
    keyword: "Focus",
  };
  return template.replace(/{(\w+)}/g, (_, k) => {
    if (vars && vars[k] !== undefined && vars[k] !== null && String(vars[k]).trim() !== "") {
      return String(vars[k]);
    }
    if (defaults[k] !== undefined) return defaults[k];
    return "";
  });
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

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
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

function questProgress(quest, acts, clientToday, allQuests = []) {
  if (quest.status === "completed") {
    const target = quest.target || 1;
    return [target, target];
  }

  const weekStart = weekStartKey(clientToday);
  const todays = acts.filter((a) => a.date === clientToday);
  const questCreatedMs = quest.createdAt ? new Date(quest.createdAt).getTime() : 0;

  if (quest.questType === "daily") {
    const target = quest.target || DAILY_TARGET;
    const priorCompletedToday = allQuests.some(
      (q) => q.userId === quest.userId && q.questType === "daily" && q.status === "completed" && (q.completedAt || "").startsWith(clientToday)
    );
    if (!priorCompletedToday) {
      const done = todays.filter((a) => a.completed).length;
      return [Math.min(done, target), target];
    }
    const done = todays.filter((a) => {
      if (!a.completed) return false;
      if (!a.completedAt) return true;
      return new Date(a.completedAt).getTime() >= questCreatedMs;
    }).length;
    return [Math.min(done, target), target];
  }

  if (quest.questType === "days_logged") {
    const distinctDays = new Set(acts.map((a) => a.date)).size;
    const target = quest.target || 3;
    return [Math.min(distinctDays, target), target];
  }

  if (quest.questType === "speed_blitz") {
    const priorCompletedToday = allQuests.some(
      (q) => q.userId === quest.userId && q.questType === "speed_blitz" && q.status === "completed" && (q.completedAt || "").startsWith(clientToday)
    );
    const fastDone = todays.filter((a) => {
      if (!a.completed || !a.createdAt || !a.completedAt) return false;
      const compMs = new Date(a.completedAt).getTime();
      if (priorCompletedToday && compMs < questCreatedMs) return false;
      const diffMs = compMs - new Date(a.createdAt).getTime();
      return diffMs >= 0 && diffMs <= 60 * 60 * 1000;
    }).length;
    return [Math.min(fastDone, 1), 1];
  }

  if (quest.questType === "clean_sweep") {
    const done = todays.filter((a) => a.completed).length;
    const priorCompletedToday = allQuests.some(
      (q) => q.userId === quest.userId && q.questType === "clean_sweep" && q.status === "completed" && (q.completedAt || "").startsWith(clientToday)
    );
    if (!priorCompletedToday) {
      const isSweep = todays.length >= 2 && done === todays.length;
      return [isSweep ? 1 : 0, 1];
    }
    const hasNewCompletion = todays.some(
      (a) => a.completed && a.completedAt && new Date(a.completedAt).getTime() >= questCreatedMs
    );
    const isSweep = todays.length >= 2 && done === todays.length && hasNewCompletion;
    return [isSweep ? 1 : 0, 1];
  }

  if (quest.questType === "morning_spark") {
    const priorCompletedToday = allQuests.some(
      (q) => q.userId === quest.userId && q.questType === "morning_spark" && q.status === "completed" && (q.completedAt || "").startsWith(clientToday)
    );
    const morningDone = todays.filter((a) => {
      if (!a.completed) return false;
      if (a.completedAt) {
        const compMs = new Date(a.completedAt).getTime();
        if (priorCompletedToday && compMs < questCreatedMs) return false;
        const h = new Date(a.completedAt).getHours();
        return h < 12;
      }
      return a.time && (a.time.includes("AM") || (a.time.startsWith("12:") && a.time.includes("PM")));
    }).length;
    return [Math.min(morningDone, 1), 1];
  }

  if (quest.questType === "streak") {
    const { streak } = computeStreakAndPenalty(acts, clientToday);
    const target = quest.target || STREAK_TARGET;
    return [Math.min(streak, target), target];
  }

  if (quest.questType === "weekly") {
    const done = acts.filter((a) => a.date >= weekStart && a.completed).length;
    const target = quest.target || WEEKLY_TARGET;
    return [Math.min(done, target), target];
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
    const [current, target] = questProgress(quest, acts, clientToday, quests);
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
    return rows.length > 0;
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

  // 1. Daily Volume Quest (born anew once completed)
  if (todays.length > 0 && !hasActive("daily")) {
    const completedDailyToday = quests.filter(
      (q) => q.userId === userId && q.questType === "daily" && q.status === "completed" && (q.completedAt || "").startsWith(clientToday)
    ).length;
    const target = completedDailyToday === 0 ? DAILY_TARGET : 2;
    await add("daily", flavorQuest(theme, "daily", { n: target, title: titlesToday(acts, clientToday) }), null, target);
  }

  // 2. Days Logged Quest (higher milestone born once completed)
  const distinctDays = new Set(acts.map((a) => a.date)).size;
  if (distinctDays >= 1 && !hasActive("days_logged")) {
    const completedDaysLogged = quests.filter((q) => q.userId === userId && q.questType === "days_logged" && q.status === "completed").length;
    const daysLoggedTiers = [3, 5, 7, 10, 14, 21, 30, 60, 90];
    const target = daysLoggedTiers[Math.min(completedDaysLogged, daysLoggedTiers.length - 1)];
    await add("days_logged", flavorQuest(theme, "days_logged", { n: target }), null, target);
  }

  // 3. Speed Blitz Quest (complete task in under 60 mins - born anew once completed)
  if (todays.length > 0 && !hasActive("speed_blitz")) {
    await add("speed_blitz", flavorQuest(theme, "speed_blitz", {}), null, 1);
  }

  // 4. Clean Sweep Quest (2+ tasks, 0 left - born anew once completed)
  if (todays.length >= 2 && !hasActive("clean_sweep")) {
    await add("clean_sweep", flavorQuest(theme, "clean_sweep", {}), null, 1);
  }

  // 5. Morning Spark Quest (before 12 PM - born anew once completed)
  if (todays.length > 0 && !hasActive("morning_spark")) {
    await add("morning_spark", flavorQuest(theme, "morning_spark", {}), null, 1);
  }

  // 6. Streak Quest (higher milestone born once completed)
  const { streak } = computeStreakAndPenalty(acts, clientToday);
  if (streak >= 1 && !hasActive("streak")) {
    const completedStreak = quests.filter((q) => q.userId === userId && q.questType === "streak" && q.status === "completed").length;
    const streakTiers = [3, 5, 7, 10, 14, 21, 30, 60, 90];
    const target = streakTiers[Math.min(completedStreak, streakTiers.length - 1)];
    await add("streak", flavorQuest(theme, "streak", { n: target }), null, target);
  }

  // 7. Weekly Quest (higher milestone born once completed)
  const weekActs = acts.filter((a) => a.date >= weekStart);
  if (weekActs.length > 0 && !hasActive("weekly")) {
    const completedWeekly = quests.filter((q) => q.userId === userId && q.questType === "weekly" && q.status === "completed").length;
    const weeklyTiers = [5, 10, 15, 20, 25, 30, 40, 50];
    const target = weeklyTiers[Math.min(completedWeekly, weeklyTiers.length - 1)];
    await add("weekly", flavorQuest(theme, "weekly", { n: target }), null, target);
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
  scheduledTomorrowCount = 0,
}) {
  const lines = MENTOR_LINES[mentor] || MENTOR_LINES.zoro;

  if (hasIncompletePast) {
    return formatString(lines.penalty_streak_break || "We lost {penalty} XP from incomplete tasks yesterday. Clear today's slate to rebuild your streak!", {
      penalty: penaltyXp,
      count: incompletePastCount,
    });
  }

  if (recentCompletedTitle) {
    if (completedToday === totalToday && totalToday > 0) {
      return formatString(lines.all_completed || "All {total} tasks cleared today! Flawless execution.", {
        title: recentCompletedTitle,
        done: completedToday,
        total: totalToday,
        remaining: 0,
      });
    }
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

  // Pre-night recommendation: from 5 PM to 10 PM (before late night), recommend scheduling activities for tomorrow
  const isPreNight = hour >= 17 && hour < 22;
  if (isPreNight && scheduledTomorrowCount === 0) {
    if (completedToday === totalToday && totalToday > 0) {
      return formatString(lines.schedule_tomorrow || "All tasks cleared today! Before night falls, schedule your activities for tomorrow to keep your momentum.", {
        total: totalToday,
      });
    }
    if (pendingToday <= 1) {
      return formatString(lines.schedule_tomorrow || "Before night arrives, take a moment to schedule tomorrow's activities.", {});
    }
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
  let quests = await db.getQuests(userId);

  if (theme) progress.theme = theme;
  if (mentor) progress.mentor = mentor;
  const lockedTheme = progress.theme;
  const lockedMentor = progress.mentor;

  const events = [];
  if (eventHint) events.push(eventHint);

  let assigned = [];
  let completedQuests = [];
  if (lockedTheme) {
    // 1. Check and mark ready quests as completed first
    completedQuests = await completeReadyQuests(userId, clientToday, acts, quests);
    if (completedQuests.length > 0) events.push("quest_completed");

    // 2. Immediately birth replacement / next milestone quests
    assigned = await generateQuests(userId, lockedTheme, clientToday, acts, quests);
    if (assigned.length > 0) events.push("quest_assigned");
  }

  const { streak, penaltyXp, incompletePastCount, streakBroken } = computeStreakAndPenalty(acts, clientToday);
  const completedCount = acts.filter((a) => a.completed).length;
  const completedQuestsCount = quests.filter((q) => q.userId === userId && q.status === "completed").length;
  const questXp = completedQuestsCount * QUEST_XP;

  const rawXp = completedCount * BASE_XP + streak * STREAK_XP + questXp;
  const netXp = Math.max(0, rawXp - penaltyXp);

  const oldLevel = progress.level;
  const oldRank = lockedTheme ? rankFor(lockedTheme, oldLevel) : "";
  const { level, into, need } = levelFromXp(netXp);

  progress.xp = netXp;
  progress.level = level;
  progress.streakCached = streak;

  const newRank = lockedTheme ? rankFor(lockedTheme, level) : "";

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
  const isAllCompleted = completedToday === totalToday && totalToday > 0;
  const isActivityCompleted = eventHint === "activity_complete";
  const isQuestCompleted = events.includes("quest_completed");
  const isRankUp = events.includes("rank_up");
  const isLevelUp = events.includes("level_up");
  const isAchievement = isRankUp || isLevelUp || isQuestCompleted || isAllCompleted || isActivityCompleted;

  let achievementType = null;
  if (isRankUp) achievementType = "rank_up";
  else if (isLevelUp) achievementType = "level_up";
  else if (isQuestCompleted) achievementType = "quest_completed";
  else if (isAllCompleted) achievementType = "all_completed";
  else if (isActivityCompleted) achievementType = "activity_completed";

  return {
    xp: netXp,
    raw_xp: rawXp,
    quest_xp: questXp,
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
    rank_up: isRankUp,
    level_up: isLevelUp,
    assigned_count: assigned.length,
    completed_quest_count: completedQuests.length,
    is_achievement: isAchievement,
    achievement_type: achievementType,
    all_completed: isAllCompleted,
    activity_completed: isActivityCompleted,
    recent_title: eventHint === "activity_complete" ? detail : "",
  };
}

async function snapshotProgress(userId, theme, mentor, clientToday) {
  const progress = await ensureProgress(userId);
  const acts = await db.getActivities(userId);
  const quests = await db.getQuests(userId);
  const { streak, penaltyXp, incompletePastCount, streakBroken } = computeStreakAndPenalty(acts, clientToday);
  const completedCount = acts.filter((a) => a.completed).length;
  const completedQuestsCount = quests.filter((q) => q.userId === userId && q.status === "completed").length;
  const questXp = completedQuestsCount * QUEST_XP;

  const rawXp = completedCount * BASE_XP + streak * STREAK_XP + questXp;
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

  const tmrwStr = tomorrowKey();
  const scheduledTomorrowCount = acts.filter((a) => a.date === tmrwStr).length;

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
      scheduledTomorrowCount,
    });
    progress.mentorText = advice;
  }

  await db.saveUserProgress(userId, progress);

  return {
    xp: netXp,
    raw_xp: rawXp,
    quest_xp: questXp,
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
    completed_quest_count: completedQuestsCount,
  };
}

function serializeQuest(quest, acts, clientToday, allQuests = []) {
  const [current, target] = questProgress(quest, acts, clientToday, allQuests);
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
    xp: QUEST_XP,
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
  let quests = await db.getQuests(req.user.id);
  if (req.session.theme) {
    const completed = await completeReadyQuests(req.user.id, clientToday, acts, quests);
    if (completed.length > 0) {
      await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, "quest_completed");
      quests = await db.getQuests(req.user.id);
    }
    const born = await generateQuests(req.user.id, req.session.theme, clientToday, acts, quests);
    if (born.length > 0) {
      quests = await db.getQuests(req.user.id);
    }
  }
  res.json(quests.map((q) => serializeQuest(q, acts, clientToday, quests)));
});

app.post("/api/quests/generate", authMiddleware, async (req, res) => {
  if (!req.session.theme) {
    return res.status(400).json({ detail: "Start a session with a theme first" });
  }
  const clientToday = getClientDate(req);
  const payload = await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, "quest_assigned");
  const acts = await db.getActivities(req.user.id);
  const quests = await db.getQuests(req.user.id);
  res.json({ progress: payload, quests: quests.map((q) => serializeQuest(q, acts, clientToday, quests)) });
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
  const mentorKey = req.session.mentor;
  const linesDict = MENTOR_LINES[mentorKey] || MENTOR_LINES.zoro;

  const acts = await db.getActivities(req.user.id);
  const todays = acts.filter((a) => a.date === clientToday);
  const totalToday = todays.length;
  const completedToday = todays.filter((a) => a.completed).length;
  const pendingToday = totalToday - completedToday;
  const latestCompleted = todays.filter((a) => a.completed).slice(-1)[0] || acts.filter((a) => a.completed).slice(-1)[0];
  const recentTitle = latestCompleted ? latestCompleted.title : (todays[0] ? todays[0].title : "Daily Task");

  const vars = {
    total: totalToday,
    done: completedToday,
    remaining: pendingToday,
    title: recentTitle,
    streak: progress.streak || 1,
    level: progress.level || 1,
    rank: progress.rank || "Rookie",
    penalty: progress.penalty_xp || 0,
    detail: recentTitle,
    badge: "Honor Medal",
  };

  const realAdvises = (linesDict.real_advises || []).map((q) => formatString(q, vars));

  const achievementQuotes = {
    activity_completed: formatString(linesDict.activity_completed || "Clean finish on '{title}'. Next cut is waiting.", vars),
    all_completed: formatString(linesDict.all_completed || "All {total} tasks cleared today. Sharp and disciplined.", vars),
    level_up: formatString(linesDict.level_up || "Level {level}. Stronger grip. Don't get sloppy.", vars),
    rank_up: formatString(linesDict.rank_up || "New rank: {rank}. Titles are noise. The work isn't.", vars),
    quest_completed: formatString(linesDict.quest_completed || "Trial '{detail}' finished cleanly.", vars),
    streak: formatString(linesDict.streak || "{streak} days without dropping the chain.", vars),
    badge_earned: formatString(linesDict.badge_earned || "You earned a badge of honor: '{badge}'.", vars),
  };

  const statusQuotes = {
    all_pending: formatString(linesDict.all_pending || "{total} tasks waiting. Take the first strike.", vars),
    in_progress: formatString(linesDict.in_progress || "{done} down, {remaining} to go. Keep pressing forward!", vars),
    evening_urgent: formatString(linesDict.evening_urgent || "Night's falling and {remaining} tasks remain.", vars),
    schedule_tomorrow: formatString(linesDict.schedule_tomorrow || "Schedule tomorrow's goals to maintain your momentum.", vars),
    none_logged: formatString(linesDict.none_logged || "Your logbook is blank today. Add your first goal.", vars),
    penalty_streak_break: formatString(linesDict.penalty_streak_break || "We lost {penalty} XP yesterday. Clear today's slate to rebuild your streak!", vars),
  };

  res.json({
    mentor: meta.name,
    mentor_id: mentorKey,
    title: meta.title,
    event: progress.mentor_event,
    text: formatString(progress.mentor_text || linesDict.login, vars),
    real_advises: realAdvises,
    achievement_quotes: achievementQuotes,
    status_quotes: statusQuotes,
    quotes: realAdvises,
    stats: {
      total: totalToday,
      done: completedToday,
      remaining: pendingToday,
      recentTitle,
    },
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
  const { title, notes, priority, date } = req.body || {};
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) {
    return res.status(422).json({ detail: "Title is required" });
  }
  const updated = await db.updateActivity(activityId, req.user.id, {
    title: cleanTitle,
    notes: (notes || "").trim(),
    priority,
    date: (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : undefined,
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
  let progressData = null;
  if (req.session.theme) {
    const hint = toggled.completed ? "activity_complete" : null;
    progressData = await syncProgress(req.user.id, req.session.theme, req.session.mentor, clientToday, hint, toggled.title);
  }
  const act = serializeActivity(toggled);
  res.json({
    ...act,
    progress: progressData,
  });
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

app.get("/manifest.json", (req, res) => {
  res.set("Content-Type", "application/manifest+json");
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.set("Content-Type", "application/javascript");
  res.set("Service-Worker-Allowed", "/");
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "sw.js"));
});

app.get("/", (req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "index.html"));
});

// Fallback to index.html for SPA behavior
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Daybook server listening on port ${PORT} (0.0.0.0)`);
    console.log(`Active Database Adapter: ${db.getBackendType()}`);
    if (db.getBackendType() === "supabase") {
      db.syncLocalDataToSupabase().catch((err) => {
        console.warn("[Database] Background initial sync to Supabase:", err.message);
      });
    }
  });
}

export default app;
export { app };
