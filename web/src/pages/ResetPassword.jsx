import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep]         = useState('form');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    // Supabase puts token in URL hash OR query params
    const hash = window.location.hash;
    const search = window.location.search;

    let token = null;
    let type = null;

    // Try hash: #access_token=xxx&type=recovery
    if (hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      token = hashParams.get('access_token');
      type  = hashParams.get('type');
    }

    // Try query params
    if (!token && search) {
      const queryParams = new URLSearchParams(search);
      token = queryParams.get('access_token');
      type  = queryParams.get('type');
    }

    if (token && (type === 'recovery' || type === 'magiclink' || !type)) {
      setAccessToken(token);
    } else {
      setErr('Invalid or expired reset link. Please request a new one.');
      setStep('error');
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (password.length < 6) return setErr('Password must be at least 6 characters');
    if (password !== confirm) return setErr('Passwords do not match');
    setLoading(true);
    try {
      const res = await fetch('/api/auth-sb/do-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('success');
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔐</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Reset Password</h1>
          <p style={{ color: t.text2, fontSize: '12px', marginTop: '4px' }}>IndiChat-Ai · IndiTech Corporation</p>
        </div>

        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>Password Updated!</div>
            <p style={{ color: t.text2, fontSize: '13px', marginBottom: '20px' }}>You can now login with your new password.</p>
            <button style={btn} onClick={() => navigate('/')}>Go to Login</button>
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <div style={{ color: t.danger, marginBottom: '16px', fontSize: '14px', lineHeight: 1.5 }}>{err}</div>
            <button style={btn} onClick={() => navigate('/')}>Back to Home</button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={submit}>
            <label style={lbl}>New Password</label>
            <input style={inp} type="password" placeholder="Min 6 characters"
              value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
            <label style={lbl}>Confirm Password</label>
            <input style={inp} type="password" placeholder="Repeat password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {err && <div style={{ color: t.danger, fontSize: '13px', marginBottom: '12px', lineHeight: 1.5 }}>{err}</div>}
            <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inp = { width: '100%', padding: '11px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '14px' };
const lbl = { display: 'block', fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: '600' };
const btn = { width: '100%', padding: '12px', background: `linear-gradient(135deg,#4f8ef7,#7c6af7)`, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
