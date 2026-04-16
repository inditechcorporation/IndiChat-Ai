import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { t, c } from '../theme';
import { ArrowLeft } from 'lucide-react';

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'pt-PT', label: 'Portuguese' },
  { code: 'it-IT', label: 'Italian' },
];

// Groq models are free (admin provides key), others need user's own key
const MODELS = [
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct',  label: 'Llama 4 Scout',    provider: 'groq',     free: true },
  { id: 'llama-3.3-70b-versatile',         label: 'Llama 3.3 70B',    provider: 'groq',     free: true },
  { id: 'llama-3.1-8b-instant',            label: 'Llama 3.1 8B',     provider: 'groq',     free: true },
  { id: 'openai/gpt-oss-120b',             label: 'GPT OSS 120B',     provider: 'groq',     free: true },
  { id: 'openai/gpt-oss-20b',              label: 'GPT OSS 20B',      provider: 'groq',     free: true },
  { id: 'qwen/qwen3-32b',                  label: 'Qwen3 32B',        provider: 'groq',     free: true },
  { id: 'moonshotai/kimi-k2-instruct',     label: 'Kimi K2',          provider: 'groq',     free: true },
  { id: 'gemini-2.5-flash',                label: 'Gemini 2.5 Flash', provider: 'gemini',   free: false },
  { id: 'deepseek-chat',                   label: 'DeepSeek V3',      provider: 'deepseek', free: false },
  { id: 'gpt-4o-mini',                     label: 'GPT-4o Mini',      provider: 'openai',   free: false },
];

const KEY_LINKS = {
  gemini:   'https://aistudio.google.com',
  deepseek: 'https://platform.deepseek.com',
  openai:   'https://platform.openai.com',
};

const defaultConfig = {
  ai_model: 'llama3-8b-8192',
  api_key: '',
  bot_name: '',
  bot_intro: '',
  creator_name: '',
  creator_intro: '',
  speak_language: 'en-US',
  caption_language: 'en-US',
  voice_gender: 'female',
  behavior: '',
  max_words: 80,
  min_words: 10,
};

export default function DeviceConfig() {
  const { id: deviceId } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState(defaultConfig);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/devices/${deviceId}/config`).then(({ data }) => {
      setConfig({ ...defaultConfig, ...data });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [deviceId]);

  const set = (k) => (e) => setConfig(c => ({ ...c, [k]: e.target.value }));

  const save = async () => {
    setErr('');
    try {
      await api.post(`/devices/${deviceId}/config`, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErr('Failed to save. Please try again.');
    }
  };

  const selectedModel = MODELS.find(m => m.id === config.ai_model) || MODELS[0];

  if (loading) return (
    <div style={{ ...pg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: t.text2 }}>Loading...</div>
    </div>
  );

  return (
    <div style={pg}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button style={ghostBtn} onClick={() => navigate('/devices')}>
            <ArrowLeft size={16} style={{ marginRight: 4 }} /> Back to Devices
          </button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Device Configuration</h1>
            <div style={{ fontSize: '11px', color: t.text3, marginTop: '2px' }}>IndiChat-Ai powered by IndiTech Corporation</div>
          </div>
        </div>

        {/* AI Model */}
        <div style={card}>
          <div style={cardTitle}>🧠 AI Model</div>

          {/* Model Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {MODELS.map(m => (
              <div key={m.id} onClick={() => setConfig(c => ({ ...c, ai_model: m.id }))}
                style={{
                  padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                  background: config.ai_model === m.id ? `${t.accent}22` : t.bg3,
                  border: `1px solid ${config.ai_model === m.id ? t.accent : t.border}`,
                  transition: 'all .15s'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{m.label}</span>
                  {m.free && (
                    <span style={{ fontSize: '10px', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: '4px', padding: '1px 5px' }}>FREE</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: t.text2, marginTop: '2px', textTransform: 'capitalize' }}>{m.provider}</div>
              </div>
            ))}
          </div>

          {/* API Key - only show if non-groq model selected */}
          {!selectedModel.free && (
            <div style={{ background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={lbl}>API Key for {selectedModel.provider}</label>
                <a href={KEY_LINKS[selectedModel.provider]} target="_blank" rel="noreferrer"
                  style={{ fontSize: '11px', color: t.accent, textDecoration: 'none' }}>Get key →</a>
              </div>
              <input style={inp} type="password" placeholder={`Enter ${selectedModel.provider} API key`}
                value={config.api_key} onChange={set('api_key')} />
            </div>
          )}
          {selectedModel.free && (
            <div style={{ fontSize: '12px', color: '#22c55e', background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: '8px', padding: '10px 12px' }}>
              ✅ This model uses admin-provided API key. No key needed from you.
            </div>
          )}
        </div>

        {/* Bot Identity */}
        <div style={card}>
          <div style={cardTitle}>🤖 Bot Identity</div>
          <label style={lbl}>Bot Name</label>
          <input style={inp} placeholder="e.g. Aria" value={config.bot_name} onChange={set('bot_name')} />
          <label style={lbl}>Bot Introduction</label>
          <textarea style={ta} placeholder="Describe your bot's personality and role..." value={config.bot_intro} onChange={set('bot_intro')} />
          <label style={lbl}>Creator Name</label>
          <input style={inp} placeholder="Your name or company" value={config.creator_name} onChange={set('creator_name')} />
          <label style={lbl}>Creator Introduction</label>
          <textarea style={ta} placeholder="About the creator..." value={config.creator_intro} onChange={set('creator_intro')} />
        </div>

        {/* Behavior */}
        <div style={card}>
          <div style={cardTitle}>⚙️ Behavior</div>
          <label style={lbl}>Behavior Instructions</label>
          <textarea style={{ ...ta, minHeight: '100px' }}
            placeholder="How should the AI behave? e.g. Always be friendly, use simple words..."
            value={config.behavior} onChange={set('behavior')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Min Words per Response</label>
              <input style={inp} type="number" min="1" max="500" value={config.min_words} onChange={set('min_words')} />
            </div>
            <div>
              <label style={lbl}>Max Words per Response</label>
              <input style={inp} type="number" min="1" max="1000" value={config.max_words} onChange={set('max_words')} />
            </div>
          </div>
        </div>

        {/* Language & Voice */}
        <div style={card}>
          <div style={cardTitle}>🌐 Language & Voice</div>
          <label style={lbl}>Speak Language</label>
          <select style={sel} value={config.speak_language} onChange={set('speak_language')}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <label style={lbl}>Caption Language</label>
          <select style={sel} value={config.caption_language} onChange={set('caption_language')}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <label style={lbl}>Voice Gender</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['female', 'male'].map(g => (
              <div key={g} onClick={() => setConfig(c => ({ ...c, voice_gender: g }))}
                style={{
                  flex: 1, padding: '10px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                  background: config.voice_gender === g ? `${t.accent}22` : t.bg3,
                  border: `1px solid ${config.voice_gender === g ? t.accent : t.border}`,
                  fontSize: '14px', fontWeight: '600', textTransform: 'capitalize'
                }}>
                {g === 'female' ? '👩 Female' : '👨 Male'}
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          {err && <span style={{ color: t.danger, fontSize: '13px' }}>{err}</span>}
          {saved && <span style={{ color: t.success, fontSize: '13px' }}>✅ Saved!</span>}
          <button style={saveBtn} onClick={save}>Save Configuration</button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '11px', color: t.text3, marginBottom: '24px' }}>
          IndiChat-Ai powered by IndiTech Corporation
        </div>
      </div>
    </div>
  );
}

const pg      = { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter', -apple-system, sans-serif" };
const card    = { background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px', marginBottom: '16px' };
const cardTitle = { fontSize: '15px', fontWeight: '700', marginBottom: '16px' };
const inp     = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' };
const ta      = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' };
const sel     = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', marginBottom: '12px' };
const lbl     = { display: 'block', fontSize: '11px', color: t.text2, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const ghostBtn = { background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}`, color: t.text2, borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center' };
const saveBtn  = { padding: '12px 28px', background: t.grad, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' };
