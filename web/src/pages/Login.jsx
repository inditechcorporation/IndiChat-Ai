import React, { useState } from 'react';
import api from '../api';
import { s } from '../styles';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, form);
      onLogin(data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...s.card, width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🤖</div>
          <h1 style={s.h1}>ESP Voice Assistant</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>Your self-hosted AI voice platform</p>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label style={s.label}>Name</label>
              <input style={s.input} placeholder="Your name" value={form.name} onChange={set('name')} />
            </>
          )}
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />

          {error && <p style={{ color: '#f44336', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

          <button style={{ ...s.btn, width: '100%' }} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#888' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span style={{ color: '#6c63ff', cursor: 'pointer' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}
