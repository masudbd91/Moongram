-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash      TEXT UNIQUE NOT NULL,         -- bcrypt hash, never raw
  firebase_uid    TEXT UNIQUE NOT NULL,
  first_name      TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 30),
  vibe_tags       TEXT[] NOT NULL DEFAULT '{}', -- exactly 3 tags
  availability    TEXT NOT NULL DEFAULT '1h',   -- '5m'|'30m'|'1h'|'evening'|'all_day'
  current_status  TEXT NOT NULL DEFAULT 'available', -- 'available'|'chatting'|'away'|'offline'
  device_fp       TEXT,                          -- device fingerprint for multi-account detection
  fcm_token       TEXT,                          -- push notification token
  ping_count      INTEGER DEFAULT 0,             -- hourly ping count (reset by cron)
  ping_reset_at   TIMESTAMPTZ DEFAULT NOW(),
  is_banned       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVE LOCATION SESSIONS (hot row — also mirrored in Redis)
-- ============================================================
CREATE TABLE IF NOT EXISTS active_sessions (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  location    GEOGRAPHY(POINT, 4326) NOT NULL,  -- (lng, lat)
  last_seen   TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index — required for ST_DWithin performance
CREATE INDEX IF NOT EXISTS idx_active_sessions_location
  ON active_sessions USING GIST(location);

-- ============================================================
-- PINGS (connection requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS pings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'accepted'|'declined'|'expired'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_ping CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_pings_receiver ON pings(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_pings_sender   ON pings(sender_id, created_at DESC);

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_id         UUID UNIQUE REFERENCES pings(id),
  user_a          UUID NOT NULL REFERENCES users(id),
  user_b          UUID NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'active', -- 'active'|'disconnected'|'extended'
  is_extended     BOOLEAN DEFAULT FALSE,
  extend_expires_at TIMESTAMPTZ,
  extend_vote_a   BOOLEAN DEFAULT FALSE,
  extend_vote_b   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_users
  ON chat_sessions(user_a, user_b, status);

-- ============================================================
-- MESSAGES (ephemeral — purged on session end)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  text        TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  is_flagged  BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, sent_at ASC);

-- ============================================================
-- BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES users(id),
  reported_id   UUID NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL,
  session_id    UUID REFERENCES chat_sessions(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTION: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
