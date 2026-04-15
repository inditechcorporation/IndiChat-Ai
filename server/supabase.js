const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — using local SQLite only');
}

const supabase = (url && key) ? createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;

// ── Helpers matching existing db.js API ──────────────────────────────

async function run(sql, params = []) {
  // For Supabase we use the REST API via supabase-js
  // This is a passthrough — actual queries use supabase.from()
  // Keep for compatibility with routes that still use db.js
  const { db } = require('./db');
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function get(sql, params = []) {
  const { db } = require('./db');
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function all(sql, params = []) {
  const { db } = require('./db');
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ── Supabase sync helpers ─────────────────────────────────────────────
// After every user/device write, also sync to Supabase

async function syncUserToSupabase(user) {
  if (!supabase) return;
  try {
    await supabase.from('users').upsert({
      id:         user.id,
      email:      user.email,
      password:   user.password, // bcrypt hash only
      name:       user.name || '',
      is_admin:   user.is_admin || 0,
      created_at: user.created_at || new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (e) {
    console.error('[Supabase] syncUser error:', e.message);
  }
}

async function syncDeviceToSupabase(device) {
  if (!supabase) return;
  try {
    await supabase.from('devices').upsert({
      id:              device.id,
      user_id:         device.user_id,
      device_id:       device.device_id,
      name:            device.name,
      activation_code: device.activation_code,
      activated:       device.activated,
      created_at:      device.created_at || new Date().toISOString(),
    }, { onConflict: 'device_id' });
  } catch (e) {
    console.error('[Supabase] syncDevice error:', e.message);
  }
}

async function syncDeviceConfigToSupabase(config) {
  if (!supabase) return;
  try {
    // Never sync actual API keys to Supabase — store masked version
    const safe = { ...config };
    if (safe.api_key)     safe.api_key     = safe.api_key     ? '[ENCRYPTED]' : '';
    if (safe.stt_api_key) safe.stt_api_key = safe.stt_api_key ? '[ENCRYPTED]' : '';
    if (safe.tts_api_key) safe.tts_api_key = safe.tts_api_key ? '[ENCRYPTED]' : '';
    await supabase.from('device_config').upsert(safe, { onConflict: 'device_id' });
  } catch (e) {
    console.error('[Supabase] syncDeviceConfig error:', e.message);
  }
}

async function syncSettingsToSupabase(key, value) {
  if (!supabase) return;
  try {
    await supabase.from('platform_settings').upsert({ key, value }, { onConflict: 'key' });
  } catch (e) {
    console.error('[Supabase] syncSettings error:', e.message);
  }
}

module.exports = {
  supabase,
  run, get, all,
  syncUserToSupabase,
  syncDeviceToSupabase,
  syncDeviceConfigToSupabase,
  syncSettingsToSupabase,
};
