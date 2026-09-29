// ============================================================================
// DAYBOOK - DATABASE ADAPTER & SUPABASE POSTGRESQL LAYER
// ============================================================================
// Supports:
// 1. Live Supabase via @supabase/supabase-js (SUPABASE_URL & SUPABASE_KEY)
// 2. Direct PostgreSQL via pg Pool (SUPABASE_DB_URL / DATABASE_URL)
// 3. Graceful fallback to local JSON database when environment variables are not yet configured

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? path.join("/tmp", "daybook_data") : path.join(__dirname, "data"));
const DB_FILE = path.join(DATA_DIR, "daybook_db.json");
const BUNDLED_DB_FILE = path.join(__dirname, "data", "daybook_db.json");

// Environment variables
function sanitizeSupabaseUrl(url) {
  if (!url) return null;
  let clean = url.trim().replace(/\/+$/, "");
  clean = clean.replace(/\/rest\/v1\/?$/i, "");
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  return clean;
}

const rawSupabaseUrl = process.env.SUPABASE_URL;
const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const postgresUrl = (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();

let supabaseClient = null;
let pgPool = null;
let activeBackend = "local"; // 'supabase' | 'pg' | 'local'

// Lazy client initializers
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (supabaseUrl && supabaseKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      activeBackend = "supabase";
      console.log("[Database] Connected to Supabase PostgreSQL via Supabase Client");
      return supabaseClient;
    } catch (err) {
      console.error("[Database] Error initializing Supabase client:", err);
    }
  }
  return null;
}

function getPgPool() {
  if (pgPool) return pgPool;
  if (postgresUrl) {
    try {
      pgPool = new pg.Pool({
        connectionString: postgresUrl,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
      });
      activeBackend = "pg";
      console.log("[Database] Connected to Supabase PostgreSQL via pg Pool");
      return pgPool;
    } catch (err) {
      console.error("[Database] Error initializing PostgreSQL pool:", err);
    }
  }
  return null;
}

// Local Fallback Storage
let localDb = {
  users: {
    1: { id: 1, username: "user1", password: "demo1234" },
  },
  sessions: [],
  activities: [],
  quests: [],
  badges: [],
  progress: {},
  nextUserId: 2,
  nextActivityId: 1,
  nextQuestId: 1,
  nextBadgeId: 1,
};

function loadLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const targetToRead = fs.existsSync(DB_FILE) ? DB_FILE : (fs.existsSync(BUNDLED_DB_FILE) ? BUNDLED_DB_FILE : null);
    if (targetToRead) {
      const raw = fs.readFileSync(targetToRead, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.users) localDb.users = parsed.users;
      if (Array.isArray(parsed.activities)) localDb.activities = parsed.activities;
      if (Array.isArray(parsed.quests)) localDb.quests = parsed.quests;
      if (Array.isArray(parsed.badges)) localDb.badges = parsed.badges;
      if (parsed.progress) localDb.progress = parsed.progress;
      if (Array.isArray(parsed.sessions)) localDb.sessions = parsed.sessions;
      if (parsed.nextUserId) localDb.nextUserId = parsed.nextUserId;
      if (parsed.nextActivityId) localDb.nextActivityId = parsed.nextActivityId;
      if (parsed.nextQuestId) localDb.nextQuestId = parsed.nextQuestId;
      if (parsed.nextBadgeId) localDb.nextBadgeId = parsed.nextBadgeId;
    }
  } catch (err) {
    console.error("[Database] Error loading local file db:", err);
  }
}

function saveLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), "utf-8");
  } catch (err) {
    console.error("[Database] Error saving local file db:", err);
  }
}

loadLocalDb();

// Determine and log backend on load
const client = getSupabaseClient();
const pool = !client ? getPgPool() : null;
if (!client && !pool) {
  console.log("[Database] Supabase credentials not set in environment; using local database storage.");
  console.log("[Database] To connect to Supabase PostgreSQL, set SUPABASE_URL and SUPABASE_KEY in Settings.");
}

// ============================================================================
// UNIFIED DATABASE OPERATIONS
// ============================================================================

export const db = {
  getBackendType() {
    if (supabaseClient) return "supabase";
    if (pgPool) return "postgresql";
    return "local";
  },

  // USERS
  async findUserByUsername(username) {
    const clean = (username || "").trim().toLowerCase();
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("users")
          .select("*")
          .ilike("username", clean)
          .maybeSingle();
        if (error) throw error;
        return data || null;
      } catch (err) {
        console.error("[Database] Supabase findUserByUsername error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query("SELECT * FROM public.users WHERE LOWER(username) = $1 LIMIT 1", [clean]);
        return res.rows[0] || null;
      } catch (err) {
        console.error("[Database] PG findUserByUsername error, falling back:", err.message);
      }
    }

    return Object.values(localDb.users).find((u) => u.username.toLowerCase() === clean) || null;
  },

  async findUserById(id) {
    const numId = Number(id);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("users")
          .select("*")
          .eq("id", numId)
          .maybeSingle();
        if (error) throw error;
        return data || null;
      } catch (err) {
        console.error("[Database] Supabase findUserById error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query("SELECT * FROM public.users WHERE id = $1 LIMIT 1", [numId]);
        return res.rows[0] || null;
      } catch (err) {
        console.error("[Database] PG findUserById error, falling back:", err.message);
      }
    }

    return localDb.users[numId] || null;
  },

  async createUser({ username, password }) {
    const clean = (username || "").trim();
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("users")
          .insert({ username: clean, password: String(password) })
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("[Database] Supabase createUser error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          "INSERT INTO public.users (username, password) VALUES ($1, $2) RETURNING *",
          [clean, String(password)]
        );
        return res.rows[0];
      } catch (err) {
        console.error("[Database] PG createUser error, falling back:", err.message);
      }
    }

    const newId = localDb.nextUserId++;
    const newUser = { id: newId, username: clean, password: String(password) };
    localDb.users[newId] = newUser;
    saveLocalDb();
    return newUser;
  },

  // SESSIONS
  async findSession(token) {
    if (!token) return null;
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("sessions")
          .select("*")
          .eq("token", token)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            token: data.token,
            userId: Number(data.user_id),
            theme: data.theme,
            mentor: data.mentor,
          };
        }
        return null;
      } catch (err) {
        console.error("[Database] Supabase findSession error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query("SELECT * FROM public.sessions WHERE token = $1 LIMIT 1", [token]);
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            token: row.token,
            userId: Number(row.user_id),
            theme: row.theme,
            mentor: row.mentor,
          };
        }
        return null;
      } catch (err) {
        console.error("[Database] PG findSession error, falling back:", err.message);
      }
    }

    const found = localDb.sessions.find((s) => s.token === token);
    return found || null;
  },

  async createSession({ token, userId, theme = null, mentor = null }) {
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("sessions")
          .insert({
            token,
            user_id: userId,
            theme,
            mentor,
          })
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          token: data.token,
          userId: Number(data.user_id),
          theme: data.theme,
          mentor: data.mentor,
        };
      } catch (err) {
        console.error("[Database] Supabase createSession error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          "INSERT INTO public.sessions (token, user_id, theme, mentor) VALUES ($1, $2, $3, $4) RETURNING *",
          [token, userId, theme, mentor]
        );
        const row = res.rows[0];
        return {
          id: row.id,
          token: row.token,
          userId: Number(row.user_id),
          theme: row.theme,
          mentor: row.mentor,
        };
      } catch (err) {
        console.error("[Database] PG createSession error, falling back:", err.message);
      }
    }

    const session = {
      id: localDb.sessions.length + 1,
      token,
      userId,
      theme,
      mentor,
    };
    localDb.sessions.push(session);
    saveLocalDb();
    return session;
  },

  async updateSession(token, { theme, mentor }) {
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const updates = {};
        if (theme !== undefined) updates.theme = theme;
        if (mentor !== undefined) updates.mentor = mentor;
        const { data, error } = await sb
          .from("sessions")
          .update(updates)
          .eq("token", token)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            token: data.token,
            userId: Number(data.user_id),
            theme: data.theme,
            mentor: data.mentor,
          };
        }
      } catch (err) {
        console.error("[Database] Supabase updateSession error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          "UPDATE public.sessions SET theme = COALESCE($1, theme), mentor = COALESCE($2, mentor) WHERE token = $3 RETURNING *",
          [theme, mentor, token]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            token: row.token,
            userId: Number(row.user_id),
            theme: row.theme,
            mentor: row.mentor,
          };
        }
      } catch (err) {
        console.error("[Database] PG updateSession error, falling back:", err.message);
      }
    }

    const s = localDb.sessions.find((item) => item.token === token);
    if (s) {
      if (theme !== undefined) s.theme = theme;
      if (mentor !== undefined) s.mentor = mentor;
      saveLocalDb();
      return s;
    }
    return null;
  },

  async deleteSession(token) {
    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.from("sessions").delete().eq("token", token);
      } catch (err) {
        console.error("[Database] Supabase deleteSession error:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        await pgClient.query("DELETE FROM public.sessions WHERE token = $1", [token]);
      } catch (err) {
        console.error("[Database] PG deleteSession error:", err.message);
      }
    }

    const idx = localDb.sessions.findIndex((s) => s.token === token);
    if (idx !== -1) {
      localDb.sessions.splice(idx, 1);
      saveLocalDb();
    }
    return true;
  },

  // ACTIVITIES
  async getActivities(userId, queryFilter = "") {
    const numUserId = Number(userId);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        let req = sb
          .from("activities")
          .select("*")
          .eq("user_id", numUserId)
          .order("id", { ascending: false });

        if (queryFilter) {
          req = req.or(`title.ilike.%${queryFilter}%,notes.ilike.%${queryFilter}%`);
        }
        const { data, error } = await req;
        if (error) throw error;
        return (data || []).map((row) => ({
          id: row.id,
          userId: Number(row.user_id),
          title: row.title,
          notes: row.notes || "",
          date: row.date,
          completed: !!row.completed,
          time: row.time || null,
          priority: !!row.priority,
          createdAt: row.created_at,
          completedAt: row.completed_at || null,
        }));
      } catch (err) {
        console.error("[Database] Supabase getActivities error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        let sql = "SELECT * FROM public.activities WHERE user_id = $1";
        const params = [numUserId];
        if (queryFilter) {
          sql += " AND (title ILIKE $2 OR notes ILIKE $2)";
          params.push(`%${queryFilter}%`);
        }
        sql += " ORDER BY id DESC";
        const res = await pgClient.query(sql, params);
        return res.rows.map((row) => ({
          id: row.id,
          userId: Number(row.user_id),
          title: row.title,
          notes: row.notes || "",
          date: row.date,
          completed: !!row.completed,
          time: row.time || null,
          priority: !!row.priority,
          createdAt: row.created_at,
          completedAt: row.completed_at || null,
        }));
      } catch (err) {
        console.error("[Database] PG getActivities error, falling back:", err.message);
      }
    }

    let list = localDb.activities.filter((a) => a.userId === numUserId).sort((a, b) => b.id - a.id);
    if (queryFilter) {
      const needle = queryFilter.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(needle) || (a.notes || "").toLowerCase().includes(needle));
    }
    return list;
  },

  async getActivityById(id, userId) {
    const numId = Number(id);
    const numUserId = Number(userId);

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("activities")
          .select("*")
          .eq("id", numId)
          .eq("user_id", numUserId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          return {
            id: data.id,
            userId: Number(data.user_id),
            title: data.title,
            notes: data.notes || "",
            date: data.date,
            completed: !!data.completed,
            time: data.time || null,
            priority: !!data.priority,
            createdAt: data.created_at,
            completedAt: data.completed_at || null,
          };
        }
        return null;
      } catch (err) {
        console.error("[Database] Supabase getActivityById error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          "SELECT * FROM public.activities WHERE id = $1 AND user_id = $2 LIMIT 1",
          [numId, numUserId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            userId: Number(row.user_id),
            title: row.title,
            notes: row.notes || "",
            date: row.date,
            completed: !!row.completed,
            time: row.time || null,
            priority: !!row.priority,
            createdAt: row.created_at,
            completedAt: row.completed_at || null,
          };
        }
        return null;
      } catch (err) {
        console.error("[Database] PG getActivityById error, falling back:", err.message);
      }
    }

    return localDb.activities.find((a) => a.id === numId && a.userId === numUserId) || null;
  },

  async createActivity({ userId, title, notes = "", date, priority = false }) {
    const numUserId = Number(userId);
    const now = new Date().toISOString();

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("activities")
          .insert({
            user_id: numUserId,
            title: title.trim(),
            notes: (notes || "").trim(),
            date,
            priority: !!priority,
            completed: false,
            created_at: now,
          })
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          userId: Number(data.user_id),
          title: data.title,
          notes: data.notes || "",
          date: data.date,
          completed: !!data.completed,
          time: data.time || null,
          priority: !!data.priority,
          createdAt: data.created_at,
          completedAt: data.completed_at || null,
        };
      } catch (err) {
        console.error("[Database] Supabase createActivity error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          `INSERT INTO public.activities (user_id, title, notes, date, priority, completed, created_at)
           VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING *`,
          [numUserId, title.trim(), (notes || "").trim(), date, !!priority, now]
        );
        const row = res.rows[0];
        return {
          id: row.id,
          userId: Number(row.user_id),
          title: row.title,
          notes: row.notes || "",
          date: row.date,
          completed: !!row.completed,
          time: row.time || null,
          priority: !!row.priority,
          createdAt: row.created_at,
          completedAt: row.completed_at || null,
        };
      } catch (err) {
        console.error("[Database] PG createActivity error, falling back:", err.message);
      }
    }

    const activity = {
      id: localDb.nextActivityId++,
      userId: numUserId,
      title: title.trim(),
      notes: (notes || "").trim(),
      date,
      completed: false,
      time: null,
      priority: !!priority,
      createdAt: now,
      completedAt: null,
    };
    localDb.activities.push(activity);
    saveLocalDb();
    return activity;
  },

  async updateActivity(id, userId, { title, notes, priority, date }) {
    const numId = Number(id);
    const numUserId = Number(userId);

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (notes !== undefined) updates.notes = (notes || "").trim();
        if (priority !== undefined) updates.priority = !!priority;
        if (date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date)) updates.date = date;

        const { data, error } = await sb
          .from("activities")
          .update(updates)
          .eq("id", numId)
          .eq("user_id", numUserId)
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          userId: Number(data.user_id),
          title: data.title,
          notes: data.notes || "",
          date: data.date,
          completed: !!data.completed,
          time: data.time || null,
          priority: !!data.priority,
          createdAt: data.created_at,
          completedAt: data.completed_at || null,
        };
      } catch (err) {
        console.error("[Database] Supabase updateActivity error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const cleanDate = (date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : null;
        const res = await pgClient.query(
          `UPDATE public.activities 
           SET title = COALESCE($1, title), notes = COALESCE($2, notes), priority = COALESCE($3, priority), date = COALESCE($4, date)
           WHERE id = $5 AND user_id = $6 RETURNING *`,
          [title?.trim(), notes?.trim(), priority !== undefined ? !!priority : null, cleanDate, numId, numUserId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            userId: Number(row.user_id),
            title: row.title,
            notes: row.notes || "",
            date: row.date,
            completed: !!row.completed,
            time: row.time || null,
            priority: !!row.priority,
            createdAt: row.created_at,
            completedAt: row.completed_at || null,
          };
        }
      } catch (err) {
        console.error("[Database] PG updateActivity error, falling back:", err.message);
      }
    }

    const act = localDb.activities.find((a) => a.id === numId && a.userId === numUserId);
    if (act) {
      if (title !== undefined) act.title = title.trim();
      if (notes !== undefined) act.notes = (notes || "").trim();
      if (priority !== undefined) act.priority = !!priority;
      if (date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date)) act.date = date;
      saveLocalDb();
      return act;
    }
    return null;
  },

  async toggleActivity(id, userId, formattedTime) {
    const numId = Number(id);
    const numUserId = Number(userId);

    const current = await this.getActivityById(numId, numUserId);
    if (!current) return null;

    const nextCompleted = !current.completed;
    const completedAt = nextCompleted ? new Date().toISOString() : null;
    const timeVal = nextCompleted ? formattedTime : null;

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("activities")
          .update({
            completed: nextCompleted,
            completed_at: completedAt,
            time: timeVal,
          })
          .eq("id", numId)
          .eq("user_id", numUserId)
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          userId: Number(data.user_id),
          title: data.title,
          notes: data.notes || "",
          date: data.date,
          completed: !!data.completed,
          time: data.time || null,
          priority: !!data.priority,
          createdAt: data.created_at,
          completedAt: data.completed_at || null,
        };
      } catch (err) {
        console.error("[Database] Supabase toggleActivity error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          `UPDATE public.activities
           SET completed = $1, completed_at = $2, time = $3
           WHERE id = $4 AND user_id = $5 RETURNING *`,
          [nextCompleted, completedAt, timeVal, numId, numUserId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            id: row.id,
            userId: Number(row.user_id),
            title: row.title,
            notes: row.notes || "",
            date: row.date,
            completed: !!row.completed,
            time: row.time || null,
            priority: !!row.priority,
            createdAt: row.created_at,
            completedAt: row.completed_at || null,
          };
        }
      } catch (err) {
        console.error("[Database] PG toggleActivity error, falling back:", err.message);
      }
    }

    const act = localDb.activities.find((a) => a.id === numId && a.userId === numUserId);
    if (act) {
      act.completed = nextCompleted;
      act.completedAt = completedAt;
      act.time = timeVal;
      saveLocalDb();
      return act;
    }
    return null;
  },

  async deleteActivity(id, userId) {
    const numId = Number(id);
    const numUserId = Number(userId);

    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.from("quests").delete().eq("activity_id", numId);
        await sb.from("activities").delete().eq("id", numId).eq("user_id", numUserId);
      } catch (err) {
        console.error("[Database] Supabase deleteActivity error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        await pgClient.query("DELETE FROM public.quests WHERE activity_id = $1", [numId]);
        await pgClient.query("DELETE FROM public.activities WHERE id = $1 AND user_id = $2", [numId, numUserId]);
      } catch (err) {
        console.error("[Database] PG deleteActivity error, falling back:", err.message);
      }
    }

    localDb.quests = localDb.quests.filter((q) => q.activityId !== numId);
    const idx = localDb.activities.findIndex((a) => a.id === numId && a.userId === numUserId);
    if (idx !== -1) {
      localDb.activities.splice(idx, 1);
      saveLocalDb();
    }
    return true;
  },

  // QUESTS
  async getQuests(userId) {
    const numUserId = Number(userId);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("quests")
          .select("*")
          .eq("user_id", numUserId)
          .order("id", { ascending: false });
        if (error) throw error;
        return (data || []).map((row) => ({
          id: row.id,
          userId: Number(row.user_id),
          activityId: row.activity_id ? Number(row.activity_id) : null,
          questType: row.quest_type,
          theme: row.theme,
          titleText: row.title_text,
          target: row.target,
          status: row.status,
          createdAt: row.created_at,
          completedAt: row.completed_at || null,
        }));
      } catch (err) {
        console.error("[Database] Supabase getQuests error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query("SELECT * FROM public.quests WHERE user_id = $1 ORDER BY id DESC", [numUserId]);
        return res.rows.map((row) => ({
          id: row.id,
          userId: Number(row.user_id),
          activityId: row.activity_id ? Number(row.activity_id) : null,
          questType: row.quest_type,
          theme: row.theme,
          titleText: row.title_text,
          target: row.target,
          status: row.status,
          createdAt: row.created_at,
          completedAt: row.completed_at || null,
        }));
      } catch (err) {
        console.error("[Database] PG getQuests error, falling back:", err.message);
      }
    }

    return localDb.quests.filter((q) => q.userId === numUserId).sort((a, b) => b.id - a.id);
  },

  async createQuest({ userId, activityId = null, questType, theme, titleText, target = 1 }) {
    const numUserId = Number(userId);
    const now = new Date().toISOString();

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("quests")
          .insert({
            user_id: numUserId,
            activity_id: activityId ? Number(activityId) : null,
            quest_type: questType,
            theme,
            title_text: titleText,
            target,
            status: "active",
            created_at: now,
          })
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          userId: Number(data.user_id),
          activityId: data.activity_id ? Number(data.activity_id) : null,
          questType: data.quest_type,
          theme: data.theme,
          titleText: data.title_text,
          target: data.target,
          status: data.status,
          createdAt: data.created_at,
          completedAt: data.completed_at || null,
        };
      } catch (err) {
        console.error("[Database] Supabase createQuest error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          `INSERT INTO public.quests (user_id, activity_id, quest_type, theme, title_text, target, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) RETURNING *`,
          [numUserId, activityId ? Number(activityId) : null, questType, theme, titleText, target, now]
        );
        const row = res.rows[0];
        return {
          id: row.id,
          userId: Number(row.user_id),
          activityId: row.activity_id ? Number(row.activity_id) : null,
          questType: row.quest_type,
          theme: row.theme,
          titleText: row.title_text,
          target: row.target,
          status: row.status,
          createdAt: row.created_at,
          completedAt: row.completed_at || null,
        };
      } catch (err) {
        console.error("[Database] PG createQuest error, falling back:", err.message);
      }
    }

    const quest = {
      id: localDb.nextQuestId++,
      userId: numUserId,
      activityId: activityId ? Number(activityId) : null,
      questType,
      theme,
      titleText,
      target,
      status: "active",
      createdAt: now,
      completedAt: null,
    };
    localDb.quests.push(quest);
    saveLocalDb();
    return quest;
  },

  async updateQuest(id, { status, completedAt }) {
    const numId = Number(id);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const updates = {};
        if (status !== undefined) updates.status = status;
        if (completedAt !== undefined) updates.completed_at = completedAt;
        const { data, error } = await sb
          .from("quests")
          .update(updates)
          .eq("id", numId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("[Database] Supabase updateQuest error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          "UPDATE public.quests SET status = COALESCE($1, status), completed_at = COALESCE($2, completed_at) WHERE id = $3 RETURNING *",
          [status, completedAt, numId]
        );
        return res.rows[0];
      } catch (err) {
        console.error("[Database] PG updateQuest error, falling back:", err.message);
      }
    }

    const q = localDb.quests.find((item) => item.id === numId);
    if (q) {
      if (status !== undefined) q.status = status;
      if (completedAt !== undefined) q.completedAt = completedAt;
      saveLocalDb();
      return q;
    }
    return null;
  },

  // BADGES
  async getBadges(userId) {
    const numUserId = Number(userId);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("badges")
          .select("*")
          .eq("user_id", numUserId)
          .order("id", { ascending: false });
        if (error) throw error;
        return (data || []).map((row) => ({
          id: row.id,
          userId: Number(row.user_id),
          badgeKey: row.badge_key,
          theme: row.theme,
          earnedAt: row.earned_at,
        }));
      } catch (err) {
        console.error("[Database] Supabase getBadges error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query("SELECT * FROM public.badges WHERE user_id = $1 ORDER BY id DESC", [numUserId]);
        return res.rows.map((row) => ({
          id: row.id,
          userId: Number(row.user_id),
          badgeKey: row.badge_key,
          theme: row.theme,
          earnedAt: row.earned_at,
        }));
      } catch (err) {
        console.error("[Database] PG getBadges error, falling back:", err.message);
      }
    }

    return localDb.badges.filter((b) => b.userId === numUserId).sort((a, b) => b.id - a.id);
  },

  async createBadge({ userId, badgeKey, theme }) {
    const numUserId = Number(userId);
    const now = new Date().toISOString();

    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("badges")
          .insert({
            user_id: numUserId,
            badge_key: badgeKey,
            theme,
            earned_at: now,
          })
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          userId: Number(data.user_id),
          badgeKey: data.badge_key,
          theme: data.theme,
          earnedAt: data.earned_at,
        };
      } catch (err) {
        console.error("[Database] Supabase createBadge error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query(
          "INSERT INTO public.badges (user_id, badge_key, theme, earned_at) VALUES ($1, $2, $3, $4) RETURNING *",
          [numUserId, badgeKey, theme, now]
        );
        const row = res.rows[0];
        return {
          id: row.id,
          userId: Number(row.user_id),
          badgeKey: row.badge_key,
          theme: row.theme,
          earnedAt: row.earned_at,
        };
      } catch (err) {
        console.error("[Database] PG createBadge error, falling back:", err.message);
      }
    }

    const badge = {
      id: localDb.nextBadgeId++,
      userId: numUserId,
      badgeKey,
      theme,
      earnedAt: now,
    };
    localDb.badges.push(badge);
    saveLocalDb();
    return badge;
  },

  // USER PROGRESS
  async getUserProgress(userId) {
    const numUserId = Number(userId);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("user_progress")
          .select("*")
          .eq("user_id", numUserId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          return {
            userId: Number(data.user_id),
            xp: data.xp,
            level: data.level,
            theme: data.theme,
            mentor: data.mentor,
            streakCached: data.streak_cached,
            mentorEvent: data.mentor_event,
            mentorText: data.mentor_text,
          };
        }
      } catch (err) {
        console.error("[Database] Supabase getUserProgress error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        const res = await pgClient.query("SELECT * FROM public.user_progress WHERE user_id = $1 LIMIT 1", [numUserId]);
        if (res.rows[0]) {
          const row = res.rows[0];
          return {
            userId: Number(row.user_id),
            xp: row.xp,
            level: row.level,
            theme: row.theme,
            mentor: row.mentor,
            streakCached: row.streak_cached,
            mentorEvent: row.mentor_event,
            mentorText: row.mentor_text,
          };
        }
      } catch (err) {
        console.error("[Database] PG getUserProgress error, falling back:", err.message);
      }
    }

    return localDb.progress[numUserId] || null;
  },

  async saveUserProgress(userId, progressData) {
    const numUserId = Number(userId);
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const payload = {
          user_id: numUserId,
          xp: progressData.xp ?? 0,
          level: progressData.level ?? 1,
          theme: progressData.theme || null,
          mentor: progressData.mentor || null,
          streak_cached: progressData.streakCached ?? 0,
          mentor_event: progressData.mentorEvent || null,
          mentor_text: progressData.mentorText || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await sb
          .from("user_progress")
          .upsert(payload, { onConflict: "user_id" });
        if (error) throw error;
      } catch (err) {
        console.error("[Database] Supabase saveUserProgress error, falling back:", err.message);
      }
    }

    const pgClient = getPgPool();
    if (pgClient) {
      try {
        await pgClient.query(
          `INSERT INTO public.user_progress (user_id, xp, level, theme, mentor, streak_cached, mentor_event, mentor_text, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             xp = EXCLUDED.xp,
             level = EXCLUDED.level,
             theme = EXCLUDED.theme,
             mentor = EXCLUDED.mentor,
             streak_cached = EXCLUDED.streak_cached,
             mentor_event = EXCLUDED.mentor_event,
             mentor_text = EXCLUDED.mentor_text,
             updated_at = NOW()`,
          [
            numUserId,
            progressData.xp ?? 0,
            progressData.level ?? 1,
            progressData.theme || null,
            progressData.mentor || null,
            progressData.streakCached ?? 0,
            progressData.mentorEvent || null,
            progressData.mentorText || null,
          ]
        );
      } catch (err) {
        console.error("[Database] PG saveUserProgress error, falling back:", err.message);
      }
    }

    localDb.progress[numUserId] = {
      userId: numUserId,
      xp: progressData.xp,
      level: progressData.level,
      theme: progressData.theme,
      mentor: progressData.mentor,
      streakCached: progressData.streakCached,
      mentorEvent: progressData.mentorEvent,
      mentorText: progressData.mentorText,
    };
    saveLocalDb();
    return localDb.progress[numUserId];
  },

  // AUTOMATED DATA MIGRATION TO SUPABASE
  async syncLocalDataToSupabase() {
    const sb = getSupabaseClient();
    if (!sb) return false;
    try {
      console.log("[Database] Checking if Supabase database requires initial sync...");
      // 1. Sync users
      for (const u of Object.values(localDb.users)) {
        await sb.from("users").upsert({
          id: u.id,
          username: u.username,
          password: u.password,
        }, { onConflict: "username" });
      }

      // 2. Sync activities
      for (const a of localDb.activities) {
        await sb.from("activities").upsert({
          id: a.id,
          user_id: a.userId,
          title: a.title,
          notes: a.notes || "",
          date: a.date,
          completed: !!a.completed,
          time: a.time,
          priority: !!a.priority,
          created_at: a.createdAt,
          completed_at: a.completedAt,
        }, { onConflict: "id" });
      }

      // 3. Sync quests
      for (const q of localDb.quests) {
        await sb.from("quests").upsert({
          id: q.id,
          user_id: q.userId,
          activity_id: q.activityId || null,
          quest_type: q.questType,
          theme: q.theme,
          title_text: q.titleText,
          target: q.target,
          status: q.status,
          created_at: q.createdAt,
          completed_at: q.completedAt,
        }, { onConflict: "id" });
      }

      // 4. Sync badges
      for (const b of localDb.badges) {
        await sb.from("badges").upsert({
          id: b.id,
          user_id: b.userId,
          badge_key: b.badgeKey,
          theme: b.theme,
          earned_at: b.earnedAt,
        }, { onConflict: "id" });
      }

      // 5. Sync user progress
      for (const [uid, p] of Object.entries(localDb.progress)) {
        await sb.from("user_progress").upsert({
          user_id: Number(uid),
          xp: p.xp || 0,
          level: p.level || 1,
          theme: p.theme || null,
          mentor: p.mentor || null,
          streak_cached: p.streakCached || 0,
          mentor_event: p.mentorEvent || null,
          mentor_text: p.mentorText || null,
        }, { onConflict: "user_id" });
      }
      console.log("[Database] Local data synced to Supabase successfully.");
      return true;
    } catch (err) {
      console.error("[Database] Migration to Supabase encountered notice:", err.message);
      return false;
    }
  },

  async testConnection() {
    const backend = this.getBackendType();
    if (backend === "supabase") {
      const sb = getSupabaseClient();
      if (!sb) {
        return {
          connected: false,
          backend: "supabase",
          message: "Supabase client failed to initialize with provided credentials.",
        };
      }
      try {
        const { data, error, status } = await sb.from("users").select("id").limit(1);
        if (error) {
          return {
            connected: false,
            backend: "supabase",
            status,
            error: error.message,
            code: error.code,
            details: error.details,
            hint: (error.message.includes("relation") || error.code === "42P01" || error.code === "PGRST204" || error.code === "PGRST205"
              ? "Tables do not exist yet in your Supabase project. Please run supabase_schema.sql in your Supabase project's SQL Editor to create the tables."
              : error.hint || "Check your SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY."),
          };
        }
        return {
          connected: true,
          backend: "supabase",
          message: "Successfully connected to Supabase PostgreSQL database!",
          status,
          verifiedTable: "users",
        };
      } catch (err) {
        return {
          connected: false,
          backend: "supabase",
          error: err.message,
        };
      }
    } else if (backend === "pg") {
      const pool = getPgPool();
      if (!pool) {
        return {
          connected: false,
          backend: "pg",
          message: "PostgreSQL pool failed to initialize with DATABASE_URL.",
        };
      }
      try {
        const res = await pool.query("SELECT NOW() as current_time, current_database() as db_name");
        return {
          connected: true,
          backend: "pg",
          message: "Successfully connected to PostgreSQL database via pool!",
          data: res.rows[0],
        };
      } catch (err) {
        return {
          connected: false,
          backend: "pg",
          error: err.message,
        };
      }
    } else {
      return {
        connected: true,
        backend: "local",
        message: "Supabase environment variables (SUPABASE_URL and SUPABASE_KEY) are not set. The application is running on local storage.",
      };
    }
  },
};
