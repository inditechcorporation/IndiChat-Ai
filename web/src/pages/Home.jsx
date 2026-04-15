import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, c } from '../theme';
import api from '../api';
import IndiChatLogo from '../components/IndiChatLogo';
import {
  Bot, Cpu, Mic, MessageSquare, Zap, Shield, Globe, ChevronRight,
  LogOut, Settings, PlusCircle, Sparkles, Lock, Phone, ArrowRight,
  User, Mail, Eye, EyeOff, X, Wifi, Code2, Volume2
} from 'lucide-react';

// ── Animated 3D background orbs ──────────────────────────────────────
function BgOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{
        position: 'absolute', width: '600px', height: '600px',
        borderRadius: '50%', top: '-200px', left: '-200px',
        background: 'radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', bottom: '-150px', right: '-150px',
        background: 'radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 70%)',
        animation: 'float 10s ease-in-out infinite reverse',
      }} />
      <div style={{
        position: 'absolute', width: '300px', height: '300px',
        borderRadius: '50%', top: '40%', left: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)',
        animation: 'float 12s ease-in-out infinite 2s',
      }} />
    </div>
  );
}

// ── 3D Logo ───────────────────────────────────────────────────────────
function Logo3D({ size = 40 }) {
  return <IndiChatLogo size={size} />;
}

// ── Reset / Magic Link Form ───────────────────────────────────────────
function ResetForm({ onBack }) {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const send = async (type) => {
    if (!email.trim()) return;
    setLoading(type); setStatus(''); setErrMsg('');
    try {
      const endpoint = type === 'reset' ? '/api/auth-sb/reset-password' : '/api/auth-sb/magic-link';
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.status === 404) setStatus('notfound');
      else if (!res.ok) { setErrMsg(data.error || 'Failed'); setStatus('error'); }
      else setStatus(type === 'reset' ? 'reset_sent' : 'magic_sent');
    } catch (e) { setErrMsg(e.message); setStatus('error'); }
    setLoading('');
  };

  if (status === 'reset_sent' || status === 'magic_sent') return (
    <div style={{ textAlign: 'center', animation: 'bounceIn 0.5s ease' }}>
      <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#22c55e,#16a34a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(34,197,94,0.3)' }}>
        <Mail size={28} color="#fff" />
      </div>
      <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>
        {status === 'reset_sent' ? 'Reset link sent!' : 'Magic link sent!'}
      </div>
      <p style={{ color: t.text2, fontSize: '13px', marginBottom: '20px' }}>
        Check <strong style={{ color: t.text }}>{email}</strong>
        {status === 'reset_sent' ? ' — link valid for 10 minutes.' : ' — click to login instantly.'}
      </p>
      <button className="btn-3d" style={outlineBtn} onClick={onBack}>Back to Sign In</button>
    </div>
  );

  return (
    <div>
      {(status === 'notfound' || status === 'error') && (
        <div style={{ ...alertBox, marginBottom: '14px' }}>
          <Shield size={14} style={{ flexShrink: 0 }} />
          {status === 'notfound' ? 'User not found. Check email or sign up.' : errMsg}
        </div>
      )}
      <label style={lbl}><Mail size={12} style={{ marginRight: 4 }} />Email Address</label>
      <input style={inp} type="email" placeholder="you@example.com"
        value={email} onChange={e => setEmail(e.target.value)} autoFocus />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <button className="btn-3d" style={{ ...gradBtn, opacity: loading || !email.trim() ? 0.6 : 1 }}
          onClick={() => send('reset')} disabled={!!loading || !email.trim()}>
          {loading === 'reset' ? 'Sending...' : <><Lock size={14} style={{ marginRight: 6 }} />Send Reset Password Link</>}
        </button>
        <button className="btn-3d" style={{ ...outlineBtn, opacity: loading || !email.trim() ? 0.6 : 1 }}
          onClick={() => send('magic')} disabled={!!loading || !email.trim()}>
          {loading === 'magic' ? 'Sending...' : <><Sparkles size={14} style={{ marginRight: 6 }} />Send Magic Link (no password)</>}
        </button>
      </div>
      <button style={{ background: 'transparent', border: 'none', color: t.text3, cursor: 'pointer', fontSize: '12px', width: '100%' }} onClick={onBack}>
        Back to Sign In
      </button>
    </div>
  );
}

// ── Main Home ─────────────────────────────────────────────────────────
export default function Home({ user, onLogin, onLogout }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode]           = useState('login');
  const [form, setForm]           = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass]   = useState(false);
  const [err, setErr]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [isAdmin, setIsAdmin]     = useState(false);

  useEffect(() => {
    if (user) api.get('/admin/me').then(({ data }) => setIsAdmin(data.is_admin)).catch(() => {});
  }, [user]);

  const openModal  = (m = 'login') => { setMode(m); setErr(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setErr(''); };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, form);
      localStorage.setItem('token', data.token);
      onLogin(data.user);
      closeModal();
    } catch (ex) { setErr(ex.response?.data?.error || 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const features = [
    { icon: <Zap size={20} />, title: 'Ultra Fast', desc: 'Groq LPU powered — responses in under 1 second', color: '#f97316' },
    { icon: <Globe size={20} />, title: 'Multi-Language', desc: 'Hindi, English, Arabic and 10+ languages', color: '#4f8ef7' },
    { icon: <Mic size={20} />, title: 'Voice First', desc: 'Natural voice conversations with ESP32 device', color: '#7c6af7' },
    { icon: <Shield size={20} />, title: 'Secure', desc: 'End-to-end encrypted, no data stored', color: '#22c55e' },
  ];

  const steps = [
    { icon: <Code2 size={22} />, n: '01', title: 'Flash Firmware', desc: 'Flash IndiChat firmware to ESP32 DevKit V1' },
    { icon: <Wifi size={22} />, n: '02', title: 'Connect WiFi', desc: 'Connect to IndiChat hotspot → open 192.168.4.1' },
    { icon: <Lock size={22} />, n: '03', title: 'Activate', desc: 'Enter 6-digit code from OLED on this website' },
    { icon: <Volume2 size={22} />, n: '04', title: 'Start Talking', desc: 'Press BOOT → speak → AI responds instantly' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter', -apple-system, sans-serif", position: 'relative', overflow: 'hidden' }}>
      <BgOrbs />

      {/* Nav */}
      <nav className="glass" style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Logo3D size={36} />
          <div>
            <div className="grad-text" style={{ fontWeight: '800', fontSize: '17px', letterSpacing: '-0.3px' }}>IndiChat-Ai</div>
            <div style={{ fontSize: '9px', color: t.text3, marginTop: '-1px' }}>powered by IndiTech Corporation</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ color: t.text2, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> {user.name || user.email}
              </span>
              {isAdmin && (
                <button className="btn-3d" style={navBtn} onClick={() => navigate('/admin')}>
                  <Settings size={14} /> Admin
                </button>
              )}
              <button className="btn-3d" style={navBtn} onClick={() => navigate('/devices')}>
                <PlusCircle size={14} /> Add Device
              </button>
              <button className="btn-3d" style={{ ...navBtn, background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', color: '#fff', border: 'none' }} onClick={() => navigate('/chat')}>
                <MessageSquare size={14} /> Live Chat
              </button>
              <button className="btn-3d" style={{ ...navBtn, color: t.danger, borderColor: '#ef444433' }} onClick={onLogout}>
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <button className="btn-3d" style={{ ...navBtn, background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', color: '#fff', border: 'none', padding: '9px 20px' }} onClick={() => openModal('login')}>
              Sign In <ArrowRight size={14} />
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px 60px', textAlign: 'center' }}>
        {/* 3D floating logo */}
        <div style={{ animation: 'float 6s ease-in-out infinite', marginBottom: '28px' }}>
          <IndiChatLogo size={110} />
        </div>

        <div className="slide-up">
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '900', margin: '0 0 16px', lineHeight: 1.05, letterSpacing: '-2px' }}>
            <span className="grad-text">IndiChat-Ai</span>
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2vw, 20px)', color: t.text2, maxWidth: '520px', lineHeight: 1.7, margin: '0 auto 8px' }}>
            Your intelligent AI voice assistant — chat in browser or talk through your ESP32 device
          </p>
          <p style={{ fontSize: '12px', color: t.text3, marginBottom: '40px' }}>powered by IndiTech Corporation</p>
        </div>

        {user ? (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '80px', animation: 'slideUp 0.5s 0.1s both' }}>
            <button className="btn-3d card-3d" onClick={() => navigate('/devices')}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 28px', background: t.bg2, border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: t.text, cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#7c6af7,#a855f7)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={18} color="#fff" />
              </div>
              Add Device
            </button>
            <button className="btn-3d" onClick={() => navigate('/chat')}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 28px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', border: 'none', borderRadius: '14px', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '600', boxShadow: '0 8px 32px rgba(79,142,247,0.4)' }}>
              <MessageSquare size={18} />
              Live Chat
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '14px', marginBottom: '80px', animation: 'slideUp 0.5s 0.1s both' }}>
            <button className="btn-3d" onClick={() => openModal('login')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 32px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '700', boxShadow: '0 8px 32px rgba(79,142,247,0.4)' }}>
              Get Started <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', maxWidth: '900px', width: '100%', marginBottom: '80px' }}>
          {features.map((f, i) => (
            <div key={i} className="card-3d glass"
              style={{ padding: '24px', borderRadius: '16px', textAlign: 'left', animation: `slideUp 0.5s ${0.1 + i * 0.08}s both` }}>
              <div style={{ width: 44, height: 44, background: `${f.color}22`, border: `1px solid ${f.color}44`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: '14px' }}>
                {f.icon}
              </div>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>{f.title}</div>
              <div style={{ color: t.text2, fontSize: '12px', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Setup steps */}
        <div style={{ maxWidth: '900px', width: '100%' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Device Setup in <span className="grad-text">4 Steps</span>
          </h2>
          <p style={{ color: t.text2, marginBottom: '36px', fontSize: '14px' }}>Get your ESP32 voice assistant running in minutes</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
            {steps.map((s, i) => (
              <div key={i} className="card-3d glass"
                style={{ padding: '24px', borderRadius: '16px', textAlign: 'left', position: 'relative', overflow: 'hidden', animation: `slideUp 0.5s ${0.2 + i * 0.1}s both` }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '32px', fontWeight: '900', color: 'rgba(79,142,247,0.08)', lineHeight: 1 }}>{s.n}</div>
                <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '14px', boxShadow: '0 4px 16px rgba(79,142,247,0.3)' }}>
                  {s.icon}
                </div>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>{s.title}</div>
                <div style={{ color: t.text2, fontSize: '12px', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', color: t.text3, fontSize: '12px' }}>
        © 2025 IndiChat-Ai · powered by <span style={{ color: t.text2 }}>IndiTech Corporation</span>
      </div>

      {/* Auth Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="glass slide-up" style={{ width: '100%', maxWidth: '380px', borderRadius: '20px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,142,247,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IndiChatLogo size={32} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>
                    {mode === 'reset' ? 'Account Recovery' : mode === 'register' ? 'Create Account' : 'Welcome Back'}
                  </div>
                  <div style={{ color: t.text3, fontSize: '11px' }}>IndiChat-Ai</div>
                </div>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: t.text2, borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {mode === 'reset' && <ResetForm onBack={() => setMode('login')} />}

            {(mode === 'login' || mode === 'register') && (
              <>
                <form onSubmit={submit}>
                  {mode === 'register' && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={lbl}><User size={12} style={{ marginRight: 4 }} />Full Name</label>
                      <input className="neon-border" style={inp} placeholder="Your name" value={form.name} onChange={set('name')} />
                    </div>
                  )}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={lbl}><Mail size={12} style={{ marginRight: 4 }} />Email</label>
                    <input className="neon-border" style={inp} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={lbl}><Lock size={12} style={{ marginRight: 4 }} />Password</label>
                    <div style={{ position: 'relative' }}>
                      <input className="neon-border" style={{ ...inp, paddingRight: '44px' }} type={showPass ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={set('password')} required />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', display: 'flex' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {err && (
                    <div style={{ ...alertBox, marginBottom: '14px' }}>
                      <Shield size={14} style={{ flexShrink: 0 }} /> {err}
                    </div>
                  )}
                  <button className="btn-3d" style={{ ...gradBtn, width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }} disabled={loading}>
                    {loading ? 'Please wait...' : mode === 'login' ? <><ArrowRight size={16} /> Sign In</> : <><User size={16} /> Create Account</>}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: '13px', color: t.text2, marginBottom: '10px' }}>
                    {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
                    <span style={{ color: t.accent, cursor: 'pointer', fontWeight: '600' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                      {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </span>
                  </p>
                  {mode === 'login' && (
                    <>
                      <button style={{ background: 'transparent', border: 'none', color: t.accent, cursor: 'pointer', fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto 10px' }}
                        onClick={() => setMode('reset')}>
                        <Lock size={13} /> Forgot Password?
                      </button>
                      <a href="tel:7800539650" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: t.text2, textDecoration: 'none', fontSize: '12px' }}>
                        <Phone size={13} /> Call Support: 7800539650
                      </a>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inp      = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s' };
const lbl      = { display: 'flex', alignItems: 'center', fontSize: '11px', color: t.text2, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600' };
const gradBtn  = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', boxShadow: '0 4px 20px rgba(79,142,247,0.3)' };
const outlineBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 20px', background: 'transparent', color: t.text2, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' };
const navBtn   = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: t.text2, cursor: 'pointer', fontSize: '13px', fontWeight: '500' };
const alertBox = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px' };
