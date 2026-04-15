/**
 * Database - sqlite3 (no native build needed on Windows)
 * Sync wrapper using better-sqlite3 style API via sqlite3
 */
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

const dbPath = process.env.DB_PATH || './data/db.sqlite';
const dir    = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new sqlite3.Database(dbPath);

// Run schema
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'My Device',
    activation_code TEXT,
    activated INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS device_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    ai_model TEXT DEFAULT 'gemini',
    api_key TEXT DEFAULT '',
    stt_provider TEXT DEFAULT 'groq',
    stt_api_key TEXT DEFAULT '',
    tts_provider TEXT DEFAULT 'edge',
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
  )`);

  // Platform-wide settings (admin configures once)
  db.run(`CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  )`);

  // Seed default platform settings
  const defaults = [
    ['ai_name',           'IndiChat'],
    ['ai_intro',          'I am IndiChat, your intelligent voice assistant.'],
    ['creator_name',      'IndiTech Corporation'],
    ['creator_intro',     'IndiTech Corporation builds smart AI-powered devices.'],
    ['groq_keys',         ''],
  ];
  defaults.forEach(([key, value]) => {
    db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)`, [key, value]);
  });
});

// ── Promisified helpers ───────────────────────────────────────────────
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { run, get, all, db };
