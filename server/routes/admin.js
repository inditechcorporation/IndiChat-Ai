const express = require('express');
const authMiddleware = require('../middleware/auth');
const { get, run, all } = require('../db');
const { syncSettingsToSupabase } = require('../supabase');
const { getStatus, reload } = require('../keyRotator');
const router = express.Router();

// ── Admin check middleware ────────────────────────────────────────────
const adminOnly = async (req, res, next) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// ── GET /api/admin/me ─────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Check by email first (most reliable)
    const adminEmail = process.env.ADMIN_EMAIL || 'aarifali40122@gmail.com';
    if (req.user?.email?.toLowerCase() === adminEmail.toLowerCase()) {
      return res.json({ is_admin: true });
    }
    const user = await get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
    res.json({ is_admin: !!(user && user.is_admin) });
  } catch (e) {
    res.json({ is_admin: false });
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────────────
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  const [activeDevices, totalDevices] = await Promise.all([
    get('SELECT COUNT(*) as c FROM devices WHERE activated = 1'),
    get('SELECT COUNT(*) as c FROM devices'),
  ]);

  let totalUsers = 0;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1 });
    totalUsers = data?.total || 0;
  } catch {
    const r = await get('SELECT COUNT(*) as c FROM users');
    totalUsers = r.c;
  }

  res.json({
    total_users:    totalUsers,
    active_devices: activeDevices.c,
    total_devices:  totalDevices.c,
    keys:           getStatus(),
  });
});

// ── GET /api/admin/users ──────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get all users from Supabase Auth
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    // Merge with local DB info (device count, is_admin)
    const localUsers = await all('SELECT * FROM users');
    const localMap = {};
    localUsers.forEach(u => { localMap[u.email] = u; });

    const users = data.users.map(u => ({
      id:           localMap[u.email]?.id || u.id,
      email:        u.email,
      name:         u.user_metadata?.name || localMap[u.email]?.name || '',
      is_admin:     localMap[u.email]?.is_admin || 0,
      device_count: 0, // will fill below
      created_at:   u.created_at,
      last_sign_in: u.last_sign_in_at,
    }));

    // Get device counts
    const deviceCounts = await all('SELECT user_id, COUNT(*) as c FROM devices GROUP BY user_id');
    const dcMap = {};
    deviceCounts.forEach(d => { dcMap[d.user_id] = d.c; });
    users.forEach(u => { u.device_count = dcMap[localMap[u.email]?.id] || 0; });

    res.json(users);
  } catch (e) {
    // Fallback to local DB
    const users = await all(`
      SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
             COUNT(d.id) as device_count
      FROM users u LEFT JOIN devices d ON d.user_id = u.id
      GROUP BY u.id ORDER BY u.created_at DESC
    `);
    res.json(users);
  }
});

// ── POST /api/admin/users/:id/toggle-admin ────────────────────────────
router.post('/users/:id/toggle-admin', authMiddleware, adminOnly, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await run('UPDATE users SET is_admin = ? WHERE id = ?', [user.is_admin ? 0 : 1, req.params.id]);
  res.json({ success: true, is_admin: !user.is_admin });
});

// ── POST /api/admin/users/:id/update-name ─────────────────────────────
router.post('/users/:id/update-name', authMiddleware, adminOnly, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
  res.json({ success: true, name: name.trim() });
});

// ── GET /api/admin/keys ───────────────────────────────────────────────
router.get('/keys', authMiddleware, adminOnly, (req, res) => {
  res.json({ keys: getStatus() });
});

// ── POST /api/admin/keys ──────────────────────────────────────────────
router.post('/keys', authMiddleware, adminOnly, async (req, res) => {
  const { keys } = req.body;
  if (!Array.isArray(keys)) return res.status(400).json({ error: 'keys must be array' });
  const valid = keys.map(k => k.trim()).filter(k => k.startsWith('gsk_'));
  if (!valid.length) return res.status(400).json({ error: 'No valid Groq keys' });

  const fs   = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '../.env');
  let env = fs.readFileSync(envPath, 'utf8');
  const newLine = `GROQ_API_KEY=${valid.join(',')}`;
  env = env.includes('GROQ_API_KEY=')
    ? env.replace(/GROQ_API_KEY=.*/, newLine)
    : env + `\n${newLine}`;
  fs.writeFileSync(envPath, env);
  process.env.GROQ_API_KEY = valid.join(',');
  reload();
  res.json({ success: true, count: valid.length, keys: getStatus() });
});

// ── GET /api/admin/settings ───────────────────────────────────────────
router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  const rows = await all('SELECT key, value FROM platform_settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// ── POST /api/admin/settings ──────────────────────────────────────────
router.post('/settings', authMiddleware, adminOnly, async (req, res) => {
  const allowed = ['ai_name', 'ai_intro', 'creator_name', 'creator_intro'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      await run('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)',
        [key, req.body[key]]);
      syncSettingsToSupabase(key, req.body[key]);
    }
  }
  res.json({ success: true });
});

// ── GET /api/admin/platform-identity (public - for chat to use) ───────
router.get('/platform-identity', async (req, res) => {
  const rows = await all('SELECT key, value FROM platform_settings WHERE key IN (?,?,?,?)',
    ['ai_name', 'ai_intro', 'creator_name', 'creator_intro']);
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  res.json({
    ai_name:      s.ai_name      || 'IndiChat',
    ai_intro:     s.ai_intro     || 'I am IndiChat, your intelligent voice assistant.',
    creator_name: s.creator_name || 'IndiTech Corporation',
    creator_intro:s.creator_intro|| 'IndiTech Corporation builds smart AI-powered devices.',
  });
});

module.exports = router;
