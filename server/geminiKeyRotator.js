/**
 * Gemini Key Rotator
 * - Multiple keys stored in platform_settings as 'gemini_api_keys' (comma-separated)
 * - Auto-rotates to next key on 429 (rate limit) error
 * - Falls back to Groq if all Gemini keys exhausted
 */

let geminiKeys = [];
let currentIndex = 0;
let exhaustedUntil = {}; // key -> timestamp when it resets (60 seconds)

async function loadGeminiKeys() {
  try {
    const { all } = require('./db');
    const rows = await all("SELECT value FROM platform_settings WHERE key = 'gemini_api_keys'");
    if (rows && rows[0] && rows[0].value && rows[0].value.trim()) {
      const dbKeys = rows[0].value.split(',').map(k => k.trim()).filter(k => k.startsWith('AIza'));
      if (dbKeys.length > 0) {
        geminiKeys = dbKeys;
        console.log(`[GeminiRotator] Loaded ${geminiKeys.length} Gemini key(s) from DB`);
        return;
      }
    }
  } catch (e) {
    console.warn('[GeminiRotator] Could not load keys from DB:', e.message);
  }

  // Fallback to env var
  const envKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k.length > 10);
  if (envKeys.length > 0) {
    geminiKeys = envKeys;
    console.log(`[GeminiRotator] Loaded ${geminiKeys.length} Gemini key(s) from ENV`);
  }
}

function getGeminiKey() {
  // Lazy load — reload from DB every time if no keys in memory
  if (geminiKeys.length === 0) {
    // Synchronously try to reload (async not possible here, so we trigger async reload)
    loadGeminiKeys().catch(() => {});
    return null;
  }

  const now = Date.now();
  for (let i = 0; i < geminiKeys.length; i++) {
    const idx = (currentIndex + i) % geminiKeys.length;
    const key = geminiKeys[idx];
    if (!exhaustedUntil[key] || exhaustedUntil[key] < now) {
      currentIndex = idx;
      return key;
    }
  }
  // All exhausted
  console.warn('[GeminiRotator] All Gemini keys exhausted — fallback to Groq');
  return null;
}

function markGeminiExhausted(key) {
  exhaustedUntil[key] = Date.now() + 60000; // 60 second cooldown
  console.warn(`[GeminiRotator] Key exhausted, cooldown 60s`);
  // Move to next key
  currentIndex = (currentIndex + 1) % geminiKeys.length;
}

function reloadGeminiKeys(keysStr) {
  geminiKeys = keysStr.split(',').map(k => k.trim()).filter(k => k.startsWith('AIza'));
  currentIndex = 0;
  exhaustedUntil = {};
  console.log(`[GeminiRotator] Reloaded ${geminiKeys.length} Gemini key(s)`);
}

function getGeminiStatus() {
  const now = Date.now();
  return geminiKeys.map((k, i) => ({
    index: i + 1,
    key: k.slice(0, 8) + '...',
    active: i === currentIndex,
    exhausted: !!(exhaustedUntil[k] && exhaustedUntil[k] > now),
    resetsIn: exhaustedUntil[k] ? Math.max(0, Math.round((exhaustedUntil[k] - now) / 1000)) : 0,
  }));
}

module.exports = { loadGeminiKeys, getGeminiKey, markGeminiExhausted, reloadGeminiKeys, getGeminiStatus };
