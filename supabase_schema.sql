-- ============================================================================
-- DAYBOOK - SUPABASE POSTGRESQL SCHEMA MIGRATION
-- ============================================================================
-- Run this script in your Supabase SQL Editor to set up the required tables.

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
  id BIGSERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  theme VARCHAR(50),
  mentor VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS public.activities (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '' NOT NULL,
  date VARCHAR(20) NOT NULL, -- Format: YYYY-MM-DD
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  time VARCHAR(30),
  priority BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  completed_at TIMESTAMPTZ
);

-- 4. QUESTS TABLE
CREATE TABLE IF NOT EXISTS public.quests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id BIGINT REFERENCES public.activities(id) ON DELETE SET NULL,
  quest_type VARCHAR(50) NOT NULL,
  theme VARCHAR(50) NOT NULL,
  title_text TEXT NOT NULL,
  target INTEGER DEFAULT 1 NOT NULL,
  status VARCHAR(30) DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  completed_at TIMESTAMPTZ
);

-- 5. BADGES TABLE
CREATE TABLE IF NOT EXISTS public.badges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_key VARCHAR(100) NOT NULL,
  theme VARCHAR(50) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. USER PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id BIGINT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  theme VARCHAR(50),
  mentor VARCHAR(50),
  streak_cached INTEGER DEFAULT 0 NOT NULL,
  mentor_event VARCHAR(50),
  mentor_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- INDEXES FOR HIGH-PERFORMANCE QUERYING
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON public.activities(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activities_user_completed ON public.activities(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_quests_user_status ON public.quests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_badges_user_id ON public.badges(user_id);

-- PERMISSIONS & ACCESS CONTROL
-- Ensure table access is open to the backend application connection
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.badges DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_progress DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.activities TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.quests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.badges TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_progress TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
