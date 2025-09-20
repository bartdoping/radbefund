// src/services/rateLimiter.ts
import { cacheService } from './cache';
import logger from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

export class RateLimiterService {
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    // General API rate limiting
    this.configs.set('api', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req) => `api:${req.ip}`,
    });

    // Auth endpoints (stricter)
    this.configs.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      keyGenerator: (req) => `auth:${req.ip}`,
    });

    // AI processing (user-based)
    this.configs.set('ai', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      keyGenerator: (req) => `ai:${req.userId || req.ip}`,
    });

    // AI processing for premium users
    this.configs.set('ai-premium', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50,
      keyGenerator: (req) => `ai:${req.userId}`,
    });

    // AI processing for enterprise users
    this.configs.set('ai-enterprise', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
      keyGenerator: (req) => `ai:${req.userId}`,
    });
  }

  async checkRateLimit(
    configName: string, 
    req: any, 
    userTier?: 'free' | 'premium' | 'enterprise'
  ): Promise<RateLimitResult> {
    const config = this.configs.get(configName);
    if (!config) {
      throw new Error(`Rate limit config '${configName}' not found`);
    }

    // Use tier-specific config for AI endpoints
    let effectiveConfig = config;
    if (configName === 'ai' && userTier) {
      const tierConfigName = `ai-${userTier}`;
      const tierConfig = this.configs.get(tierConfigName);
      if (tierConfig) {
        effectiveConfig = tierConfig;
      }
    }

    const key = effectiveConfig.keyGenerator ? 
      effectiveConfig.keyGenerator(req) : 
      `default:${req.ip}`;

    const windowStart = Math.floor(Date.now() / effectiveConfig.windowMs);
    const cacheKey = `rate_limit:${key}:${windowStart}`;

    try {
      // Get current count
      const currentCount = await cacheService.get<number>(cacheKey) || 0;
      
      // Check if limit exceeded
      const allowed = currentCount < effectiveConfig.maxRequests;
      const remaining = Math.max(0, effectiveConfig.maxRequests - currentCount - 1);
      const resetTime = (windowStart + 1) * effectiveConfig.windowMs;

      if (allowed) {
        // Increment counter
        await cacheService.set(cacheKey, currentCount + 1, Math.ceil(effectiveConfig.windowMs / 1000));
      }

      const result: RateLimitResult = {
        allowed,
        remaining,
        resetTime,
        totalHits: currentCount + 1,
      };

      // Log rate limit events
      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          configName,
          key,
          currentCount,
          maxRequests: effectiveConfig.maxRequests,
          userTier,
          ip: req.ip,
          userId: req.userId,
        });
      }

      return result;

    } catch (error) {
      logger.error('Rate limit check failed', { 
        configName, 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: effectiveConfig.maxRequests,
        resetTime: Date.now() + effectiveConfig.windowMs,
        totalHits: 0,
      };
    }
  }

  async getRateLimitInfo(configName: string, req: any): Promise<any> {
    const config = this.configs.get(configName);
    if (!config) {
      return null;
    }

    const key = config.keyGenerator ? config.keyGenerator(req) : `default:${req.ip}`;
    const windowStart = Math.floor(Date.now() / config.windowMs);
    const cacheKey = `rate_limit:${key}:${windowStart}`;

    try {
      const currentCount = await cacheService.get<number>(cacheKey) || 0;
      const remaining = Math.max(0, config.maxRequests - currentCount);
      const resetTime = (windowStart + 1) * config.windowMs;

      return {
        limit: config.maxRequests,
        remaining,
        resetTime,
        windowMs: config.windowMs,
      };
    } catch (error) {
      logger.error('Failed to get rate limit info', { configName, key, error });
      return null;
    }
  }

  async resetRateLimit(configName: string, req: any): Promise<boolean> {
    const config = this.configs.get(configName);
    if (!config) {
      return false;
    }

    const key = config.keyGenerator ? config.keyGenerator(req) : `default:${req.ip}`;
    const windowStart = Math.floor(Date.now() / config.windowMs);
    const cacheKey = `rate_limit:${key}:${windowStart}`;

    try {
      await cacheService.del(cacheKey);
      logger.info('Rate limit reset', { configName, key });
      return true;
    } catch (error) {
      logger.error('Failed to reset rate limit', { configName, key, error });
      return false;
    }
  }

  // Advanced rate limiting with sliding window
  async checkSlidingWindowRateLimit(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const cacheKey = `sliding_rate_limit:${key}`;

    try {
      // Get existing requests
      const requests = await cacheService.get<number[]>(cacheKey) || [];
      
      // Remove old requests outside the window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      const allowed = validRequests.length < maxRequests;
      const remaining = Math.max(0, maxRequests - validRequests.length - 1);
      const resetTime = now + windowMs;

      if (allowed) {
        // Add current request
        validRequests.push(now);
        await cacheService.set(cacheKey, validRequests, Math.ceil(windowMs / 1000));
      }

      return {
        allowed,
        remaining,
        resetTime,
        totalHits: validRequests.length + 1,
      };

    } catch (error) {
      logger.error('Sliding window rate limit check failed', { key, error });
      
      // Fail open
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: now + windowMs,
        totalHits: 0,
      };
    }
  }

  // Burst protection
  async checkBurstProtection(
    key: string,
    burstWindowMs: number = 1000, // 1 second
    maxBurstRequests: number = 5
  ): Promise<boolean> {
    const result = await this.checkSlidingWindowRateLimit(
      `burst:${key}`,
      burstWindowMs,
      maxBurstRequests
    );
    
    return result.allowed;
  }

  // Add custom rate limit config
  addConfig(name: string, config: RateLimitConfig): void {
    this.configs.set(name, config);
    logger.info('Rate limit config added', { name, config });
  }

  // Remove rate limit config
  removeConfig(name: string): boolean {
    const removed = this.configs.delete(name);
    if (removed) {
      logger.info('Rate limit config removed', { name });
    }
    return removed;
  }

  // Get all configs
  getConfigs(): Map<string, RateLimitConfig> {
    return new Map(this.configs);
  }
}

// Singleton instance
export const rateLimiterService = new RateLimiterService();
