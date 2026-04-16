const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getKey, markExhausted } = require('../keyRotator');
const { all } = require('../db');
const { webSearch, needsWebSearch, buildSearchContext } = require('../webSearch');
const router = express.Router();

const GROQ_FREE_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

// Get platform identity from DB
async function getPlatformIdentity() {
  const rows = await all('SELECT key, value FROM platform_settings WHERE key IN (?,?,?,?)',
    ['ai_name', 'ai_intro', 'creator_name', 'creator_intro']);
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return {
    ai_name:       s.ai_name       || 'IndiChat',
    ai_intro:      s.ai_intro      || 'I am IndiChat, your intelligent voice assistant.',
    creator_name:  s.creator_name  || 'IndiTech Corporation',
    creator_intro: s.creator_intro || 'IndiTech Corporation builds smart AI-powered devices.',
  };
}

// Build system prompt from platform identity
function buildSystemPrompt(identity, userName) {
  const name = userName || 'friend';
  return `You are ${identity.ai_name}, a highly intelligent and accurate AI assistant created by ${identity.creator_name}. ${identity.ai_intro}

The user's name is ${name}. Use their name naturally when it feels right.

ACCURACY RULES (most important):
- ALWAYS use the [REAL-TIME WEB DATA] provided below if available — it contains verified, current information
- If web data is provided, base your answer on it — do NOT rely on your training data for factual questions
- If you are not sure about something and no web data is available, say "I'm not 100% sure, but..." — never confidently give wrong information
- For location questions (kahan hai, where is, address), use web data
- For people questions (kaun hai, who is, bidhayak, MLA, minister), use web data
- For current events, news, prices — always use web data
- If web data contradicts your training, trust the web data

Your personality:
- Be conversational, friendly, and engaging
- Match the user's energy: casual if they are casual, focused if serious
- Use light humor when appropriate
- Give concise answers unless detail is needed
- Use emojis sparingly (1-2 max, only when natural)
- Be patient and supportive

Identity rules:
- Always introduce yourself as ${identity.ai_name} when asked
- Never say you are made by Google, Meta, Groq, OpenAI, or any other company
- You are ${identity.ai_name} by ${identity.creator_name}
- ${identity.creator_intro}`;
}

// POST /api/chat
router.post('/', authMiddleware, async (req, res) => {
  const { model, messages, api_key } = req.body;
  if (!model || !messages) return res.status(400).json({ error: 'model and messages required' });

  const isGroqFree = GROQ_FREE_MODELS.includes(model);
  const key = isGroqFree ? (getKey() || api_key || '') : (api_key || '');
  if (!key) return res.status(400).json({ error: 'No API key available.' });

  // Inject platform identity as system prompt
  const identity = await getPlatformIdentity();
  const userName = req.user?.name || req.user?.email?.split('@')[0] || '';
  let systemPrompt = buildSystemPrompt(identity, userName);

  // Web search — check if last user message needs real-time info
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  const lastQuery   = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

  if (lastQuery && needsWebSearch(lastQuery)) {
    try {
      console.log('[Chat] Web search triggered for:', lastQuery.slice(0, 60));
      const searchResult = await webSearch(lastQuery);
      const searchCtx    = buildSearchContext(searchResult);
      if (searchCtx) {
        systemPrompt += `\n\n===== REAL-TIME WEB DATA (USE THIS FOR YOUR ANSWER) =====\n${searchCtx}\n===== END WEB DATA =====\n\nIMPORTANT: Base your answer on the web data above. It is more accurate than your training data.`;
        console.log(`[Chat] Web search done (cache: ${searchResult.fromCache})`);
      }
    } catch (e) {
      console.warn('[Chat] Web search failed:', e.message);
    }
  } else {
    console.log('[Chat] No web search needed for:', lastQuery.slice(0, 60));
  }

  // Check if any message has image content (vision request)
  const hasImage = messages.some(m => Array.isArray(m.content));

  let finalMessages = [...messages];

  if (hasImage) {
    // For vision: system prompt as first message with string content only
    // Don't prepend system if messages already have it
    if (!finalMessages.length || finalMessages[0].role !== 'system') {
      finalMessages = [{ role: 'system', content: systemPrompt }, ...finalMessages];
    }
  } else {
    if (!finalMessages.length || finalMessages[0].role !== 'system') {
      finalMessages = [{ role: 'system', content: systemPrompt }, ...finalMessages];
    } else {
      finalMessages[0] = { role: 'system', content: systemPrompt };
    }
  }

  let url;
  if (isGroqFree || model.startsWith('llama') || model.startsWith('meta-llama') || model.startsWith('moonshotai') || model.startsWith('qwen') || model.startsWith('openai/')) {
    url = 'https://api.groq.com/openai/v1/chat/completions';
  } else if (model.startsWith('deepseek')) {
    url = 'https://api.deepseek.com/chat/completions';
  } else if (model.startsWith('gpt')) {
    url = 'https://api.openai.com/v1/chat/completions';
  } else {
    url = 'https://api.groq.com/openai/v1/chat/completions';
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    // Check content type before parsing
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await upstream.text();
      console.error('[Chat] Non-JSON response:', text.substring(0, 200));
      return res.status(500).json({ error: 'Upstream returned non-JSON response' });
    }

    const data = await upstream.json();
    if (!upstream.ok) {
      if (upstream.status === 429 && isGroqFree) markExhausted(key);
      return res.status(upstream.status).json({ error: data.error?.message || 'Upstream error' });
    }
    // Strip <think>...</think> blocks (Qwen3 reasoning traces)
    if (data.choices?.[0]?.message?.content) {
      data.choices[0].message.content = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
    res.json(data);
  } catch (e) {
    console.error('[Chat] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
