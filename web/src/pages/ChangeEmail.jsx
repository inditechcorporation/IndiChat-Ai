import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, c } from '../theme';

export default function ChangeEmail({ user }) {
  const navigate = useNavigate();
  const [step, setStep]       = useState('form'); // form | sent | confirm | success
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    // If redirected back after clicking email link
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const type = params.get('type');
    if (type === 'email_change') setStep('success');
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!newEmail.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth-sb/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ new_email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('sent');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ ...c.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...c.card, width: '100%', maxWidth: '380px', margin: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📧</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Change Email</h1>
          <p style={{ color: t.text2, fontSize: '12px', marginTop: '4px' }}>
            Current: <strong style={{ color: t.text }}>{user?.email}</strong>
          </p>
        </div>

        {step === 'form' && (
          <form onSubmit={submit}>
            <label style={lbl}>New Email Address</label>
            <input style={inp} type="email" placeholder="new@example.com"
              value={newEmail} onChange={e => setNewEmail(e.target.value)} required autoFocus />
            {err && <div style={{ color: t.danger, fontSize: '13px', marginBottom: '12px' }}>{err}</div>}
            <button style={{ ...c.btn, width: '100%', opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Verification Link'}
            </button>
            <button type="button" style={{ ...c.btnGhost, width: '100%', marginTop: '10px' }}
              onClick={() => navigate('/')}>Cancel</button>
          </form>
        )}

        {step === 'sent' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📬</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Check your old email!</div>
            <p style={{ color: t.text2, fontSize: '13px', marginBottom: '8px' }}>
              A verification link has been sent to your <strong style={{ color: t.text }}>current email</strong>.
            </p>
            <p style={{ color: t.text2, fontSize: '13px', marginBottom: '20px' }}>
              Click the link to confirm changing to <strong style={{ color: t.accent }}>{newEmail}</strong>
            </p>
            <button style={{ ...c.btn, width: '100%' }} onClick={() => navigate('/')}>Back to Home</button>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Email Changed!</div>
            <p style={{ color: t.text2, fontSize: '13px', marginBottom: '20px' }}>
              Your email has been updated. Please login again.
            </p>
            <button style={{ ...c.btn, width: '100%' }} onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('indi_user');
              navigate('/');
            }}>Login Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inp = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '14px' };
const lbl = { display: 'block', fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' };
