,useCallback , Plus, X//──tohlprs ──────────────────────────────────────────────TORAGE_KEY'indich_sssion
funtilaSssions(urI){
try{
constall JON.prscalSorg.gItem(STORGE_EY)||{}rurn ll[uerId||} ach{rrn[] }}

fucavsi(urIdsos){
 ry {  ll = JON.r(lclorge.geItmSTORAGE_KEY || '{}') alluIssions  loalStag.etItm(SORAGE_KEYJSON.rigfy()}h{}
}

fnin nraeTil(sses{frst = ess.find(=>m.role=='r'
if(!frst)turn 'NChat'; returnfirst.nt.lic0, 30+(first.en.lngth > 30 ? '...':''
}

export default function Chat({ user }) {
  const navigate = useNavigate();
  const userId = user?.id || user?.email || 'guest';
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  const [step, setStep]           = useState('select');
  const [model, setModel]         = useState(null);
  const [apiKey, setApiKey]       = useState('');
  const [sessions, setSessions]   = useState(() => loadSessions(userId));
  const [activeId, setActiveId]   = useState(null);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState(() => localStorage.getItem('indi_voice_lang') || 'hi-IN');
  const [image, setImage]         = useState(null);

  const imgRef    = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const recRef    = useRef(null);
  const msgsRef   = useRef(null);

  // Save sessions whenever they change
  useEffect(() => { saveSessions(userId, sessions); }, [sessions, userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (model) {
      if (model.free) { setApiKey(''); return; }
      const saved = localStorage.getItem(`indi_key_${model.provider}`);
      if (saved) setApiKey(saved);
      else setApiKey('');
    }
  }, [model]);

  const startNewChat = useCallback(() => {
    const id = Date.now().toString();
    const welcome = {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome back, **${userName}**! How can I help you today?`,
      ts: Date.now()
    };
    setActiveId(id);
    setMessages([welcome]);
    setSessions(prev => [{ id, title: 'New Chat', messages: [welcome], model: model?.id, ts: Date.now() }, ...prev]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [userName, model]);

  const saveAndStart = () => {
    if (!model.free && !apiKey.trim()) return;
    if (!model.free) localStorage.setItem(`indi_key_${model.provider}`, apiKey);
    setStep('chat');
    startNewChat();
  };

  const switchSession = (sess) => {
    setActiveId(sess.id);
    setMessages(sess.messages || []);
    setSidebarOpen(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) {
      setMessages([]);
      setActiveId(null);
    }
  };

  const updateCurrentSession = (newMsgs) => {
    setSessions(prev => prev.map(s =>
      s.id === activeId
        ? { ...s, messages: newMsgs, title: generateTitle(newMsgs) }
        : s
    ));
  };

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

  const buildMessages = (history, imgData) => {
    return history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map((m, i) => {
        if (m.role === 'user' && i === history.filter(x => x.role === 'user' || x.role === 'assistant').length - 1 && imgData) {
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

  const callGemini = async (history, key) => {
    const contents = history.filter(m => m.role === 'user' || m.role === 'assistant').map((m, i, arr) => {
      const isLastUser = m.role === 'user' && i === arr.length - 1;
      const parts = [{ text: m.content || '' }];
      if (isLastUser && image) parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
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

  const send = async (text) => {
    if ((!text?.trim() && !image) || loading) return;
    const key = model.free ? '' : (localStorage.getItem(`indi_key_${model.provider}`) || apiKey);
    const msgText = text?.trim() || (image ? 'What is in this image?' : '');

    const userMsg = { id: Date.now(), role: 'user', content: msgText, image: image?.preview, ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    const sentImage = image;
    setImage(null);
    setLoading(true);

    try {
      let reply = '';
      const token = localStorage.getItem('token');
      const msgs = buildMessages(newMsgs, sentImage);

      if (model.provider === 'gemini') {
        reply = await callGemini(newMsgs, key);
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ model: model.id, messages: msgs, api_key: key }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
        reply = data.choices?.[0]?.message?.content || '';
      }

      // Replace user name if AI asks
      const aiMsg = { id: Date.now() + 1, role: 'assistant', content: reply, ts: Date.now() };
      const finalMsgs = [...newMsgs, aiMsg];
      setMessages(finalMsgs);
      updateCurrentSession(finalMsgs);
      if (autoSpeak) speak(reply);
    } catch (e) {
      const errMsg = { id: Date.now() + 1, role: 'error', content: `Error: ${e.message}`, ts: Date.now() };
      const finalMsgs = [...newMsgs, errMsg];
      setMessages(finalMsgs);
      updateCurrentSession(finalMsgs);
    } finally { setLoading(false); }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Use Chrome for voice input'); return; }
    const rec = new SR();
    rec.lang = voiceLang;
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
    u.lang = voiceLang;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === voiceLang) || voices.find(v => v.lang.startsWith(voiceLang.split('-')[0]));
    if (match) u.voice = match;
    window.speechSynthesis.speak(u);
  };

  const renderContent = (content) => {
    if (!content) return '';
    return content.replace(/\*\*(.*?)\*\*/g, '$1');
  };

  // ── Model Select Screen ───────────────────────────────────────────
  if (step === 'select') {
    const hint = model && !model.free ? KEY_HINTS[model.provider] : null;
    return (
      <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowX: 'hidden' }}>
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <button onClick={() => navigate('/')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 14px', color: t.text2, cursor: 'pointer', fontSize: '13px', marginBottom: '20px' }}>
              <ArrowLeft size={14} /> Back to Home
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <IndiChatLogo size={70} />
            </div>
            <h1 style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: '900', margin: '0 0 6px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Welcome, {userName}!
            </h1>
            <p style={{ color: t.text2, fontSize: '13px' }}>Select your AI model to start chatting</p>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Zap size={12} color="#22c55e" />
              <span style={{ fontSize: '11px', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Free Models</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
              {MODELS.filter(m => m.free).map(m => (
                <div key={m.id} onClick={() => setModel(m)}
                  style={{ padding: '12px', background: model?.id === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${model?.id === m.id ? m.color : 'rgba(255,255,255,0.07)'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ width: 28, height: 28, background: `${m.color}22`, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ProviderIcon provider={m.provider} size={13} />
                    </div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {m.vision && <span style={{ fontSize: '8px', color: '#4285f4', background: '#4285f422', border: '1px solid #4285f444', borderRadius: '3px', padding: '1px 4px' }}>👁</span>}
                      <span style={{ fontSize: '8px', color: '#22c55e', background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: '3px', padding: '1px 4px', fontWeight: '700' }}>FREE</span>
                    </div>
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '11px', color: model?.id === m.id ? m.color : t.text }}>{m.label}</div>
                  <div style={{ fontSize: '10px', color: t.text3, marginTop: '2px' }}>Groq</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Key size={12} color={t.accent} />
              <span style={{ fontSize: '11px', color: t.text2, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Custom Models</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
              {MODELS.filter(m => !m.free).map(m => (
                <div key={m.id} onClick={() => setModel(m)}
                  style={{ padding: '12px', background: model?.id === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${model?.id === m.id ? m.color : 'rgba(255,255,255,0.07)'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ width: 28, height: 28, background: `${m.color}22`, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ProviderIcon provider={m.provider} size={13} />
                    </div>
                    {m.vision && <span style={{ fontSize: '8px', color: '#4285f4', background: '#4285f422', border: '1px solid #4285f444', borderRadius: '3px', padding: '1px 4px' }}>👁</span>}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '11px', color: model?.id === m.id ? m.color : t.text }}>{m.label}</div>
                  <div style={{ fontSize: '10px', color: t.text3, marginTop: '2px', textTransform: 'capitalize' }}>{m.provider}</div>
                </div>
              ))}
            </div>
          </div>

          {model && !model.free && hint && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '13px' }}>
                  <Lock size={13} color={t.accent} /> API Key for {model.provider}
                </div>
                <a href={hint.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: t.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  Get key <ChevronRight size={10} />
                </a>
              </div>
              <input style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
                type="password" placeholder={`Enter ${model.provider} API key...`}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveAndStart()} autoFocus />
              <div style={{ fontSize: '11px', color: t.text3, marginBottom: '12px' }}>🔒 Stored locally · {hint.hint}</div>
              <button style={{ width: '100%', padding: '12px', background: apiKey.trim() ? 'linear-gradient(135deg,#4f8ef7,#7c6af7)' : 'rgba(255,255,255,0.05)', color: apiKey.trim() ? '#fff' : t.text3, border: 'none', borderRadius: '8px', cursor: apiKey.trim() ? 'pointer' : 'default', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={saveAndStart} disabled={!apiKey.trim()}>
                Start Chatting <ArrowRight size={16} />
              </button>
            </div>
          )}

          {model && model.free && (
            <button style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#4f8ef7,#7c6af7)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 32px rgba(79,142,247,0.4)' }}
              onClick={saveAndStart}>
              Start Chatting with {model.label} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!model) { setStep('select'); return null; }

  // ── Chat Screen ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100dvh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif", overflow: 'hidden', position: 'fixed', inset: 0 }}>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: '260px',
        background: t.bg2, borderRight: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column', zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease'
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '14px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IndiChatLogo size={26} />
            <div style={{ fontWeight: '700', fontSize: '13px', background: `linear-gradient(135deg,${t.accent},${t.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IndiChat-Ai</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={iconBtn}><X size={16} /></button>
        </div>

        {/* New chat button */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => { startNewChat(); setSidebarOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: '8px', color: t.accent, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
            <Plus size={15} /> New Chat
          </button>
        </div>

        {/* Chat history */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', color: t.text3, fontSize: '12px', padding: '20px 8px' }}>No chats yet</div>
          )}
          {sessions.map(sess => (
            <div key={sess.id} onClick={() => switchSession(sess)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px', background: activeId === sess.id ? 'rgba(79,142,247,0.12)' : 'transparent', border: activeId === sess.id ? '1px solid rgba(79,142,247,0.2)' : '1px solid transparent' }}>
              <MessageSquare size={13} color={t.text3} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '13px', color: activeId === sess.id ? t.text : t.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.title}</span>
              <button onClick={e => deleteSession(e, sess.id)}
                style={{ background: 'transparent', border: 'none', color: t.text3, cursor: 'pointer', padding: '2px', borderRadius: '4px', flexShrink: 0, opacity: 0.6 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button onClick={() => { setStep('select'); setSidebarOpen(false); }} style={{ ...sideBtn }}><Cpu size={13} /> Change Model</button>
          <button onClick={() => navigate('/devices')} style={{ ...sideBtn }}><MessageSquare size={13} /> My Devices</button>
          <button onClick={() => navigate('/')} style={{ ...sideBtn }}><ArrowLeft size={13} /> Back to Home</button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)} style={iconBtn} title="Open chats"><Menu size={20} /></button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ width: 22, height: 22, background: `${model.color}22`, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ProviderIcon provider={model.provider} size={12} />
            </div>
            <span style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.label}</span>
            {model.free && <span style={{ fontSize: '10px', color: '#22c55e', background: '#22c55e22', padding: '1px 6px', borderRadius: '4px', border: '1px solid #22c55e33', flexShrink: 0 }}>FREE</span>}
          </div>
          <select value={voiceLang} onChange={e => { setVoiceLang(e.target.value); localStorage.setItem('indi_voice_lang', e.target.value); }}
            style={{ background: t.bg2, border: `1px solid ${t.border}`, color: t.text, borderRadius: '6px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer', outline: 'none', maxWidth: '100px' }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => setAutoSpeak(!autoSpeak)} style={{ ...iconBtn, color: autoSpeak ? t.accent : t.text2 }} title="Auto speak">
            {autoSpeak ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button onClick={startNewChat} style={iconBtn} title="New chat"><RefreshCw size={16} /></button>
        </div>

        {/* Messages */}
        <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 0', WebkitOverflowScrolling: 'touch' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '60px', color: t.text2, padding: '0 16px' }}>
              <div style={{ width: 56, height: 56, background: `${model.color}22`, border: `1px solid ${model.color}44`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <ProviderIcon provider={model.provider} size={28} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: t.text, marginBottom: '6px' }}>Hello, {userName}!</div>
              <div style={{ fontSize: '13px' }}>How can I help you today?</div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ maxWidth: '760px', margin: '0 auto', padding: '4px 14px' }}>
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                  <div style={{ background: `linear-gradient(135deg,${t.accent},${t.accent2})`, borderRadius: '16px 16px 4px 16px', padding: '10px 16px', maxWidth: '80%', fontSize: '15px', lineHeight: 1.6, color: '#fff' }}>
                    {msg.image && <img src={msg.image} alt="uploaded" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', display: 'block', marginBottom: msg.content ? '8px' : 0 }} />}
                    {msg.content}
                  </div>
                </div>
              ) : msg.role === 'error' ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '2px' }}>
                  <div style={{ width: 26, height: 26, background: '#ef444422', border: '1px solid #ef444444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⚠️</div>
                  <div style={{ fontSize: '15px', lineHeight: 1.7, color: t.danger, background: '#ef444411', border: '1px solid #ef444433', borderRadius: '12px', padding: '10px 14px' }}>{msg.content}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '2px' }}>
                  <div style={{ width: 26, height: 26, background: `${model.color}22`, border: `1px solid ${model.color}44`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <ProviderIcon provider={model.provider} size={12} />
                  </div>
                  <div style={{ flex: 1, fontSize: '15px', lineHeight: 1.75, color: t.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {renderContent(msg.content)}
                    <button onClick={() => speak(msg.content)} style={{ background: 'transparent', border: 'none', color: t.text3, cursor: 'pointer', fontSize: '11px', padding: '4px 0 0', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                      <Volume2 size={11} /> Speak
                    </button>
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
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.border}`, background: t.bg, flexShrink: 0 }}>
          {image && (
            <div style={{ maxWidth: '760px', margin: '0 auto 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={image.preview} alt="preview" style={{ height: '50px', borderRadius: '6px', border: `1px solid ${t.border}` }} />
              <button onClick={() => setImage(null)} style={{ background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
            </div>
          )}
          <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'flex-end', background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '8px 10px' }}>
            <button onClick={toggleMic}
              style={{ background: listening ? '#ef444422' : 'transparent', border: `1px solid ${listening ? t.danger : t.border}`, borderRadius: '8px', padding: '7px', cursor: 'pointer', color: listening ? t.danger : t.text2, flexShrink: 0 }}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            {model.vision && (
              <>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />
                <button onClick={() => imgRef.current?.click()}
                  style={{ background: image ? `${t.accent}22` : 'transparent', border: `1px solid ${image ? t.accent : t.border}`, borderRadius: '8px', padding: '7px', cursor: 'pointer', color: image ? t.accent : t.text2, flexShrink: 0 }}>
                  <ImagePlus size={18} />
                </button>
              </>
            )}
            <textarea ref={inputRef}
              style={{ flex: 1, background: 'transparent', border: 'none', color: t.text, fontSize: '15px', outline: 'none', resize: 'none', lineHeight: 1.5, maxHeight: '100px', minHeight: '24px', fontFamily: 'inherit' }}
              placeholder="Message IndiChat-Ai..."
              value={input} rows={1}
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
      `}</style>
    </div>
  );
}

const iconBtn = { background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sideBtn = { background: 'transparent', border: 'none', color: t.text2, cursor: 'pointer', fontSize: '13px', padding: '8px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left' };
const pg      = { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter',-apple-system,sans-serif" };
