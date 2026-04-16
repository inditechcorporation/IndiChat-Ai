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
 * Check if query needs web search
 * Skip conversational, identity, and math queries
 */
function needsWebSearch(query) {
  if (!query || query.trim().length < 3) return false;

  const q = query.trim().toLowerCase();

  // Skip pure conversational/greeting queries
  const skipPatterns = [
    /^(hi|hello|hey|hii|helo|namaste|namaskar|salam|salaam)[\s!.?]*$/i,
    /^(how are you|kaise ho|kya haal|what's up|sup|ok|okay|thanks|thank you|shukriya|dhanyawad)[\s!.?]*$/i,
    /^(yes|no|haan|nahi|nope|yep|sure|bilkul|theek hai|thik hai)[\s!.?]*$/i,
    /^(bye|goodbye|alvida|tata|good night|good morning|good evening)[\s!.?]*$/i,
  ];
  if (skipPatterns.some(p => p.test(q))) return false;

  // Skip identity questions — AI should answer these itself
  const identityPatterns = [
    /^(tum|aap|you|tu)\s+(kaun|kya|kon)\s+(ho|hain|hai|are)/i,
    /^(who are you|what are you|kaun ho tum|aap kaun hain)/i,
    /^(your name|tumhara naam|aapka naam|apna naam)/i,
    /^(introduce yourself|apna parichay|apne baare mein)/i,
  ];
  if (identityPatterns.some(p => p.test(q))) return false;

  // Skip very short math/calculation queries
  if (/^[\d\s+\-*/()=.]+$/.test(q)) return false;

  // Everything else needs web search for accuracy
  return true;
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

module.exports = { webSearch, needsWebSearch, buildSearchContext };
