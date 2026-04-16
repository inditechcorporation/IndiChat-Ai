import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme';
import api from '../api';
import { Users, Key, Bot, BarChart3, Home, LogOut, Cpu, Crown, User, Send, RefreshCw, ChevronDown, ChevronUp, Shield } from 'lucide-react';

const LINK_TYPES = [
  { id: 'reset_password',  label: 'Reset Password',   icon: '🔑' },
  { id: 'magic_link',      label: 'Magic Link Login',  icon: '✨' },
  { id: 'invite',          label: 'Invite User',       icon: '📨' },
  { id: 'confirm_signup',  label: 'Confirm Signup',    icon: '✅' },
  { id: 'change_email',    label: 'Change Email',      icon: '📧' },
  { id: 'reauthentication',label: 'Reauthentication',  icon: '🔒' },
];

function UserRow({ u, currentUserId, onToggleAdmin, onMsg, onUpdateName }) {
  const [showLinks, setShowLinks] = useState(false);
  const [sending,   setSending]   = useState('');
  const [editName,  setEditName]  = useState(false);
  const [nameVal,   setNameVal]   = useState(u.name || '');

  const sendLink = async (type) => {
    setSending(type);
    try {
      const res = await fetch('/api/auth-sb/admin/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ email: u.email, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMsg(`Sent ${type} to ${u.email}`);
      setShowLinks(false);
    } catch (e) { onMsg(e.message, false); }
    setSending('');
  };

  const saveName = async () => {
    if (!nameVal.trim()) return;
    try {
      const res = await fetch(`/api/admin/users/${u.id}/update-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ name: nameVal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMsg(`Name updated to "${nameVal.trim()}"`);
      onUpdateName(u.id, nameVal.trim());
      setEditName(false);
    } catch (e) { onMsg(e.message, false); }
  };

  return (
    <div style={{ background: t.bg3, borderRadius: '10px', overflow: 'hidden', border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px' }}>
        <div style={{ width: '36px', height: '36px', background: u.is_admin ? `${t.accent}33` : t.bg2, border: `1px solid ${u.is_admin ? t.accent : t.border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: u.is_admin ? t.accent : t.text2 }}>
          {u.is_admin ? <Crown size={16} /> : <User size={16} />}
        </div>
        <div style={{ flex: 1 }}>
          {editName ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
              <input
                style={{ padding: '4px 8px', background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.text, fontSize: '13px', outline: 'none', width: '140px' }}
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                autoFocus
              />
              <button onClick={saveName} style={{ fontSize: '11px', padding: '4px 8px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditName(false)} style={{ fontSize: '11px', padding: '4px 8px', background: t.bg2, border: `1px solid ${t.border}`, color: t.text2, borderRadius: '5px', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {u.name || <span style={{ color: t.text3, fontStyle: 'italic' }}>No name</span>}
              <button onClick={() => { setNameVal(u.name || ''); setEditName(true); }} style={{ background: 'transparent', border: 'none', color: t.text3, cursor: 'pointer', fontSize: '11px', padding: '1px 4px' }} title="Edit name">✏️</button>
            </div>
          )}
          <div style={{ fontSize: '12px', color: t.text2 }}>{u.email} · {u.device_count} device(s)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {u.is_admin && <span style={{ fontSize: '11px', background: `${t.accent}22`, color: t.accent, border: `1px solid ${t.accent}44`, borderRadius: '4px', padding: '2px 8px' }}>Admin</span>}
          <button style={{ fontSize: '12px', padding: '5px 10px', background: t.bg2, border: `1px solid ${t.border}`, color: t.text2, borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => setShowLinks(!showLinks)}>
            {showLinks ? 'Hide' : 'Send Link'}
          </button>
          {u.id !== currentUserId && (
            <button style={{ fontSize: '12px', padding: '5px 10px', background: 'transparent', border: `1px solid ${t.border}`, color: t.text2, borderRadius: '6px', cursor: 'pointer' }}
              onClick={() => onToggleAdmin(u.id)}>
              {u.is_admin ? 'Remove Admin' : 'Make Admin'}
            </button>
          )}
          {u.id === currentUserId && <span style={{ fontSize: '11px', color: t.text3 }}>You</span>}
        </div>
      </div>
      {showLinks && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {LINK_TYPES.map(lt => (
            <button key={lt.id} onClick={() => sendLink(lt.id)} disabled={!!sending}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: sending === lt.id ? t.bg2 : t.bg, border: `1px solid ${t.border}`, color: t.text2, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', opacity: sending && sending !== lt.id ? 0.5 : 1 }}>
              <Send size={12} /> {sending === lt.id ? 'Sending...' : lt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin({ user, onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab]           = useState('overview');
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [settings, setSettings] = useState({
    ai_name: '', ai_intro: '', creator_name: '', creator_intro: '',
    tts_provider: 'gemini', tts_voice_female: 'Kore', tts_voice_male: 'Charon', tts_gemini_key: ''
  });
  const [newKeys, setNewKeys]   = useState('');
  const [msg, setMsg]           = useState({ text: '', ok: true });
  const [saving, setSaving]     = useState(false);

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 4000); };

  useEffect(() => { loadStats(); loadSettings(); }, []);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);

  const loadStats = async () => {
    try { const { data } = await api.get('/admin/stats'); setStats(data); } catch { navigate('/'); }
  };

  const loadUsers = async () => {
    try { const { data } = await api.get('/admin/users'); setUsers(data); } catch {}
  };

  const loadSettings = async () => {
    try { const { data } = await api.get('/admin/settings'); setSettings(s => ({ ...s, ...data })); } catch {}
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.post('/admin/settings', settings);
      showMsg('✅ Settings saved!');
    } catch { showMsg('❌ Failed to save', false); }
    setSaving(false);
  };

  const saveKeys = async () => {
    const arr = newKeys.split('\n').map(k => k.trim()).filter(k => k.startsWith('gsk_'));
    if (!arr.length) return showMsg('❌ No valid Groq keys (must start with gsk_)', false);
    setSaving(true);
    try {
      const { data } = await api.post('/admin/keys', { keys: arr });
      setNewKeys('');
      loadStats();
      showMsg(`✅ ${data.count} key(s) saved & active!`);
    } catch { showMsg('❌ Failed to save keys', false); }
    setSaving(false);
  };

  const toggleAdmin = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-admin`);
      loadUsers();
    } catch {}
  };

  const updateUserName = (userId, name) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, name } : u));
  };

  const TABS = [
    { id: 'overview', label: 'Overview',    icon: <BarChart3 size={14} /> },
    { id: 'keys',     label: 'Groq Keys',   icon: <Key size={14} /> },
    { id: 'identity', label: 'AI Identity', icon: <Bot size={14} /> },
    { id: 'tts',      label: 'TTS Voice',   icon: <Users size={14} /> },
    { id: 'users',    label: 'Users',       icon: <Users size={14} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: `1px solid ${t.border}`, background: t.bg2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={ghostBtn}><Home size={14} style={{marginRight:4}} /> Home</button>
          <span style={{ color: t.border }}>|</span>
          <div>
            <span style={{ fontWeight: '700', fontSize: '14px', display:'flex', alignItems:'center', gap:'6px' }}><Shield size={16} style={{color:'#f97316'}} /> Admin Panel</span>
            <div style={{ fontSize: '10px', color: t.text3 }}>IndiChat-Ai · IndiTech Corporation</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={ghostBtn} onClick={() => navigate('/devices')}><Cpu size={14} style={{marginRight:4}} /> Devices</button>
          <button style={{ ...ghostBtn, color: '#ef4444' }} onClick={onLogout}><LogOut size={14} /></button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: t.bg2, padding: '4px', borderRadius: '10px', border: `1px solid ${t.border}` }}>
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ flex: 1, padding: '9px', background: tab === tb.id ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : 'transparent', color: tab === tb.id ? '#fff' : t.text2, border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: tab === tb.id ? '600' : '400', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {/* Message */}
        {msg.text && (
          <div style={{ padding: '12px 16px', background: msg.ok ? '#22c55e22' : '#ef444422', border: `1px solid ${msg.ok ? '#22c55e' : '#ef4444'}`, borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {msg.text}
          </div>
        )}

        {/* ── Overview Tab ── */}
        {tab === 'overview' && stats && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Total Users', value: stats.total_users, icon: <Users size={24} />, color: t.accent },
                { label: 'Active Devices', value: stats.active_devices, icon: <Cpu size={24} />, color: '#22c55e' },
                { label: 'Total Devices', value: stats.total_devices, icon: <BarChart3 size={24} />, color: t.accent2 },
              ].map(s => (
                <div key={s.label} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px', color: s.color }}>{s.icon}</div>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: t.text2, marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Key Status */}
            <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontWeight: '700', marginBottom: '14px', fontSize: '14px' }}>Groq Key Status</div>
              {stats.keys.length === 0 ? (
                <div style={{ color: t.text2, fontSize: '13px' }}>No keys configured. Go to Groq Keys tab to add.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.keys.map((k, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: t.bg3, borderRadius: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: k.exhausted ? '#ef4444' : '#22c55e', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', color: t.text2, flex: 1 }}>Key {k.index}: {k.key}</span>
                      {k.active && <span style={{ fontSize: '11px', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: '4px', padding: '2px 8px' }}>ACTIVE</span>}
                      {k.exhausted && <span style={{ fontSize: '11px', color: '#ef4444' }}>resets in {k.resetsIn}s</span>}
                      {!k.exhausted && !k.active && <span style={{ fontSize: '11px', color: t.text3 }}>standby</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Groq Keys Tab ── */}
        {tab === 'keys' && (
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Groq API Keys</div>
            <div style={{ fontSize: '13px', color: t.text2, marginBottom: '20px' }}>
              Add multiple keys — system auto-rotates when one hits rate limit. Get free keys at{' '}
              <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: t.accent }}>console.groq.com</a>
            </div>

            {/* Current keys */}
            {stats?.keys.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: t.text2, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Current Keys</div>
                {stats.keys.map((k, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: t.bg3, borderRadius: '8px', marginBottom: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: k.exhausted ? '#ef4444' : '#22c55e' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: t.text2 }}>Key {k.index}: {k.key}</span>
                    {k.active && <span style={{ fontSize: '10px', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: '4px', padding: '1px 6px' }}>ACTIVE</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Add / Replace Keys (one per line)</div>
            <textarea
              style={{ width: '100%', padding: '12px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', minHeight: '100px', boxSizing: 'border-box', marginBottom: '12px' }}
              placeholder={'gsk_xxxxxxxxxxxxxxxx\ngsk_yyyyyyyyyyyyyyyy\ngsk_zzzzzzzzzzzzzzzz'}
              value={newKeys}
              onChange={e => setNewKeys(e.target.value)}
            />
            <button style={{ ...primaryBtn, opacity: newKeys.trim() && !saving ? 1 : 0.5 }}
              onClick={saveKeys} disabled={!newKeys.trim() || saving}>
              {saving ? 'Saving...' : 'Save Keys'}
            </button>
          </div>
        )}

        {/* ── AI Identity Tab ── */}
        {tab === 'identity' && (
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Platform AI Identity</div>
            <div style={{ fontSize: '13px', color: t.text2, marginBottom: '20px' }}>
              This applies to <strong style={{ color: t.text }}>Live Chat</strong> on the website. Device chat uses each device's own config.
            </div>

            <label style={lbl}>AI Name</label>
            <input style={inp} placeholder="e.g. IndiChat" value={settings.ai_name}
              onChange={e => setSettings(s => ({ ...s, ai_name: e.target.value }))} />

            <label style={lbl}>AI Introduction</label>
            <textarea style={ta} placeholder="e.g. I am IndiChat, your intelligent voice assistant..."
              value={settings.ai_intro}
              onChange={e => setSettings(s => ({ ...s, ai_intro: e.target.value }))} />

            <label style={lbl}>Creator Name</label>
            <input style={inp} placeholder="e.g. IndiTech Corporation" value={settings.creator_name}
              onChange={e => setSettings(s => ({ ...s, creator_name: e.target.value }))} />

            <label style={lbl}>Creator Introduction</label>
            <textarea style={ta} placeholder="e.g. IndiTech Corporation builds smart AI-powered devices..."
              value={settings.creator_intro}
              onChange={e => setSettings(s => ({ ...s, creator_intro: e.target.value }))} />

            <div style={{ background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: t.text2 }}>
              Preview: "My name is <strong style={{ color: t.text }}>{settings.ai_name || 'IndiChat'}</strong>. {settings.ai_intro || '...'} I was created by <strong style={{ color: t.text }}>{settings.creator_name || 'IndiTech Corporation'}</strong>."
            </div>

            <button style={{ ...primaryBtn, opacity: !saving ? 1 : 0.5 }} onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Identity'}
            </button>
          </div>
        )}

        {/* ── TTS Voice Tab ── */}
        {tab === 'tts' && (
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>TTS Voice Settings</div>
            <div style={{ fontSize: '13px', color: t.text2, marginBottom: '20px' }}>
              Configure Gemini TTS voices. Gemini is primary — Groq Orpheus is automatic fallback.
            </div>

            <label style={lbl}>Gemini API Key (for TTS)</label>
            <input style={inp} type="password" placeholder="AIza... (from Google AI Studio)"
              value={settings.tts_gemini_key}
              onChange={e => setSettings(s => ({ ...s, tts_gemini_key: e.target.value }))} />
            <div style={{ fontSize: '11px', color: t.text3, marginBottom: '16px' }}>
              Get free key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: t.accent }}>aistudio.google.com</a>
            </div>

            <label style={lbl}>Female Voice</label>
            <select style={{ ...inp, cursor: 'pointer' }}
              value={settings.tts_voice_female}
              onChange={e => setSettings(s => ({ ...s, tts_voice_female: e.target.value }))}>
              {[
                ['Kore', 'Kore — Firm'],
                ['Aoede', 'Aoede — Breezy'],
                ['Leda', 'Leda — Youthful'],
                ['Callirrhoe', 'Callirrhoe — Easy-going'],
                ['Autonoe', 'Autonoe — Bright'],
                ['Enceladus', 'Enceladus — Breathy'],
                ['Despina', 'Despina — Smooth'],
                ['Erinome', 'Erinome — Clear'],
                ['Laomedeia', 'Laomedeia — Upbeat'],
                ['Achernar', 'Achernar — Soft'],
                ['Pulcherrima', 'Pulcherrima — Forward'],
                ['Achird', 'Achird — Friendly'],
                ['Vindemiatrix', 'Vindemiatrix — Gentle'],
                ['Sadachbia', 'Sadachbia — Lively'],
                ['Sulafat', 'Sulafat — Warm'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <label style={lbl}>Male Voice</label>
            <select style={{ ...inp, cursor: 'pointer' }}
              value={settings.tts_voice_male}
              onChange={e => setSettings(s => ({ ...s, tts_voice_male: e.target.value }))}>
              {[
                ['Charon', 'Charon — Informative'],
                ['Zephyr', 'Zephyr — Bright'],
                ['Puck', 'Puck — Upbeat'],
                ['Fenrir', 'Fenrir — Excitable'],
                ['Orus', 'Orus — Firm'],
                ['Iapetus', 'Iapetus — Clear'],
                ['Umbriel', 'Umbriel — Easy-going'],
                ['Algieba', 'Algieba — Smooth'],
                ['Algenib', 'Algenib — Gravelly'],
                ['Rasalgethi', 'Rasalgethi — Informative'],
                ['Alnilam', 'Alnilam — Firm'],
                ['Schedar', 'Schedar — Even'],
                ['Gacrux', 'Gacrux — Mature'],
                ['Zubenelgenubi', 'Zubenelgenubi — Casual'],
                ['Sadaltager', 'Sadaltager — Knowledgeable'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <div style={{ background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: t.text2 }}>
              Preview: Female = <strong style={{ color: t.text }}>{settings.tts_voice_female}</strong> | Male = <strong style={{ color: t.text }}>{settings.tts_voice_male}</strong>
              <br />Fallback: Groq Orpheus (auto when Gemini limit reached)
            </div>

            <button style={{ ...primaryBtn, opacity: !saving ? 1 : 0.5 }} onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save TTS Settings'}
            </button>
          </div>
        )}

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>All Users ({users.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {users.map(u => (
                <UserRow key={u.id} u={u} currentUserId={user?.id} onToggleAdmin={toggleAdmin} onMsg={showMsg} onUpdateName={updateUserName} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inp      = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '14px' };
const ta       = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '14px', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' };
const lbl      = { display: 'block', fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: '600' };
const primaryBtn = { padding: '11px 24px', background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
const ghostBtn = { background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', fontSize: '13px', padding: '8px 12px', borderRadius: '8px' };
