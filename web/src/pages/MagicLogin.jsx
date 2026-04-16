import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, c } from '../theme';

export default function MagicLogin({ onLogin }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // Supabase puts token in URL hash OR query params
    const hash = window.location.hash;
    const search = window.location.search;

    // Try hash first: #access_token=xxx
    let accessToken = null;
    let type = null;

    if (hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      accessToken = hashParams.get('access_token');
      type = hashParams.get('type');
    }

    // Try query params: ?access_token=xxx
    if (!accessToken && search) {
      const queryParams = new URLSearchParams(search);
      accessToken = queryParams.get('access_token');
      type = queryParams.get('type');
    }

    if (!accessToken) {
      setStatus('error');
      setMsg('Invalid magic link. Please request a new one.');
      return;
    }

    fetch('/api/auth-sb/magic-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('indi_user', JSON.stringify(data.user));
          if (onLogin) onLogin(data.user);
          setStatus('success');
          setTimeout(() => navigate('/'), 1500);
        } else {
          throw new Error(data.error || 'Login failed');
        }
      })
      .catch(e => { setStatus('error'); setMsg(e.message); });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </div>
        <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>
          {status === 'loading' ? 'Logging you in...' : status === 'success' ? 'Logged in!' : 'Login Failed'}
        </div>
        {msg && <div style={{ color: t.danger, fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>{msg}</div>}
        {status === 'success' && <p style={{ color: t.text2, fontSize: '13px' }}>Redirecting to home...</p>}
        {status === 'error' && (
          <button style={{ padding: '12px 24px', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', width: '100%' }}
            onClick={() => navigate('/')}>Back to Home</button>
        )}
      </div>
    </div>
  );
}
