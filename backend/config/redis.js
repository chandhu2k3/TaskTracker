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

// Default TTLs (in seconds) - OPTIMIZED FOR FREE TIER
// Longer TTLs = fewer SET operations = lower Redis command usage
const TTL = {
  TASKS: 120,        // 2 min - not currently cached (auto-complete logic)
  CATEGORIES: 3600,  // 1 hour - categories rarely change
  TEMPLATES: 3600,   // 1 hour - templates rarely change
  TODOS: 120,        // 2 min - todos get toggled often
  ANALYTICS: 1800,   // 30 min - analytics expensive but can be stale
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
 * OPTIMIZED FOR FREE TIER: Avoids expensive SCAN operations
 * Analytics cache is NOT invalidated - relies on TTL expiry (5 min acceptable staleness)
 * @param {string} pattern - e.g., "user:abc123:tasks*"
 */
const invalidateCache = async (pattern) => {
  const client = getRedis();
  if (!client) return;

  try {
    // Extract the base key parts
    const baseParts = pattern.replace(/\*/g, '').split(':');
    const userId = baseParts[1];
    
    // For common patterns, delete known keys directly (no SCAN needed)
    const keysToDelete = [];
    
    if (pattern.includes(':tasks*')) {
      // Tasks aren't cached (auto-complete logic), skip
      console.log(`[CACHE INVALIDATE] ${pattern} → skipped (not cached)`);
      return;
    } else if (pattern.includes(':analytics*')) {
      // Analytics cache is NOT invalidated to save Redis commands
      // 5-minute TTL means max 5 min staleness, which is acceptable
      console.log(`[CACHE INVALIDATE] ${pattern} → skipped (TTL-based expiry)`);
      return;
    } else if (pattern.includes(':categories*')) {
      keysToDelete.push(`user:${userId}:categories`);
    } else if (pattern.includes(':templates*')) {
      keysToDelete.push(`user:${userId}:templates`);
    } else if (pattern.includes(':todos*')) {
      keysToDelete.push(`user:${userId}:todos`);
    }

    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map((key) => client.del(key)));
      console.log(`[CACHE INVALIDATE] ${keysToDelete.join(', ')} → deleted`);
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
