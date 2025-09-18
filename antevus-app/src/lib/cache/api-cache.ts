/**
 * Simple in-memory cache for API responses
 * In production, consider Redis or other distributed cache
 */
import { logger } from '@/lib/logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class APICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private defaultTTL: number = 5 * 60 * 1000 // 5 minutes default

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const now = Date.now()
    const isExpired = now - entry.timestamp > entry.ttl

    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * Clear specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    if (pattern.length > 128) return
    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch {
      return
    }
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key)
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const apiCache = new APICache()

// Set up periodic cleanup (every 10 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.cleanup()
  }, 10 * 60 * 1000)
}

/**
 * Higher-order function to wrap API calls with caching
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number
    forceRefresh?: boolean
  }
): Promise<T> {
  const { ttl, forceRefresh = false } = options || {}

  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cached = apiCache.get<T>(key)
    if (cached !== null) {
      logger.debug(`[Cache Hit] ${key}`)
      return cached
    }
  }

  logger.debug(`[Cache Miss] ${key}`)

  try {
    // Fetch fresh data
    const data = await fetcher()

    // Store in cache
    apiCache.set(key, data, ttl)

    return data
  } catch (error) {
    // On error, return stale cache if available
    const staleData = apiCache.get<T>(key)
    if (staleData !== null) {
      logger.warn(`[Cache Stale] Returning stale data for ${key} due to error`)
      return staleData
    }

    throw error
  }
}

/**
 * React hook for cached API calls
 * @param _key - Cache key
 * @param _fetcher - Function to fetch data
 * @param _options - Cache options
 */
export function useCachedAPI<T>(
  _key: string,
  _fetcher: () => Promise<T>,
  _options?: {
    ttl?: number
    refreshInterval?: number
  }
): {
  data: T | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
} {
  // This would be implemented with React hooks
  // Placeholder for now - implement when needed
  return {
    data: null,
    loading: false,
    error: null,
    refresh: async () => {}
  }
}