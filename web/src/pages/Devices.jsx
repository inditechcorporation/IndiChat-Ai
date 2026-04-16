import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme';
import api from '../api';
import { Cpu, Plus, Trash2, Settings, CheckCircle, Clock, ChevronRight, X, LogOut, MessageSquare, Home, Shield, Zap, ArrowLeft } from 'lucide-react';

const MODELS = [
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct',  label: 'Llama 4 Scout',    provider: 'groq',     color: '#f97316', free: true },
  { id: 'llama-3.3-70b-versatile',         label: 'Llama 3.3 70B',    provider: 'groq',     color: '#f97316', free: true },
  { id: 'llama-3.1-8b-instant',            label: 'Llama 3.1 8B',     provider: 'groq',     color: '#f97316', free: true },
  { id: 'openai/gpt-oss-120b',             label: 'GPT OSS 120B',     provider: 'groq',     color: '#f97316', free: true },
  { id: 'openai/gpt-oss-20b',              label: 'GPT OSS 20B',      provider: 'groq',     color: '#f97316', free: true },
  { id: 'qwen/qwen3-32b',                  label: 'Qwen3 32B',        provider: 'groq',     color: '#f97316', free: true },
  { id: 'moonshotai/kimi-k2-instruct',     label: 'Kimi K2',          provider: 'groq',     color: '#f97316', free: true },
  { id: 'gemini-2.5-flash',                label: 'Gemini 2.5 Flash', provider: 'gemini',   color: '#4285f4', free: false },
  { id: 'deepseek-chat',                   label: 'DeepSeek V3',      provider: 'deepseek', color: '#4f8ef7', free: false },
  { id: 'gpt-4o-mini',                     label: 'GPT-4o Mini',      provider: 'openai',   color: '#10a37f', free: false },
];

const KEY_LINKS = {
  gemini:   'aistudio.google.com',
  deepseek: 'platform.deepseek.com',
  openai:   'platform.openai.com',
};

export default function Devices({ user, onLogout }) {
  const navigate = useNavigate();
  const [devices, setDevices]         = useState([]);
  const [showAdd, setShowAdd]         = useState(false);
  const [name, setName]               = useState('');
  const [pendingCode, setPendingCode] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [msg, setMsg]                 = useState({ text: '', ok: true });


  // Quick setup
  const [quickSetup, setQuickSetup] = useState(null);
  const [qModel, setQModel]         = useState(MODELS[0]);
  const [qApiKey, setQApiKey]       = useState('');
  const [qSaving, setQSaving]       = useState(false);



  const load = async () => {
    try { const { data } = await api.get('/devices'); setDevices(data); } catch {}
  };

  useEffect(() => { load(); }, []);

  const addDevice = async () => {
    if (!name.trim()) return;
    const { data } = await api.post('/devices/add', { name });
    setPendingCode(data.activation_code);
    setName('');
  };

  const activate = async () => {
    try {
      const { data } = await api.post('/ota/confirm-code', { code: confirmCode });
      setPendingCode(null); setConfirmCode(''); setShowAdd(false);
      load();
      setQuickSetup({ device_id: data.device_id, device_name: data.device_name });
      setQModel(MODELS[0]); setQApiKey('');
    } catch {
      setMsg({ text: '❌ Invalid code. Check OLED display.', ok: false });
    }
  };

  const saveQuickSetup = async () => {
    if (!qModel.free && !qApiKey.trim()) return;
    setQSaving(true);
    try {
      await api.post(`/devices/${quickSetup.device_id}/config`, { ai_model: qModel.id, api_key: qApiKey });
      setQuickSetup(null);
      setMsg({ text: `✅ "${quickSetup.device_name}" is ready!`, ok: true });
      load();
      navigate(`/device/${quickSetup.device_id}`);
    } catch { setMsg({ text: '❌ Failed to save.', ok: false }); }
    setQSaving(false);
  };

  const saveKeys = async () => {
    const arr = newKeys.split('\n').map(k => k.trim()).filter(k => k);
    if (!arr.length) return;
    setKeySaving(true);
    try {
      const { data } = await api.post('/admin/keys', { keys: arr });
      setKeyStatus(data.keys);
      setNewKeys('');
      setMsg({ text: `✅ ${data.count} key(s) saved!`, ok: true });
    } catch (e) { setMsg({ text: '❌ ' + (e.response?.data?.error || 'Failed'), ok: false }); }
    setKeySaving(false);
  };  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${t.border}`, background: t.bg2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={ghostBtn}>
            <ArrowLeft size={15} style={{ marginRight: 4 }} /> Home
          </button>
          <span style={{ color: t.border }}>|</span>
          <span style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} style={{ color: t.accent }} /> My Devices
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={ghostBtn} onClick={() => navigate('/chat')}>
            <MessageSquare size={14} style={{ marginRight: 4 }} /> Chat
          </button>
          <button style={{ ...ghostBtn, color: '#ef4444' }} onClick={onLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '28px 20px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Voice Devices</h1>
            <p style={{ margin: '4px 0 0', color: t.text2, fontSize: '13px' }}>Manage your ESP32 voice assistants</p>
          </div>
          <button onClick={() => { setShowAdd(!showAdd); setQuickSetup(null); }} style={primaryBtn}>
            {showAdd ? '✕ Cancel' : '+ Add Device'}
          </button>
        </div>

        {/* Message */}
        {msg.text && (
          <div style={{ padding: '12px 16px', background: msg.ok ? '#22c55e22' : '#ef444422', border: `1px solid ${msg.ok ? '#22c55e' : '#ef4444'}`, borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <span style={{ cursor: 'pointer', color: t.text2 }} onClick={() => setMsg({ text: '', ok: true })}>✕</span>
          </div>
        )}

        {/* ── Add Device Panel ── */}
        {showAdd && !quickSetup && (
          <div style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Add New Device</h3>
            {!pendingCode ? (
              <div>
                <label style={lbl}>Device Name</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input style={{ ...inp, flex: 1 }} placeholder="e.g. Living Room Bot"
                    value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDevice()} />
                  <button style={primaryBtn} onClick={addDevice}>Next →</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: t.text2, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Waiting for Device Code</div>
                  <div style={{ fontSize: '44px', fontWeight: '800', letterSpacing: '12px', background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'monospace' }}>
                    {pendingCode}
                  </div>
                  <div style={{ fontSize: '12px', color: t.text2, marginTop: '8px' }}>This code will appear on OLED after WiFi setup</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {[
                    ['1','📱','Connect to "IndiChat-XXXX" WiFi (password on OLED)'],
                    ['2','🌐','Open 192.168.4.1 → select your WiFi → connect'],
                    ['3','📺','Device restarts → 6-digit code on OLED'],
                    ['4','✏️','Enter that code below'],
                  ].map(([n,icon,text]) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: t.bg3, borderRadius: '8px', fontSize: '13px' }}>
                      <span style={{ width: '22px', height: '22px', background: t.accent, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', fontWeight: '700', flexShrink: 0 }}>{n}</span>
                      <span style={{ fontSize: '16px' }}>{icon}</span>
                      <span style={{ color: t.text2 }}>{text}</span>
                    </div>
                  ))}
                </div>
                <label style={lbl}>Enter code shown on OLED</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input style={{ ...inp, flex: 1, fontSize: '22px', letterSpacing: '10px', textAlign: 'center', fontFamily: 'monospace' }}
                    placeholder="000000" maxLength={6} value={confirmCode}
                    onChange={e => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && confirmCode.length === 6 && activate()} autoFocus />
                  <button style={{ ...primaryBtn, opacity: confirmCode.length === 6 ? 1 : 0.4 }}
                    onClick={activate} disabled={confirmCode.length !== 6}>Verify →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Quick Setup ── */}
        {quickSetup && (
          <div style={{ background: t.bg2, border: `2px solid ${t.accent}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', background: '#22c55e22', border: '1px solid #22c55e', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>✅</div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '16px' }}>"{quickSetup.device_name}" Activated!</div>
                <div style={{ color: t.text2, fontSize: '13px' }}>Select AI model to get started</div>
              </div>
            </div>
            <label style={lbl}>Select AI Model</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {MODELS.map(m => (
                <div key={m.id} onClick={() => setQModel(m)}
                  style={{ padding: '10px 8px', background: qModel.id === m.id ? `${m.color}22` : t.bg3, border: `1px solid ${qModel.id === m.id ? m.color : t.border}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: qModel.id === m.id ? m.color : t.text }}>{m.label}</div>
                  {m.free && <div style={{ fontSize: '9px', color: '#22c55e', marginTop: '2px' }}>FREE</div>}
                </div>
              ))}
            </div>
            {qModel.free ? (
              <div style={{ fontSize: '12px', color: '#22c55e', background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
                ✅ Uses admin key — no API key needed!
              </div>
            ) : (
              <>
                <label style={lbl}>API Key for {qModel.provider} <a href={`https://${KEY_LINKS[qModel.provider]}`} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: 'none', marginLeft: '6px', fontSize: '10px' }}>Get key →</a></label>
                <input style={{ ...inp, marginBottom: '14px' }} type="password" placeholder={`Enter ${qModel.provider} API key`}
                  value={qApiKey} onChange={e => setQApiKey(e.target.value)} autoFocus />
              </>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ ...primaryBtn, flex: 1, padding: '12px', opacity: (qModel.free || qApiKey.trim()) && !qSaving ? 1 : 0.4 }}
                onClick={saveQuickSetup} disabled={(!qModel.free && !qApiKey.trim()) || qSaving}>
                {qSaving ? 'Saving...' : 'Save & Configure →'}
              </button>
              <button style={{ ...ghostBtn, border: `1px solid ${t.border}` }} onClick={() => navigate(`/device/${quickSetup.device_id}`)}>Skip</button>
            </div>
          </div>
        )}

        {/* ── Device List ── */}
        {devices.length === 0 && !showAdd && !quickSetup ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: t.text2 }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <div style={{ fontSize: '16px', marginBottom: '8px', color: t.text }}>No devices yet</div>
            <div style={{ fontSize: '13px' }}>Click "+ Add Device" to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {devices.map(d => (
              <div key={d.id} style={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '40px', height: '40px', background: d.activated ? '#22c55e22' : '#ef444422', border: `1px solid ${d.activated ? '#22c55e' : '#ef4444'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    {d.activated ? <CheckCircle size={20} color="#22c55e" /> : <Clock size={20} color="#ef4444" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{d.name}</div>
                    <div style={{ fontSize: '12px', color: t.text2, marginTop: '2px' }}>
                      {d.activated ? `${d.ai_model || 'Not configured'} · ${d.speak_language || 'en-US'}` : 'Waiting for activation'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={editBtn} onClick={() => navigate(`/device/${d.device_id}`)}>
                      <Settings size={13} style={{marginRight:4}} /> Edit
                    </button>
                  {d.activated && (
                    <button style={editBtn} onClick={() => navigate(`/device/${d.device_id}`)}>
                      <Settings size={13} style={{marginRight:4}} /> Configure
                    </button>
                  )}
                  <button style={{ ...ghostBtn, color: '#ef4444', border: '1px solid #ef444433' }} onClick={async () => {
                    if (!confirm(`Delete "${d.name}"?`)) return;
                    await api.delete(`/devices/${d.device_id}`); load();
                  }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '11px', color: t.text3, marginTop: '40px' }}>
          IndiChat-Ai powered by IndiTech Corporation
        </div>
      </div>
    </div>
  );
}

const inp       = { padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' };
const primaryBtn = { padding: '10px 18px', background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' };
const editBtn   = { padding: '8px 14px', background: t.bg3, border: `1px solid ${t.border}`, color: t.text, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' };
const ghostBtn  = { background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}`, color: t.text2, cursor: 'pointer', fontSize: '13px', padding: '7px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center' };
const lbl       = { display: 'block', fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: '600' };
