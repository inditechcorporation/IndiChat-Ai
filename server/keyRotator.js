/**
 * Groq Key Rotator
 * - Multiple keys comma-separated in GROQ_API_KEY env
 * - Auto-rotates to next key on 429 (rate limit) error
 * - Tracks which key is currently active
 */

let keys = [];
let currentIndex = 0;
let exhaustedUntil = {}; // key -> timestamp when it resets

function loadKeys() {
  const raw = process.env.GROQ_API_KEY || '';
  keys = raw.split(',').map(k => k.trim()).filter(k => k.startsWith('gsk_'));
  if (keys.length === 0) {
    console.warn('[KeyRotator] No valid GROQ keys found in GROQ_API_KEY');
  } else {
    console.log(`[KeyRotator] Loaded ${keys.length} Groq key(s)`);
  }
}

// Get current active key
function getKey() {
  if (keys.length === 0) loadKeys();
  if (keys.length === 0) return '';

  const now = Date.now();

  // Find a non-exhausted key starting from currentIndex
  for (let i = 0; i < keys.length; i++) {
    const idx = (currentIndex + i) % keys.length;
    const key = keys[idx];
    if (!exhaustedUntil[key] || exhaustedUntil[key] < now) {
      currentIndex = idx;
      return key;
    }
  }

  // All keys exhausted - return least recently exhausted
  console.warn('[KeyRotator] All Groq keys exhausted! Using least-exhausted key.');
  let minTime = Infinity;
  let bestKey = keys[0];
  for (const key of keys) {
    if ((exhaustedUntil[key] || 0) < minTime) {
      minTime = exhaustedUntil[key] || 0;
      bestKey = key;
    }
  }
  return bestKey;
}

// Mark a key as rate-limited, rotate to next
function markExhausted(key, retryAfterMs = 60000) {
  exhaustedUntil[key] = Date.now() + retryAfterMs;
  console.warn(`[KeyRotator] Key ...${key.slice(-6)} exhausted, rotating. Next reset in ${retryAfterMs/1000}s`);
  // Move to next key
  const idx = keys.indexOf(key);
  if (idx !== -1) {
    currentIndex = (idx + 1) % keys.length;
  }
}

// Status for admin
function getStatus() {
  if (keys.length === 0) loadKeys();
  const now = Date.now();
  return keys.map((key, i) => ({
    index: i + 1,
    key: `...${key.slice(-6)}`,
    active: i === currentIndex,
    exhausted: !!(exhaustedUntil[key] && exhaustedUntil[key] > now),
    resetsIn: exhaustedUntil[key] ? Math.max(0, Math.round((exhaustedUntil[key] - now) / 1000)) : 0,
  }));
}

// Reload keys (if .env changed)
function reload() {
  keys = [];
  exhaustedUntil = {};
  currentIndex = 0;
  loadKeys();
}

loadKeys();

module.exports = { getKey, markExhausted, getStatus, reload };
