/**
 * Auth Routes - Supabase Auth as primary store
 * Users register/login via Supabase Auth
 * Local SQLite only keeps user_id reference for device linking
 */
const express = require('express');
const jwt     = require('jsonwebtoken');
const { run, get } = require('../db');
const { createClient } = require('@supabase/supabase-js');
const router  = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'aarifali4012@gmail.com';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Ensure user exists in local SQLite (for device linking) ──────────
async function ensureLocalUser(sbUser) {
  const isAdmin = sbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 1 : 0;
  const existing = await get('SELECT * FROM users WHERE email = ?', [sbUser.email]);
  if (existing) {
    // Update is_admin if needed
    if (isAdmin && !existing.is_admin) {
      await run('UPDATE users SET is_admin=1 WHERE id=?', [existing.id]);
      existing.is_admin = 1;
    }
    return existing;
  }
  // Create local record
  const result = await run(
    'INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, ?)',
    [sbUser.email, 'supabase_auth', sbUser.user_metadata?.name || '', isAdmin]
  );
  return { id: result.lastID, email: sbUser.email, name: sbUser.user_metadata?.name || '', is_admin: isAdmin };
}

// ── POST /api/auth/register ───────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const supabase = getSupabase();

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || '' },
      email_confirm: true, // auto-confirm so they can login immediately
    });

    if (error) {
      if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      throw error;
    }

    const sbUser = data.user;
    const localUser = await ensureLocalUser(sbUser);
    const token = jwt.sign({ id: localUser.id, email, supabase_id: sbUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: { id: localUser.id, email, name: name || '', is_admin: localUser.is_admin }
    });
  } catch (e) {
    console.error('[Register]', e.message);
    res.status(500).json({ error: e.message || 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const supabase = getSupabase();

    // Verify credentials via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sbUser = data.user;
    const localUser = await ensureLocalUser(sbUser);
    const token = jwt.sign({ id: localUser.id, email, supabase_id: sbUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: { id: localUser.id, email, name: localUser.name || sbUser.user_metadata?.name || '', is_admin: localUser.is_admin }
    });
  } catch (e) {
    console.error('[Login]', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
