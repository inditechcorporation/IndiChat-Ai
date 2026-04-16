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
 * Keywords that indicate real-time or factual info needed
 */
function needsWebSearch(query) {
  const keywords = [
    // English
    'news', 'today', 'latest', 'current', 'now', 'price', 'stock',
    'weather', 'update', 'recent', 'live', 'breaking', 'trending',
    '2024', '2025', '2026',
    'who is', 'who are', 'what is', 'when did', 'where is',
    'mla', 'mp', 'minister', 'cm', 'pm', 'president', 'election',
    'winner', 'result', 'score', 'match',
    // Hindi
    'aaj', 'abhi', 'khabar', 'taza', 'kaun hai', 'kya hai',
    'bidhayak', 'saansad', 'mantri', 'mukhyamantri', 'pradhanmantri',
    'chunav', 'neta', 'party', 'sarkar', 'vidhayak', 'vidhan',
    'jeet', 'haar', 'result', 'natija',
    // General factual
    'capital', 'population', 'founded', 'born', 'died', 'age',
    'headquarter', 'ceo', 'owner', 'chairman'
  ];
  const q = query.toLowerCase();
  return keywords.some(k => q.includes(k));
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
