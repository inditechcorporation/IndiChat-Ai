/**
 * Web Search Service
 * - Uses Tavily API for real-time web search
 * - Uses Upstash Redis for caching (5 min TTL)
 * - Cost optimized: cache first, search only if needed
 */

const { Redis } = require('@upstash/redis');

const CACHE_TTL = 300; // 5 minutes in seconds
const MAX_RESULTS = 3;

// Initialize Redis client
let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[WebSearch] Redis cache initialized');
  }
} catch (e) {
  console.warn('[WebSearch] Redis init failed:', e.message);
}

/**
 * Safety check — if ANY of these keywords present, MUST use web search
 * Never answer from LLM alone for these
 */
function isUnsafeToAnswerFromLLM(q) {
  return [
    'latest', 'today', 'news', 'current', 'update', 'price',
    'who is', 'result', 'where is',
    // Hindi equivalents
    'kahan hai', 'kahan par', 'kaha hai', 'kaha par',
    'kaun hai', 'kaun hain', 'kya hai',
    'aaj', 'abhi', 'taza', 'khabar',
  ].some(k => q.toLowerCase().includes(k));
}

/**
 * Smart Query Classifier
 * Category 1 (RED)   — Real-time → ALWAYS search
 * Category 2 (YELLOW) — Uncertain → search if confidence < 90%
 * Category 3 (GREEN)  — Stable knowledge → LLM only
 */
function classifyQuery(query) {
  if (!query || query.trim().length < 3) return 'GREEN';

  const q = query.trim().toLowerCase();

  // Identity questions — always GREEN (AI answers itself)
  const identityPatterns = [
    /^(tum|aap|you|tu)\s+(kaun|kya|kon)\s+(ho|hain|hai|are)/i,
    /^(who are you|what are you|kaun ho tum|aap kaun hain)/i,
    /^(your name|tumhara naam|aapka naam)/i,
    /^(introduce yourself|apna parichay)/i,
  ];
  if (identityPatterns.some(p => p.test(q))) return 'GREEN';

  // Pure conversational — GREEN
  const conversational = [
    /^(hi|hello|hey|hii|namaste|namaskar|salam)[\s!.?]*$/i,
    /^(how are you|kaise ho|kya haal|thanks|thank you|shukriya)[\s!.?]*$/i,
    /^(yes|no|haan|nahi|ok|okay|sure|bilkul|theek hai)[\s!.?]*$/i,
    /^(bye|goodbye|alvida|good night|good morning)[\s!.?]*$/i,
  ];
  if (conversational.some(p => p.test(q))) return 'GREEN';

  // Pure math/code — GREEN
  if (/^[\d\s+\-*/()=.%^]+$/.test(q)) return 'GREEN';
  if (/^(calculate|solve|code|program|write a function|explain|define|what is|kya hota hai|matlab|difference between)/i.test(q)) return 'GREEN';

  // Category 1 RED — Real-time, must search
  const redKeywords = [
    'latest', 'today', 'abhi', 'aaj', 'now', 'current', 'recent', 'update',
    'news', 'khabar', 'taza', 'live', 'breaking', 'trending',
    'price', 'rate', 'stock', 'weather', 'mausam',
    'result', 'score', 'match', 'election', 'chunav',
    'winner', 'jeet', 'haar', '2025', '2026',
    'announced', 'launched', 'released',
  ];
  if (redKeywords.some(k => q.includes(k))) return 'RED';

  // Category 2 YELLOW — Uncertain, search if needed
  const yellowKeywords = [
    // People & places
    'kaun hai', 'who is', 'where is', 'kahan hai', 'kahan par',
    'bidhayak', 'vidhayak', 'mla', 'mp', 'minister', 'mantri',
    'cm', 'pm', 'president', 'governor', 'mukhyamantri',
    'neta', 'party', 'sarkar',
    // Locations
    'address', 'location', 'distance', 'capital', 'headquarter',
    // Facts about people
    'born', 'died', 'age', 'wife', 'husband', 'father', 'mother',
    'ceo', 'owner', 'founder', 'chairman',
    // General factual
    'population', 'area', 'height', 'length', 'speed',
    'history', 'itihas', 'founded', 'established',
  ];
  if (yellowKeywords.some(k => q.includes(k))) return 'YELLOW';

  // Default — if question is factual-sounding, use YELLOW
  if (q.length > 20 && (q.includes('?') || q.includes('kya') || q.includes('kaun') || q.includes('kahan') || q.includes('kab') || q.includes('kitna'))) {
    return 'YELLOW';
  }

  return 'GREEN';
}

/**
 * Check if query needs web search based on category + safety check
 */
function needsWebSearch(query) {
  if (!query) return false;
  // Safety net — these MUST always be searched
  if (isUnsafeToAnswerFromLLM(query)) return true;
  const category = classifyQuery(query);
  return category === 'RED' || category === 'YELLOW';
}

/**
 * Search Tavily API
 */
async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');

  const res = await fetch('https://api.tavily.com/search', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:        apiKey,
      query:          query,
      search_depth:   'basic',
      max_results:    MAX_RESULTS,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily error: ${res.status} ${err}`);
  }

  const data = await res.json();

  // Extract only important facts
  const results = (data.results || []).slice(0, MAX_RESULTS).map(r => ({
    title:   r.title,
    content: r.content ? r.content.slice(0, 300) : '',
    url:     r.url,
  }));

  return {
    answer:  data.answer || '',
    results,
  };
}

/**
 * Main search function with Redis cache
 */
async function webSearch(query) {
  const cacheKey = `ws:${query.toLowerCase().trim().slice(0, 100)}`;

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('[WebSearch] Cache hit:', query.slice(0, 50));
        return { ...cached, fromCache: true };
      }
    } catch (e) {
      console.warn('[WebSearch] Cache read error:', e.message);
    }
  }

  // Search Tavily
  console.log('[WebSearch] Searching:', query.slice(0, 50));
  const result = await tavilySearch(query);

  // Save to cache
  if (redis) {
    try {
      await redis.set(cacheKey, result, { ex: CACHE_TTL });
    } catch (e) {
      console.warn('[WebSearch] Cache write error:', e.message);
    }
  }

  return { ...result, fromCache: false };
}

/**
 * Build context string from search results for LLM
 */
function buildSearchContext(searchResult) {
  if (!searchResult) return '';

  let ctx = '';
  if (searchResult.answer) {
    ctx += `Web Search Answer: ${searchResult.answer}\n\n`;
  }
  if (searchResult.results && searchResult.results.length > 0) {
    ctx += 'Sources:\n';
    searchResult.results.forEach((r, i) => {
      ctx += `${i + 1}. ${r.title}: ${r.content}\n`;
    });
  }
  return ctx;
}

module.exports = { webSearch, needsWebSearch, buildSearchContext, classifyQuery, isUnsafeToAnswerFromLLM };
