const { Redis } = require("@upstash/redis");

let redis = null;

/**
 * Get or create Redis client (singleton)
 * Falls back gracefully if Redis is not configured
 */
const getRedis = () => {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("⚠️ Redis not configured - caching disabled");
    return null;
  }

  try {
    redis = new Redis({ url, token });
    console.log("🔴 Redis (Upstash) connected");
    return redis;
  } catch (error) {
    console.error("Redis connection error:", error.message);
    return null;
  }
};

// Default TTLs (in seconds)
const TTL = {
  TASKS: 120,        // 2 min - tasks change frequently (timers, status)
  CATEGORIES: 600,   // 10 min - categories change rarely
  TEMPLATES: 600,    // 10 min - templates change rarely
  TODOS: 120,        // 2 min - todos get toggled often
  ANALYTICS: 300,    // 5 min - analytics are expensive queries
};

/**
 * Build a user-scoped cache key
 * @param {string} userId 
 * @param {string} resource - e.g., "tasks", "categories"
 * @param  {...string} parts - additional key parts
 * @returns {string}
 */
const cacheKey = (userId, resource, ...parts) => {
  const suffix = parts.filter(Boolean).join(":");
  return `user:${userId}:${resource}${suffix ? ":" + suffix : ""}`;
};

/**
 * Get cached data
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
const getCache = async (key) => {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(key);
    if (data) {
      console.log(`[CACHE HIT] ${key}`);
    }
    return data || null;
  } catch (error) {
    console.warn(`[CACHE ERROR] get ${key}:`, error.message);
    return null;
  }
};

/**
 * Set cached data with TTL
 * @param {string} key 
 * @param {any} data 
 * @param {number} ttl - seconds
 */
const setCache = async (key, data, ttl) => {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(data), { ex: ttl });
    console.log(`[CACHE SET] ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.warn(`[CACHE ERROR] set ${key}:`, error.message);
  }
};

/**
 * Invalidate cache keys matching a pattern
 * Uses SCAN to find keys, then deletes them
 * @param {string} pattern - e.g., "user:abc123:tasks*"
 */
const invalidateCache = async (pattern) => {
  const client = getRedis();
  if (!client) return;

  try {
    // Upstash supports scan
    let cursor = 0;
    let keysToDelete = [];

    do {
      const result = await client.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      keysToDelete = keysToDelete.concat(result[1]);
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      // Delete in batches using pipeline
      await Promise.all(keysToDelete.map((key) => client.del(key)));
      console.log(`[CACHE INVALIDATE] ${pattern} → ${keysToDelete.length} keys removed`);
    }
  } catch (error) {
    console.warn(`[CACHE ERROR] invalidate ${pattern}:`, error.message);
  }
};

/**
 * Delete a specific cache key
 * @param {string} key 
 */
const deleteCache = async (key) => {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
    console.log(`[CACHE DEL] ${key}`);
  } catch (error) {
    console.warn(`[CACHE ERROR] del ${key}:`, error.message);
  }
};

module.exports = {
  getRedis,
  TTL,
  cacheKey,
  getCache,
  setCache,
  invalidateCache,
  deleteCache,
};
