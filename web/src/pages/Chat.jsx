import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme';
import IndiChatLogo from '../components/IndiChatLogo';
import {
  Mic, MicOff, ImagePlus, Volume2, VolumeX, Trash2, RefreshCw,
  Cpu, Home, Send, Menu, Zap, Eye, Key, ArrowLeft, ArrowRight,
  Bot, Sparkles, Globe, ChevronRight, Lock, MessageSquare, Plus, X
} from 'lucide-react';

// Provider icons as colored SVG components
const ProviderIcon = ({ provider, size = 16 }) => {
  const icons = {
    groq:     <Zap size={size} color="#f97316" />,
    gemini:   <Sparkles size={size} color="#4285f4" />,
    deepseek: <Globe size={size} color="#4f8ef7" />,
    openai:   <Bot size={size} color="#10a37f" />,
  };
  return icons[provider] || <Bot size={size} />;
};

const MODELS = [
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout',    provider: 'groq',     color: '#f97316', free: true,  vision: true,  tags: ['vision','multilingual','function'] },
  { id: 'llama-3.3-70b-versatile',                   label: 'Llama 3.3 70B',    provider: 'groq',     color: '#f97316', free: true,  vision: false, tags: ['multilingual','text']              },
  { id: 'llama-3.1-8b-instant',                      label: 'Llama 3.1 8B',     provider: 'groq',     color: '#f97316', free: true,  vision: false, tags: ['text','fast']                      },
  { id: 'openai/gpt-oss-120b',                       label: 'GPT OSS 120B',     provider: 'groq',     color: '#f97316', free: true,  vision: false, tags: ['reasoning','function','multilingual']},
  { id: 'openai/gpt-oss-20b',                        label: 'GPT OSS 20B',      provider: 'groq',     color: '#f97316', free: true,  vision: false, tags: ['reasoning','function','safety']    },
  { id: 'qwen/qwen3-32b',                            label: 'Qwen3 32B',        provider: 'groq',     color: '#f97316', free: true,  vision: false, tags: ['reasoning','function','text']      },
  { id: 'gemini-2.5-flash',                          label: 'Gemini 2.5 Flash', provider: 'gemini',   color: '#4285f4', free: false, vision: true,  tags: ['vision','text']                    },
  { id: 'deepseek-chat',                             label: 'DeepSeek V3',      provider: 'deepseek', color: '#4f8ef7', free: false, vision: false, tags: ['text','reasoning']                 },
  { id: 'gpt-4o-mini',                               label: 'GPT-4o Mini',      provider: 'openai',   color: '#10a37f', free: false, vision: true,  tags: ['vision','text']                    },
  { id: 'gpt-4o',                                    label: 'GPT-4o',           provider: 'openai',   color: '#10a37f', free: false, vision: true,  tags: ['vision','text']                    },
];

const LANGUAGES = [
  { code: 'hi-IN', label: '🇮🇳 Hindi',      stt: 'hi-IN' },
  { code: 'en-US', label: '🇺🇸 English',     stt: 'en-US' },
  { code: 'en-IN', label: '🇮🇳 English (IN)',stt: 'en-IN' },
  { code: 'zh-CN', label: '🇨🇳 Chinese',     stt: 'zh-CN' },
  { code: 'ja-JP', label: '🇯🇵 Japanese',    stt: 'ja-JP' },
  { code: 'ko-KR', label: '🇰🇷 Korean',      stt: 'ko-KR' },
  { code: 'fr-FR', label: '🇫🇷 French',      stt: 'fr-FR' },
  { code: 'de-DE', label: '🇩🇪 German',      stt: 'de-DE' },
  { code: 'es-ES', label: '🇪🇸 Spanish',     stt: 'es-ES' },
  { code: 'ar-SA', label: '🇸🇦 Arabic',      stt: 'ar-SA' },
  { code: 'ru-RU', label: '🇷🇺 Russian',     stt: 'ru-RU' },
  { code: 'pt-PT', label: '🇵🇹 Portuguese',  stt: 'pt-PT' },
];

const API_URLS = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai:   'https://api.openai.com/v1/chat/completions',
};

const KEY_HINTS = {
  gemini:   { label: 'Google AI Studio', url: 'https://aistudio.google.com', hint: 'Free tier available' },
  deepseek: { label: 'DeepSeek Platform', url: 'https://platform.deepseek.com', hint: 'Very cheap pricing' },
  openai:   { label: 'OpenAI Platform', url: 'https://platform.openai.com', hint: 'Pay per use' },
};

// ── Chat session storage ──────────────────────────────────────────────
const STORAGE_KEY = 'indichat_sessions';
function loadSessions(uid) {
  try { const a = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return a[uid] || []; } catch { return []; }
}
function saveSessions(uid, sessions) {
  try { const a = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); a[uid] = sessions; localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch {}
}
function genTitle(msgs) {
  const f = msgs.find(m => m.role === 'user');
  if (!f) return 'New Chat';
  return f.content.slice(0, 30) + (f.content.length > 30 ? '...' : '');
}


export default function Chat({ user }) {
  const navigate = useNavigate();
  const userId   = (user && (user.id || user.email)) || 'guest';
  const userName = (user && (user.name || (user.email && user.email.split('@')[0]))) || 'there';

  const [step,        setStep]        = useState('select');
  const [model,       setModel]       = useState(null);
  const [apiKey,      setApiKey]      = useState('');
  const [sessions,    setSessions]    = useState(() => loadSessions(userId));
  const [activeId,    setActiveId]    = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [listening,   setListening]   = useState(false);
  const [autoSpeak,   setAutoSpeak]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [voiceLang,   setVoiceLang]   = useState(() => localStorage.getItem('indi_voice_lang') || 'hi-IN');
  const [image,       setImage]       = useState(null);
  const imgRef    = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const recRef    = useRef(null);
  const msgsRef   = useRef(null);

  // Save sessions on change
  useEffect(() => { saveSessions(userId, sessions); }, [sessions, userId]);

  // Mobile keyboard fix — MUST be at top level, before any conditional returns
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // Scroll messages div (not page) on new message
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (model) {
      if (model.free) { setApiKey(''); return; }
      const saved = localStorage.getItem(`indi_key_${model.provider}`);
      if (saved) setApiKey(saved);
      else setApiKey('');
    }
  }, [model]);

  const startNewChat = () => {
    const id = Date.now().toString();
    const welcome = { id: 'w_' + id, role: 'assistant', content: `Welcome back, **${userName}**! How can I help you today? 😊`, ts: Date.now() };
    setActiveId(id);
    setMessages([welcome]);
    setSessions(prev => [{ id, title: 'New Chat', messages: [welcome], ts: Date.now() }, ...prev]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const saveAndStart = () => {
    if (!model.free && !apiKey.trim()) return;
    if (!model.free) localStorage.setItem(`indi_key_${model.provider}`, apiKey);
    setStep('chat');
    const id = Date.now().toString();
    const welcome = { id: 'w_' + id, role: 'assistant', content: `Welcome back, **${userName}**! How can I help you today? 😊`, ts: Date.now() };
    setActiveId(id);
    setMessages([welcome]);
    setSessions(prev => [{ id, title: 'New Chat', messages: [welcome], ts: Date.now() }, ...prev]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const switchSession = (sess) => {
    setActiveId(sess.id);
    setMessages(sess.messages || []);
    setSidebarOpen(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) { setMessages([]); setActiveId(null); }
  };

  const updateSession = (newMsgs, cid) => {
    setSessions(prev => prev.map(s => s.id === cid ? { ...s, messages: newMsgs, title: genTitle(newMsgs) } : s));
  };

  // ── Image upload ──────────────────────────────────────────────────
  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setImage({ base64, mime: file.type, preview: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  // Build messages with image for vision models
  const buildMessages = (history, imgData) => {
    return history.map((m, i) => {
      // Attach image to last user message if present
      if (m.role === 'user' && i === history.length - 1 && imgData) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: m.content || 'What is in this image?' },
            { type: 'image_url', image_url: { url: `data:${imgData.mime};base64,${imgData.base64}` } }
          ]
        };
      }
      return { role: m.role, content: m.content };
    });
  };

  // ── Gemini with vision ────────────────────────────────────────────
  const callGemini = async (history, key) => {
    const contents = history.map((m, i) => {
      const isLastUser = m.role === 'user' && i === history.length - 1;
      const parts = [{ text: m.content || '' }];
      if (isLastUser && image) {
        parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }) }
    );
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  const callOpenAICompat = async (history, key, url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: model.id, messages: history.map(m => ({ role: m.role, content: m.content })), max_tokens: 2048, temperature: 0.7 })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  };

  const send = async (text) => {
    if (!text?.trim() && !image || loading) return;
    const key = model.free ? '' : (localStorage.getItem(`indi_key_${model.provider}`) || apiKey);
    const msgText = text?.trim() || (image ? 'What is in this image?' : '');
    const cid = activeId;

    const userMsg = { role: 'user', content: msgText, id: Date.now(), image: image?.preview, ts: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    const sentImage = image;
    setImage(null);
    setLoading(true);
    setResponseTime(null);
    const t0 = Date.now();

    try {
      let reply = '';
      if (model.free) {
        const token = localStorage.getItem('token');
        const msgs = buildMessages(history, sentImage);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ model: model.id, messages: msgs }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
        reply = data.choices?.[0]?.message?.content || '';
      } else if (model.provider === 'gemini') {
        reply = await callGemini(history, key);
      } else {
        const token = localStorage.getItem('token');
        const msgs = buildMessages(history, sentImage);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ model: model.id, messages: msgs, api_key: key }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
        reply = data.choices?.[0]?.message?.content || '';
      }
      const elapsed = Date.now() - t0;
      setResponseTime(elapsed);
      const finalMsgs = [...history, { role: 'assistant', content: reply, id: Date.now() + 1, ms: elapsed }];
      setMessages(finalMsgs);
      updateSession(finalMsgs, cid);
      if (autoSpeak) speak(reply);
    } catch (e) {
      setResponseTime(Date.now() - t0);
      const errMsgs = [...history, { role: 'assistant', content: `⚠️ ${e.message}`, id: Date.now() + 1, error: true }];
      setMessages(errMsgs);
      updateSession(errMsgs, cid);
    } finally { setLoading(false); }
  };

  // ── Voice ─────────────────────────────────────────────────────────
  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Use Chrome for voice input'); return; }
    const rec = new SR();
    rec.lang = voiceLang;          // selected language
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = e => { const txt = e.results[0][0].transcript; setInput(txt); send(txt); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start(); recRef.current = rec; setListening(true);
  };

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang;            // selected language for TTS
    // Try to find a matching voice
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === voiceLang) ||
                  voices.find(v => v.lang.startsWith(voiceLang.split('-')[0]));
    if (match) u.voice = match;
    window.speechSynthesis.speak(u);
  };

  const changeLang = (code) => {
    setVoiceLang(code);
    localStorage.setItem('indi_voice_lang', code);
  };

  // ── Model Select Screen ───────────────────────────────────────────
  if (step === 'select') {
    const hint = model && !model.free ? KEY_HINTS[model.provider] : null;
    return (
      <div style={{ ...pg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* BG orbs */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', top: '-150px', right: '-150px', background: 'radial-gradient(circle, rgba(79,142,247,0.07) 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', bottom: '-100px', left: '-100px', background: 'radial-gradient(circle, rgba(124,106,247,0.07) 0%, transparent 70%)', animation: 'float 10s ease-in-out infinite reverse' }} />
        </div>

        <div style={{ width: '100%', maxWidth: '600px', padding: '24px', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px', animation: 'slideUp 0.4s ease' }}>
            <button onClick={() => navigate('/')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 14px', color: t.text2, cursor: 'pointer', fontSize: '13px', marginBottom: '20px' }}>
              <ArrowLeft size={14} /> Back to Home
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ animation: 'float 6s ease-in-out infinite' }}>
                <IndiChatLogo size={80} />
              </div>
            </div>
            <h1 className="grad-text" style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 6px', letterSpacing: '-0.5px' }}>IndiChat-Ai</h1>
            <p style={{ color: t.text2, fontSize: '13px' }}>Select your AI model to start chatting</p>
            <p style={{ color: t.text3, fontSize: '11px', marginTop: '3px' }}>powered by IndiTech Corporation</p>
          </div>

          {/* Free models */}
          <div style={{ marginBottom: '20px', animation: 'slideUp 0.4s 0.05s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: 20, height: 20, background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={11} color="#22c55e" />
              </div>
              <span style={{ fontSize: '11px', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Free Models — No API Key Needed</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {MODELS.filter(m => m.free).map((m, i) => (
                <div key={m.id} className="card-3d" onClick={() => setModel(m)}
                  style={{ padding: '14px', background: model?.id === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${model?.id === m.id ? m.color : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', cursor: 'pointer', transition: 'all .2s', animation: `slideUp 0.4s ${0.1 + i * 0.04}s both`, boxShadow: model?.id === m.id ? `0 0 20px ${m.color}33` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ width: 32, height: 32, background: `${m.color}22`, border: `1px solid ${m.color}44`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ProviderIcon provider={m.provider} size={15} />
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {m.vision && <div style={{ background: '#4285f422', border: '1px solid #4285f444', borderRadius: '4px', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '2px' }}><Eye size={9} color="#4285f4" /></div>}
                      <div style={{ background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: '4px', padding: '2px 5px' }}><span style={{ fontSize: '9px', color: '#22c55e', fontWeight: '700' }}>FREE</span></div>
                    </div>
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: model?.id === m.id ? m.color : t.text }}>{m.label}</div>
                  <div style={{ fontSize: '10px', color: t.text3, marginTop: '2px' }}>Groq</div>
                </div>
              ))}
            </div>
          </div>

          {/* Paid models */}
          <div style={{ marginBottom: '20px', animation: 'slideUp 0.4s 0.15s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: 20, height: 20, background: `${t.accent}22`, border: `1px solid ${t.accent}44`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={11} color={t.accent} />
              </div>
              <span style={{ fontSize: '11px', color: t.text2, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Custom Models — Your API Key</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {MODELS.filter(m => !m.free).map((m, i) => (
                <div key={m.id} className="card-3d" onClick={() => setModel(m)}
                  style={{ padding: '14px', background: model?.id === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${model?.id === m.id ? m.color : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', cursor: 'pointer', transition: 'all .2s', animation: `slideUp 0.4s ${0.2 + i * 0.04}s both`, boxShadow: model?.id === m.id ? `0 0 20px ${m.color}33` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ width: 32, height: 32, background: `${m.color}22`, border: `1px solid ${m.color}44`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ProviderIcon provider={m.provider} size={15} />
                    </div>
                    {m.vision && <div style={{ background: '#4285f422', border: '1px solid #4285f444', borderRadius: '4px', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '2px' }}><Eye size={9} color="#4285f4" /></div>}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: model?.id === m.id ? m.color : t.text }}>{m.label}</div>
                  <div style={{ fontSize: '10px', color: t.text3, marginTop: '2px', textTransform: 'capitalize' }}>{m.provider}</div>
                </div>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          {model && !model.free && hint && (
            <div className="glass" style={{ borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', animation: 'slideUp 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '13px' }}>
                  <Lock size={14} color={t.accent} /> API Key for {model.provider}
                </div>
                <a href={hint.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: t.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  Get key <ChevronRight size={11} />
                </a>
              </div>
              <input className="neon-border"
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }}
                type="password" placeholder={`Enter ${model.provider} API key...`}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveAndStart()} autoFocus />
              <div style={{ fontSize: '11px', color: t.text3, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Lock size={10} /> Stored locally · {hint.hint}
              </div>
              <button className="btn-3d"
                style={{ width: '100%', padding: '12px', background: apiKey.trim() ? 'linear-gradient(135deg,#4f8ef7,#7c6af7)' : 'rgba(255,255,255,0.05)', color: apiKey.trim() ? '#fff' : t.text3, border: 'none', borderRadius: '10px', cursor: apiKey.trim() ? 'pointer' : 'default', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: apiKey.trim() ? '0 4px 20px rgba(79,142,247,0.3)' : 'none' }}
                onClick={saveAndStart} disabled={!apiKey.trim()}>
                Start Chatting <ArrowRight size={16} />
              </button>
            </div>
          )}

          {model && model.free && (
            <button className="btn-3d"
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 32px rgba(79,142,247,0.4)', animation: 'slideUp 0.3s ease' }}
              onClick={saveAndStart}>
              Start Chatting with {model.label} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Chat Screen ───────────────────────────────────────────────────
  if (!model) { setStep('select'); return null; }

  return (
    <div className="chat-root" style={{ display: 'flex', flexDirection: 'column', height: 'calc(var(--vh, 1vh) * 100)', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif", overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
      )}
      {/* Sidebar — slide in/out, always rendered */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: '100%', width: '260px', background: t.bg2, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', zIndex: 50, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease' }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IndiChatLogo size={24} />
            <span style={{ fontWeight: '700', fontSize: '13px', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IndiChat-Ai</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={iconBtn}><X size={16} /></button>
        </div>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => { startNewChat(); setSidebarOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: '8px', color: t.accent, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
            <Plus size={14} /> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {sessions.length === 0 && <div style={{ textAlign: 'center', color: t.text3, fontSize: '12px', padding: '20px 8px' }}>No chats yet</div>}
          {sessions.map(sess => (
            <div key={sess.id} onClick={() => switchSession(sess)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px', background: activeId === sess.id ? 'rgba(79,142,247,0.12)' : 'transparent', border: activeId === sess.id ? '1px solid rgba(79,142,247,0.2)' : '1px solid transparent' }}>
              <MessageSquare size={12} color={t.text3} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '13px', color: activeId === sess.id ? t.text : t.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.title}</span>
              <button onClick={e => deleteSession(e, sess.id)} style={{ background: 'transparent', border: 'none', color: t.text3, cursor: 'pointer', padding: '2px', borderRadius: '4px', flexShrink: 0 }}><X size={11} /></button>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 10px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button onClick={() => { setStep('select'); setSidebarOpen(false); }} style={sideBtn}><Cpu size={13} /> Change Model</button>
          <button onClick={() => navigate('/devices')} style={sideBtn}><MessageSquare size={13} /> My Devices</button>
          <button onClick={() => navigate('/')} style={sideBtn}><ArrowLeft size={13} /> Back to Home</button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar — FIXED, never scrolls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg, flexShrink: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={iconBtn} title="Chats"><Menu size={20} /></button>
          <button onClick={() => navigate('/')} style={{ ...iconBtn, color: t.text2 }} title="Home"><ArrowLeft size={18} /></button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ width: 22, height: 22, background: `${model.color}22`, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ProviderIcon provider={model.provider} size={12} />
            </div>
            <span style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.label}</span>
            {model.free && <span style={{ fontSize: '10px', color: '#22c55e', background: '#22c55e22', padding: '1px 6px', borderRadius: '4px', border: '1px solid #22c55e33', flexShrink: 0 }}>FREE</span>}
          </div>
          <select value={voiceLang} onChange={e => { setVoiceLang(e.target.value); localStorage.setItem('indi_voice_lang', e.target.value); }}
            style={{ background: t.bg2, border: `1px solid ${t.border}`, color: t.text, borderRadius: '6px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer', outline: 'none', maxWidth: '90px' }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => setAutoSpeak(!autoSpeak)} style={{ ...iconBtn, color: autoSpeak ? t.accent : t.text2 }} title="Auto speak">
            {autoSpeak ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button onClick={startNewChat} style={iconBtn} title="New chat"><RefreshCw size={16} /></button>
        </div>

        {/* Messages — ONLY this scrolls */}
        <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0', WebkitOverflowScrolling: 'touch' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '60px', padding: '0 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <IndiChatLogo size={72} />
              </div>
              <h2 style={{ fontSize: 'clamp(18px,4vw,24px)', fontWeight: '800', margin: '0 0 8px', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Welcome, {userName}!
              </h2>
              <p style={{ color: t.text2, fontSize: '14px', margin: '0 0 4px' }}>How can I help you today?</p>
              <p style={{ color: t.text3, fontSize: '12px' }}>IndiChat-Ai · {model.label}</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ maxWidth: '760px', margin: '0 auto', padding: '4px 14px' }}>
              {msg.id && msg.id.toString().startsWith('w_') ? (
                <div style={{ textAlign: 'center', padding: '24px 16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                    <IndiChatLogo size={64} />
                  </div>
                  <h2 style={{ fontSize: 'clamp(18px,4vw,22px)', fontWeight: '800', margin: '0 0 8px', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Welcome, {userName}!
                  </h2>
                  <p style={{ color: t.text2, fontSize: '14px', margin: 0 }}>How can I help you today?</p>
                </div>
              ) : msg.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                  <div style={{ background: `linear-gradient(135deg,${t.accent},${t.accent2})`, borderRadius: '16px 16px 4px 16px', padding: '10px 16px', maxWidth: '80%', fontSize: '15px', lineHeight: 1.6, color: '#fff' }}>
                    {msg.image && <img src={msg.image} alt="uploaded" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', display: 'block', marginBottom: msg.content ? '8px' : 0 }} />}
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '2px' }}>
                  <div style={{ width: 26, height: 26, background: `${model.color}22`, border: `1px solid ${model.color}44`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <ProviderIcon provider={model.provider} size={12} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', lineHeight: 1.75, color: msg.error ? t.danger : t.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content ? msg.content.replace(/\*\*(.*?)\*\*/g, '$1') : ''}
                    </div>
                    {!msg.error && (
                      <button onClick={() => speak(msg.content)} style={{ background: 'transparent', border: 'none', color: t.text3, cursor: 'pointer', fontSize: '11px', padding: '3px 0 0', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <Volume2 size={11} /> Speak
                      </button>
                    )}
                    {msg.ms && <span style={{ fontSize: '11px', color: t.text3 }}>{msg.ms < 1000 ? `${msg.ms}ms` : `${(msg.ms/1000).toFixed(1)}s`}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4px 14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: 26, height: 26, background: `${model.color}22`, border: `1px solid ${model.color}44`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ProviderIcon provider={model.provider} size={12} />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: '7px', height: '7px', background: t.text2, borderRadius: '50%', animation: `pulse 1.4s ${i*0.2}s infinite` }} />)}
                <span style={{ fontSize: '11px', color: t.text3, marginLeft: '6px' }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input — fixed, never scrolls */}
        <div style={{ padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', borderTop: `1px solid ${t.border}`, background: t.bg, flexShrink: 0 }}>
          {image && (
            <div style={{ maxWidth: '760px', margin: '0 auto 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={image.preview} alt="preview" style={{ height: '48px', borderRadius: '6px', border: `1px solid ${t.border}` }} />
              <button onClick={() => setImage(null)} style={{ background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px' }}>✕ Remove</button>
            </div>
          )}
          <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end', background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '8px 10px' }}>
            <button onClick={toggleMic}
              style={{ background: listening ? '#ef444422' : 'transparent', border: `1px solid ${listening ? t.danger : t.border}`, borderRadius: '8px', padding: '7px', cursor: 'pointer', color: listening ? t.danger : t.text2, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            {model.vision && (
              <>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                <button onClick={() => imgRef.current?.click()}
                  style={{ background: image ? `${t.accent}22` : 'transparent', border: `1px solid ${image ? t.accent : t.border}`, borderRadius: '8px', padding: '7px', cursor: 'pointer', color: image ? t.accent : t.text2, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <ImagePlus size={18} />
                </button>
              </>
            )}
            <textarea ref={inputRef}
              style={{ flex: 1, background: 'transparent', border: 'none', color: t.text, fontSize: '15px', outline: 'none', resize: 'none', lineHeight: 1.5, maxHeight: '100px', minHeight: '24px', fontFamily: 'inherit' }}
              placeholder="Message IndiChat-Ai..."
              inputMode="text"
              value={input} rows={1}
              onFocus={() => {
                // Scroll input into view when keyboard opens on mobile
                setTimeout(() => inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
              }}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            />
            <button onClick={() => send(input)} disabled={loading || (!input.trim() && !image)}
              style={{ background: (input.trim() || image) && !loading ? `linear-gradient(135deg,${t.accent},${t.accent2})` : t.bg3, border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: (input.trim() || image) ? 'pointer' : 'default', color: '#fff', flexShrink: 0, opacity: (input.trim() || image) && !loading ? 1 : 0.4, display: 'flex', alignItems: 'center' }}>
              <Send size={17} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        textarea::placeholder { color: ${t.text3}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
        /* Mobile keyboard fix */
        @supports (-webkit-touch-callout: none) {
          .chat-root { height: -webkit-fill-available !important; }
        }
      `}</style>
    </div>
  );
}

const pg      = { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif" };
const iconBtn = { background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sideBtn = { background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', fontSize: '13px', padding: '8px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left' };
const ghostBtn = { background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', fontSize: '13px', padding: '8px 10px', borderRadius: '8px', display: 'block' };
const inp     = { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
