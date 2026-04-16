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
 * Safety check — MUST use web search for these
 */
function isUnsafeToAnswerFromLLM(q) {
  const unsafe = [
    'latest', 'today', 'news', 'current', 'update', 'price', 'who is', 'result', 'where is',
    'kahan hai', 'kahan par', 'kaha hai', 'kaun hai', 'kaun hain',
    'aaj', 'abhi', 'taza', 'khabar', 'score', 'match', 'election',
  ];
  return unsafe.some(k => q.toLowerCase().includes(k));
}

/**
 * Smart Query Classifier
 * GREEN  = pure conversational/math/code — LLM only
 * YELLOW = factual but stable — search to verify
 * RED    = real-time/changing — always search
 */
function classifyQuery(query) {
  if (!query || query.trim().length < 3) return 'GREEN';
  const q = query.trim().toLowerCase();

  // Identity — GREEN (AI answers itself)
  if (/^(tum|aap|you|tu)\s+(kaun|kya|kon)\s+(ho|hain|hai|are)/i.test(q)) return 'GREEN';
  if (/^(who are you|what are you|kaun ho tum|introduce yourself)/i.test(q)) return 'GREEN';

  // Pure greetings — GREEN
  if (/^(hi|hello|hey|hii|namaste|thanks|bye|good night|good morning|kaise ho|theek hai|ok|haan|nahi)[\s!.?]*$/i.test(q)) return 'GREEN';

  // Pure math/code — GREEN
  if (/^[\d\s+\-*/()=.%^]+$/.test(q)) return 'GREEN';
  if (/^(calculate|solve|write code|write a function|explain concept|define|difference between|how does.*work)/i.test(q)) return 'GREEN';

  // RED — real-time, must search
  const red = ['latest', 'today', 'abhi', 'aaj', 'now', 'current', 'recent', 'update', 'news', 'khabar', 'taza', 'live', 'breaking', 'trending', 'price', 'rate', 'stock', 'weather', 'mausam', 'result', 'score', 'match', 'election', 'chunav', 'winner', '2025', '2026', 'announced', 'launched', 'released'];
  if (red.some(k => q.includes(k))) return 'RED';

  // YELLOW — factual, verify with search
  const yellow = [
    'kaun hai', 'who is', 'where is', 'kahan hai', 'kahan par', 'kaha hai',
    'bidhayak', 'vidhayak', 'mla', 'mp', 'minister', 'mantri', 'cm', 'pm',
    'president', 'governor', 'mukhyamantri', 'neta', 'party', 'sarkar',
    'address', 'location', 'distance', 'capital', 'headquarter',
    'born', 'died', 'age', 'wife', 'husband', 'father', 'mother',
    'ceo', 'owner', 'founder', 'chairman', 'population', 'area',
    'history', 'itihas', 'founded', 'established', 'kitna', 'kab',
  ];
  if (yellow.some(k => q.includes(k))) return 'YELLOW';

  // Any question with ? or Hindi question words — YELLOW (verify)
  if (q.length > 15 && (q.includes('?') || /\b(kya|kaun|kahan|kab|kitna|kyun|kaise)\b/.test(q))) return 'YELLOW';

  // Default for longer queries — YELLOW (better safe than wrong)
  if (q.length > 30) return 'YELLOW';

  return 'GREEN';
}

/**
 * Check if query needs web search
 */
function needsWebSearch(query) {
  if (!query) return false;
  if (isUnsafeToAnswerFromLLM(query)) return true;
  const cat = classifyQuery(query);
  return cat === 'RED' || cat === 'YELLOW';
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
