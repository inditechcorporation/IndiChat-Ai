const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { get } = require('../db');
const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'aarifali4012@gmail.com';
const SITE_URL    = process.env.SITE_URL    || 'http://localhost:5173';

function sbAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

function sbAnon() {
  // anon key for user-facing auth flows (sends actual emails via SMTP)
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

const adminOnly = async (req, res, next) => {
  const isAdminEmail = req.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (!isAdminEmail) {
    const u = await get('SELECT is_admin FROM users WHERE id=?', [req.user.id]);
    if (!u?.is_admin) return res.status(403).json({ error: 'Admin only' });
  }
  next();
};

// ── POST /api/auth-sb/reset-password ─────────────────────────────────
// Sends actual email via Supabase SMTP
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  // Check user exists in local DB
  const user = await get('SELECT * FROM users WHERE email=?', [email.toLowerCase().trim()]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    // resetPasswordForEmail actually sends the email via configured SMTP
    const sb = sbAnon();
    const { error } = await sb.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error('[Reset password]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth-sb/magic-link ──────────────────────────────────────
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await get('SELECT * FROM users WHERE email=?', [email.toLowerCase().trim()]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    // signInWithOtp sends actual magic link email
    const sb = sbAnon();
    const { error } = await sb.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: `${SITE_URL}/magic-login` },
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error('[Magic link]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth-sb/magic-verify ───────────────────────────────────
router.post('/magic-verify', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token required' });
  try {
    const sb = sbAdmin();
    const { data: { user }, error } = await sb.auth.getUser(access_token);
    if (error || !user) throw new Error('Invalid token');

    const { run } = require('../db');
    const bcrypt  = require('bcryptjs');
    const jwt     = require('jsonwebtoken');

    let localUser = await get('SELECT * FROM users WHERE email=?', [user.email]);
    if (!localUser) {
      const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 1 : 0;
      const result  = await run('INSERT INTO users (email,password,name,is_admin) VALUES (?,?,?,?)',
        [user.email, 'supabase_auth', user.user_metadata?.name || '', isAdmin]);
      localUser = { id: result.lastID, email: user.email, name: '', is_admin: isAdmin };
    }
    const token = jwt.sign({ id: localUser.id, email: localUser.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: localUser.id, email: localUser.email, name: localUser.name, is_admin: localUser.is_admin } });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

// ── POST /api/auth-sb/do-reset-password ──────────────────────────────
router.post('/do-reset-password', async (req, res) => {
  const { access_token, new_password } = req.body;
  if (!access_token || !new_password) return res.status(400).json({ error: 'access_token and new_password required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const sb = sbAdmin();
    const { data: { user }, error: userErr } = await sb.auth.getUser(access_token);
    if (userErr || !user) throw new Error('Invalid or expired token');

    const { error } = await sb.auth.admin.updateUserById(user.id, { password: new_password });
    if (error) throw error;

    // Update local DB too
    const bcrypt = require('bcryptjs');
    const { run } = require('../db');
    await run('UPDATE users SET password=? WHERE email=?', [bcrypt.hashSync(new_password, 10), user.email]);

    res.json({ success: true });
  } catch (e) {
    console.error('[do-reset-password]', e.message);
    res.status(400).json({ error: 'Invalid or expired token. Request a new reset link.' });
  }
});

// ── POST /api/auth-sb/change-email ────────────────────────────────────
router.post('/change-email', authMiddleware, async (req, res) => {
  const { new_email } = req.body;
  if (!new_email) return res.status(400).json({ error: 'New email required' });
  try {
    // Send magic link to new email for verification
    const sb = sbAnon();
    const { error } = await sb.auth.signInWithOtp({
      email: new_email,
      options: { emailRedirectTo: `${SITE_URL}/change-email` },
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth-sb/admin/send-link ────────────────────────────────
router.post('/admin/send-link', authMiddleware, adminOnly, async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type) return res.status(400).json({ error: 'email and type required' });

  try {
    const sb = sbAdmin();

    if (type === 'invite') {
      const { error } = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${SITE_URL}/accept-invite`
      });
      if (error) throw error;
      return res.json({ success: true, message: `Invite sent to ${email}` });
    }

    if (type === 'reset_password') {
      const sbA = sbAnon();
      const { error } = await sbA.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/reset-password`
      });
      if (error) throw error;
      return res.json({ success: true, message: `Reset link sent to ${email}` });
    }

    if (type === 'magic_link') {
      const sbA = sbAnon();
      const { error } = await sbA.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${SITE_URL}/magic-login` }
      });
      if (error) throw error;
      return res.json({ success: true, message: `Magic link sent to ${email}` });
    }

    if (type === 'change_email') {
      // Send magic link so user can login and change email
      const sbA = sbAnon();
      const { error } = await sbA.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${SITE_URL}/change-email` }
      });
      if (error) throw error;
      return res.json({ success: true, message: `Change email link sent to ${email}` });
    }

    // For other types use generateLink (confirm_signup, reauthentication)
    const linkTypes = { confirm_signup: 'signup', reauthentication: 'reauthentication' };
    const sbType = linkTypes[type];
    if (!sbType) return res.status(400).json({ error: 'Invalid link type' });

    const { data, error } = await sb.auth.admin.generateLink({
      type: sbType,
      email,
      options: { redirectTo: `${SITE_URL}/auth-callback` }
    });
    if (error) throw error;
    res.json({ success: true, message: `${type} link sent to ${email}` });
  } catch (e) {
    console.error('[Admin send-link]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
