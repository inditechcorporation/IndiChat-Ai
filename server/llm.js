/**
 * LLM - Language Model
 * Streaming responses for minimum latency
 * 
 * Strategy for fast response:
 * - Stream tokens from LLM
 * - Split into sentences as they arrive
 * - Send each sentence to TTS immediately (don't wait for full response)
 * - ESP32 starts playing first sentence while rest is still generating
 * 
 * This gives ~1-2 second total latency vs ~4-5 seconds without streaming
 */

const { getKey, markExhausted } = require('./keyRotator');

// ── Build system prompt from device config ───────────────────────────
function buildSystemPrompt(config) {
  let prompt = '';

  if (config.bot_name)     prompt += `Your name is ${config.bot_name}. `;
  if (config.bot_intro)    prompt += `${config.bot_intro} `;
  if (config.creator_name) prompt += `You were created by ${config.creator_name}. `;
  if (config.creator_intro) prompt += `${config.creator_intro} `;

  const lang = config.speak_language || 'en-US';
  const langName = {
    'en-US': 'English', 'hi-IN': 'Hindi', 'zh-CN': 'Chinese',
    'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'fr-FR': 'French',
    'de-DE': 'German', 'es-ES': 'Spanish', 'ar-SA': 'Arabic',
    'ru-RU': 'Russian'
  }[lang] || 'English';

  prompt += `\nAlways respond in ${langName}.`;
  prompt += ` Keep responses concise, between ${config.min_words || 10} and ${config.max_words || 80} words.`;
  prompt += ` You are a voice assistant - avoid markdown, bullet points, or special characters.`;
  prompt += ` Speak naturally as if talking to a person.`;

  if (config.behavior) prompt += `\n\nBehavior: ${config.behavior}`;

  return prompt.trim();
}

// ── Split text into sentences for streaming TTS ──────────────────────
function splitSentences(text) {
  // Split on sentence endings, keeping the delimiter
  const parts = text.split(/(?<=[.!?।॥])\s+/);
  return parts.filter(s => s.trim().length > 3);
}

// ── Gemini streaming ─────────────────────────────────────────────────
async function* streamGemini(text, systemPrompt, apiKey, modelId) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId || 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
    }
  });

  const result = await model.generateContentStream(text);
  let buffer = '';

  for await (const chunk of result.stream) {
    const token = chunk.text();
    buffer += token;

    // Yield complete sentences as they form
    const sentences = splitSentences(buffer);
    if (sentences.length > 1) {
      // Yield all complete sentences except the last (might be incomplete)
      for (let i = 0; i < sentences.length - 1; i++) {
        if (sentences[i].trim()) yield sentences[i].trim();
      }
      buffer = sentences[sentences.length - 1];
    }
  }

  // Yield remaining buffer
  if (buffer.trim()) yield buffer.trim();
}

// ── DeepSeek streaming ───────────────────────────────────────────────
async function* streamDeepSeek(text, systemPrompt, apiKey, maxWords, modelId) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId || 'deepseek-chat',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: (maxWords || 80) * 2
    })
  });

  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content || '';
        textBuffer += token;

        const sentences = splitSentences(textBuffer);
        if (sentences.length > 1) {
          for (let i = 0; i < sentences.length - 1; i++) {
            if (sentences[i].trim()) yield sentences[i].trim();
          }
          textBuffer = sentences[sentences.length - 1];
        }
      } catch {}
    }
  }

  if (textBuffer.trim()) yield textBuffer.trim();
}

// ── OpenAI streaming (GPT-4o-mini is fast + cheap) ──────────────────
async function* streamOpenAI(text, systemPrompt, apiKey, maxWords) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: (maxWords || 80) * 2
    })
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content || '';
        textBuffer += token;

        const sentences = splitSentences(textBuffer);
        if (sentences.length > 1) {
          for (let i = 0; i < sentences.length - 1; i++) {
            if (sentences[i].trim()) yield sentences[i].trim();
          }
          textBuffer = sentences[sentences.length - 1];
        }
      } catch {}
    }
  }

  if (textBuffer.trim()) yield textBuffer.trim();
}

// ── Groq LLM streaming (llama3, mixtral - fast + free with admin key) ──
async function* streamGroq(text, systemPrompt, apiKey, model, maxWords) {
  const modelId = model || 'llama-3.1-8b-instant';
  const usedKey = apiKey || getKey();
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${usedKey}`
    },
    body: JSON.stringify({
      model: modelId,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: (maxWords || 80) * 2,
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) markExhausted(usedKey);
    throw new Error(`Groq LLM error: ${response.status} ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content || '';
        textBuffer += token;
        // Strip <think>...</think> from buffer
        textBuffer = textBuffer.replace(/<think>[\s\S]*?<\/think>/gi, '');
        const sentences = splitSentences(textBuffer);
        if (sentences.length > 1) {
          for (let i = 0; i < sentences.length - 1; i++)
            if (sentences[i].trim()) yield sentences[i].trim();
          textBuffer = sentences[sentences.length - 1];
        }
      } catch {}
    }
  }
  if (textBuffer.trim()) yield textBuffer.trim();
}

// ── Main stream function ─────────────────────────────────────────────
// Priority: user's own api_key → admin GROQ_API_KEY fallback
async function* streamResponse(userText, config) {
  const model      = config.ai_model  || 'groq';
  const userApiKey = config.api_key   || '';
  const prompt     = buildSystemPrompt(config);

  // Groq models use admin key rotation if user hasn't set their own
  const isGroqModel = model.startsWith('llama') || model.startsWith('meta-llama') ||
                      model.startsWith('moonshotai') || model.startsWith('qwen') ||
                      model.includes('kimi') || model.includes('gpt-oss') || model.startsWith('openai/');
  const effectiveKey = userApiKey || (isGroqModel ? getKey() : '');

  if (!effectiveKey) {
    yield 'API key is not configured. Please set it in the web platform or ask admin to set GROQ_API_KEY.';
    return;
  }

  console.log(`[LLM] Streaming with ${model}: "${userText}"`);

  try {
    if (model === 'gemini' || model.startsWith('gemini')) {
      yield* streamGemini(userText, prompt, effectiveKey, model === 'gemini' ? 'gemini-2.5-flash' : model);
    } else if (model === 'deepseek' || model.startsWith('deepseek')) {
      yield* streamDeepSeek(userText, prompt, effectiveKey, config.max_words, model === 'deepseek' ? 'deepseek-chat' : model);
    } else if (model === 'openai' || model.startsWith('gpt')) {
      yield* streamOpenAI(userText, prompt, effectiveKey, config.max_words);
    } else {
      // Default: Groq — covers llama, gpt-oss, qwen, kimi etc.
      const groqModel = model === 'groq' ? 'llama-3.1-8b-instant' : model;
      yield* streamGroq(userText, prompt, effectiveKey, groqModel, config.max_words);
    }
  } catch (e) {
    console.error(`[LLM] Error:`, e.message);
    yield 'Sorry, I had trouble thinking of a response. Please try again.';
  }
}

module.exports = { streamResponse };
