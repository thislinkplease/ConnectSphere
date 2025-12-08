/**
 * Simple in-memory cache service to reduce API calls
 * Helps optimize Supabase API usage
 */

interface CacheEntry<T> {
   data: T;
   timestamp: number;
   expiresAt: number;
}

class CacheService {
   private cache: Map<string, CacheEntry<any>> = new Map();
   private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default
   private cleanupInterval: NodeJS.Timeout | null = null;

   /**
    * Get cached data if it exists and hasn't expired
    */
   get<T>(key: string): T | null {
      const entry = this.cache.get(key);
      
      if (!entry) {
         return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
         this.cache.delete(key);
         return null;
      }

      return entry.data as T;
   }

   /**
    * Set data in cache with optional TTL (time to live in milliseconds)
    */
   set<T>(key: string, data: T, ttl?: number): void {
      const timestamp = Date.now();
      const expiresAt = timestamp + (ttl || this.defaultTTL);

      this.cache.set(key, {
         data,
         timestamp,
         expiresAt,
      });
   }

   /**
    * Invalidate (remove) a specific cache entry
    */
   invalidate(key: string): void {
      this.cache.delete(key);
   }

   /**
    * Invalidate all cache entries matching a pattern
    */
   invalidatePattern(pattern: string): void {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
         if (regex.test(key)) {
            this.cache.delete(key);
         }
      }
   }

   /**
    * Clear all cache
    */
   clearAll(): void {
      this.cache.clear();
   }

   /**
    * Clean up expired entries
    */
   cleanup(): void {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
         if (now > entry.expiresAt) {
            this.cache.delete(key);
         }
      }
   }

   /**
    * Get cache stats
    */
   getStats() {
      return {
         size: this.cache.size,
         keys: Array.from(this.cache.keys()),
      };
   }

   /**
    * Start automatic cleanup of expired entries
    */
   startAutoCleanup(intervalMs: number = 10 * 60 * 1000): void {
      if (this.cleanupInterval) {
         return; // Already running
      }
      this.cleanupInterval = setInterval(() => {
         this.cleanup();
      }, intervalMs);
   }

   /**
    * Stop automatic cleanup
    */
   stopAutoCleanup(): void {
      if (this.cleanupInterval) {
         clearInterval(this.cleanupInterval);
         this.cleanupInterval = null;
      }
   }
}

const cacheServiceInstance = new CacheService();

// Start auto cleanup (10 minutes interval)
cacheServiceInstance.startAutoCleanup();

export default cacheServiceInstance;
