import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme';
import IndiChatLogo from '../components/IndiChatLogo';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';

/**
 * Single /auth/callback handler for:
 *  - Magic link login  (type = "magiclink" | "signup" | undefined)
 *  - Password reset    (type = "recovery")
 *  - Email change      (type = "email_change")
 *
 * Supabase puts params in URL hash:
 *   #access_token=xxx&type=recovery&...
 */
export default function AuthCallback({ onLogin }) {
  const navigate = useNavigate();

  const [status,   setStatus]   = useState('loading'); // loading | recovery | success | error
  const [errMsg,   setErrMsg]   = useState('');
  const [token,    setToken]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    // Parse URL hash: #access_token=xxx&type=recovery&error=xxx
    const hash   = window.location.hash.substring(1); // remove leading #
    const params = new URLSearchParams(hash);

    const accessToken      = params.get('access_token');
    const type             = params.get('type');
    const error            = params.get('error');
    const errorDescription = params.get('error_description');

    // Handle Supabase error in URL
    if (error) {
      setErrMsg(decodeURIComponent(errorDescription || error).replace(/\+/g, ' '));
      setStatus('error');
      return;
    }

    if (!accessToken) {
      setErrMsg('Invalid or expired link. Please request a new one.');
      setStatus('error');
      return;
    }

    // Password reset flow
    if (type === 'recovery') {
      setToken(accessToken);
      setStatus('recovery');
      return;
    }

    // Magic link / signup / email_change — verify with our server
    verifyToken(accessToken, type);
  }, []);

  const verifyToken = async (accessToken, type) => {
    try {
      const res  = await fetch('/api/auth-sb/magic-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ access_token: accessToken }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Verification failed');

      // Store session
      localStorage.setItem('token',     data.token);
      localStorage.setItem('indi_user', JSON.stringify(data.user));
      if (onLogin) onLogin(data.user);

      setStatus('success');
      setTimeout(() => navigate('/'), 1800);
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setErrMsg('Password must be at least 6 characters');
    if (password !== confirm)  return setErrMsg('Passwords do not match');

    setSaving(true);
    setErrMsg('');
    try {
      const res  = await fetch('/api/auth-sb/do-reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ access_token: token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      setSaved(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <IndiChatLogo size={56} />
          </div>
          <div style={{ fontWeight: '800', fontSize: '18px', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            IndiChat-Ai
          </div>
          <div style={{ fontSize: '11px', color: t.text3 }}>by IndiTech Corporation</div>
        </div>

        <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '28px' }}>

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <Loader size={36} color={t.accent} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '6px' }}>Verifying...</div>
              <div style={{ color: t.text2, fontSize: '13px' }}>Please wait a moment</div>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <CheckCircle size={48} color="#22c55e" />
              </div>
              <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px', color: '#22c55e' }}>Logged In!</div>
              <div style={{ color: t.text2, fontSize: '13px' }}>Redirecting to home...</div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <AlertCircle size={48} color={t.danger} />
              </div>
              <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '10px', color: t.danger }}>Link Invalid</div>
              <div style={{ color: t.text2, fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>{errMsg}</div>
              <button onClick={() => navigate('/')} style={btn}>Back to Home</button>
            </div>
          )}

          {/* Password Reset Form */}
          {status === 'recovery' && !saved && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔐</div>
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>Reset Password</div>
                <div style={{ color: t.text2, fontSize: '13px' }}>Enter your new password below</div>
              </div>

              <form onSubmit={handleResetPassword}>
                <label style={lbl}><Lock size={11} style={{ marginRight: 4 }} />New Password</label>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <input style={{ ...inp, paddingRight: '44px' }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required autoFocus />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', display: 'flex' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <label style={lbl}><Lock size={11} style={{ marginRight: 4 }} />Confirm Password</label>
                <input style={{ ...inp, marginBottom: '16px' }}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required />

                {errMsg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: t.danger, fontSize: '13px', marginBottom: '14px' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} /> {errMsg}
                  </div>
                )}

                <button style={{ ...btn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save New Password'}
                </button>
              </form>
            </div>
          )}

          {/* Password Reset Success */}
          {status === 'recovery' && saved && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <CheckCircle size={48} color="#22c55e" />
              </div>
              <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px', color: '#22c55e' }}>Password Updated!</div>
              <div style={{ color: t.text2, fontSize: '13px' }}>Redirecting to login...</div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const inp = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '10px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s' };
const lbl = { display: 'flex', alignItems: 'center', fontSize: '11px', color: t.text2, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600' };
const btn = { width: '100%', padding: '12px', background: `linear-gradient(135deg,#4f8ef7,#7c6af7)`, color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', boxShadow: '0 4px 20px rgba(79,142,247,0.3)' };
