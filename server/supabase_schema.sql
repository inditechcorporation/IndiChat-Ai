-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  -- bcrypt hash, never plain text
  name TEXT DEFAULT '',
  is_admin INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'My Device',
  activation_code TEXT,
  activated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device config table
CREATE TABLE IF NOT EXISTS device_config (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  ai_model TEXT DEFAULT 'llama-3.1-8b-instant',
  api_key TEXT DEFAULT '',
  stt_provider TEXT DEFAULT 'groq',
  stt_api_key TEXT DEFAULT '',
  tts_provider TEXT DEFAULT 'groq',
  tts_api_key TEXT DEFAULT '',
  bot_name TEXT DEFAULT 'Assistant',
  bot_intro TEXT DEFAULT '',
  creator_name TEXT DEFAULT '',
  creator_intro TEXT DEFAULT '',
  speak_language TEXT DEFAULT 'en-US',
  caption_language TEXT DEFAULT 'en-US',
  voice_gender TEXT DEFAULT 'female',
  behavior TEXT DEFAULT '',
  max_words INTEGER DEFAULT 80,
  min_words INTEGER DEFAULT 10
);

-- Platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

-- Seed default platform settings
INSERT INTO platform_settings (key, value) VALUES
  ('ai_name',      'IndiChat'),
  ('ai_intro',     'I am IndiChat, your intelligent voice assistant.'),
  ('creator_name', 'IndiTech Corporation'),
  ('creator_intro','IndiTech Corporation builds smart AI-powered devices.')
ON CONFLICT (key) DO NOTHING;

-- Row Level Security (RLS) - disable for server-side access
ALTER TABLE users           DISABLE ROW LEVEL SECURITY;
ALTER TABLE devices         DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_config   DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;
