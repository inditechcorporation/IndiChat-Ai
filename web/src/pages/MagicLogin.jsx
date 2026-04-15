import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, c } from '../theme';

export default function MagicLogin({ onLogin }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken = params.get('access_token');
    const type = params.get('type');

    if (!accessToken) {
      setStatus('error');
      setMsg('Invalid magic link. Please request a new one.');
      return;
    }

    // Use token to get user info and log them in
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
    <div style={{ ...c.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...c.card, width: '100%', maxWidth: '360px', margin: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </div>
        <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>
          {status === 'loading' ? 'Logging you in...' : status === 'success' ? 'Logged in!' : 'Login Failed'}
        </div>
        {msg && <div style={{ color: t.danger, fontSize: '13px', marginBottom: '16px' }}>{msg}</div>}
        {status === 'success' && <p style={{ color: t.text2, fontSize: '13px' }}>Redirecting to home...</p>}
        {status === 'error' && (
          <button style={{ ...c.btn, width: '100%' }} onClick={() => navigate('/')}>Back to Home</button>
        )}
      </div>
    </div>
  );
}
