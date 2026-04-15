import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, c } from '../theme';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep]         = useState('form'); // form | success | error
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    // Supabase puts token in URL hash: #access_token=xxx&type=recovery
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const token = params.get('access_token');
    const type  = params.get('type');
    if (token && type === 'recovery') {
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
    <div style={{ ...c.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...c.card, width: '100%', maxWidth: '380px', margin: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔐</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Reset Password</h1>
          <p style={{ color: t.text2, fontSize: '12px', marginTop: '4px' }}>IndiChat-Ai · IndiTech Corporation</p>
        </div>

        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Password Updated!</div>
            <p style={{ color: t.text2, fontSize: '13px', marginBottom: '20px' }}>You can now login with your new password.</p>
            <button style={{ ...c.btn, width: '100%' }} onClick={() => navigate('/')}>Go to Login</button>
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <div style={{ color: t.danger, marginBottom: '16px', fontSize: '14px' }}>{err}</div>
            <button style={{ ...c.btn, width: '100%' }} onClick={() => navigate('/')}>Back to Home</button>
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
            {err && <div style={{ color: t.danger, fontSize: '13px', marginBottom: '12px' }}>{err}</div>}
            <button style={{ ...c.btn, width: '100%', opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inp = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '14px' };
const lbl = { display: 'block', fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' };
