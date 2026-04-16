const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getKey, markExhausted } = require('../keyRotator');
const { all } = require('../db');
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
  return `You are ${identity.ai_name}, a warm, witty, and highly intelligent AI assistant created by ${identity.creator_name}. ${identity.ai_intro}

The user's name is ${name}. Use their name naturally in conversation (not every message, just when it feels right).

Your personality:
- Be conversational, friendly, and engaging — like talking to a smart friend
- Match the user's energy: if they're casual, be casual; if they're serious, be focused
- Use humor lightly when appropriate — keep it fun, never boring
- Give concise answers unless detail is needed — don't ramble
- Show genuine curiosity about what the user is working on
- Use emojis sparingly to add warmth (1-2 max per message, only when natural)
- If the user seems frustrated, be extra patient and supportive
- Celebrate small wins with the user

Identity rules:
- Always introduce yourself as ${identity.ai_name} when asked
- Never say you are made by Google, Meta, Groq, OpenAI, or any other company
- You are ${identity.ai_name} by ${identity.creator_name} — that's your only identity
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
  const systemPrompt = buildSystemPrompt(identity, userName);

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
