const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getKey, markExhausted } = require('../keyRotator');
const { getGeminiKey, markGeminiExhausted, loadGeminiKeys } = require('../geminiKeyRotator');
const { all } = require('../db');
const { webSearch, needsWebSearch, buildSearchContext, classifyQuery } = require('../webSearch');
const router = express.Router();

// Load Gemini keys on startup
loadGeminiKeys();

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

ACCURACY RULES (CRITICAL - follow always):
- ALWAYS combine your training knowledge WITH web search data
- If [VERIFIED WEB DATA] is provided below, it is more accurate than your training — use it
- If web data and your training agree, give confident answer
- If web data contradicts your training, ALWAYS trust the web data
- If no web data and you are unsure, say: "I'm not fully certain — please verify this"
- NEVER give confidently wrong information — accuracy is more important than speed
- For locations, people, current events, prices — always rely on web data
- If web search failed, clearly warn: "Note: I could not verify this online, please double-check"

ANSWER STYLE:
- Give DIRECT answers first — no preamble, no "Great question!"
- If asked "tum kaun ho" or "who are you" — answer ONLY as ${identity.ai_name}, nothing else
- Do NOT search the web for identity questions about yourself
- Keep answers concise unless detail is requested

Your personality:
- Be conversational, friendly, and engaging
- Match the user's energy: casual if they are casual, focused if serious
- Use light humor when appropriate
- Give concise answers unless detail is needed
- NEVER use emojis in responses — use plain text, symbols like *, -, >, or arrows instead
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
    const category = classifyQuery(lastQuery);
    try {
      console.log(`[Chat] Category: ${category} | Searching: ${lastQuery.slice(0, 60)}`);
      const searchResult = await webSearch(lastQuery);
      const searchCtx    = buildSearchContext(searchResult);
      if (searchCtx) {
        systemPrompt += `\n\n===== VERIFIED WEB DATA (ALWAYS USE THIS) =====\n${searchCtx}\n===== END =====\n\nCRITICAL: Combine your knowledge WITH the web data above. If web data contradicts your training, TRUST the web data. Never give wrong information — if unsure, say so clearly.`;
        console.log(`[Chat] Web search done (cache: ${searchResult.fromCache})`);
      }
    } catch (e) {
      console.warn('[Chat] Web search failed:', e.message);
      // Add warning to prompt so AI knows to be careful
      systemPrompt += `\n\nNOTE: Web search failed for this query. Use your training data carefully. If you are not 100% sure about any fact, clearly say "I'm not certain, please verify this."`;
    }
  } else {
    console.log(`[Chat] Category: GREEN | LLM only: ${lastQuery.slice(0, 60)}`);
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
  } else if (model.startsWith('gemini')) {
    // Gemini — use admin key rotation (server-side, never exposed to client)
    const geminiKey = getGeminiKey() || api_key;
    if (!geminiKey) return res.status(400).json({ error: 'No Gemini API key available. Add keys in Admin Panel.' });

    // Map free model ID to actual Gemini model ID
    const actualModel = model === 'gemini-2.5-flash-free' ? 'gemini-2.5-flash' : model;

    // Convert messages to Gemini format
    const geminiContents = finalMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: Array.isArray(m.content)
          ? m.content.map(p => p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.image_url?.url?.split(';')[0]?.split(':')[1] || 'image/jpeg', data: p.image_url?.url?.split(',')[1] || '' } })
          : [{ text: m.content || '' }]
      }));

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
          })
        }
      );

      if (!geminiRes.ok) {
        const err = await geminiRes.json();
        if (geminiRes.status === 429) markGeminiExhausted(geminiKey);
        return res.status(geminiRes.status).json({ error: err.error?.message || 'Gemini error' });
      }

      const gData = await geminiRes.json();
      const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.json({ choices: [{ message: { role: 'assistant', content: text } }] });
    } catch (e) {
      console.error('[Chat] Gemini error:', e.message);
      return res.status(500).json({ error: e.message });
    }
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
