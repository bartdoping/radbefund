// tests/unit/services/rateLimiter.test.ts
import { rateLimiterService } from '../../../src/services/rateLimiter';

// Mock cache service
jest.mock('../../../src/services/cache', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
}));

describe('RateLimiterService', () => {
  const mockReq = {
    ip: '192.168.1.1',
    userId: 'test-user-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockResolvedValue(5); // Current count
      cacheService.set.mockResolvedValue(undefined);

      const result = await rateLimiterService.checkRateLimit('api', mockReq);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(94); // 100 - 5 - 1
      expect(result.totalHits).toBe(6);
    });

    it('should block requests exceeding limit', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockResolvedValue(100); // At limit

      const result = await rateLimiterService.checkRateLimit('api', mockReq);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.totalHits).toBe(101);
    });

    it('should use tier-specific limits for AI endpoints', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockResolvedValue(10);

      const result = await rateLimiterService.checkRateLimit('ai', mockReq, 'premium');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(39); // 50 - 10 - 1 (premium limit)
    });

    it('should handle cache errors gracefully', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockRejectedValue(new Error('Cache error'));

      const result = await rateLimiterService.checkRateLimit('api', mockReq);

      expect(result.allowed).toBe(true); // Fail open
      expect(result.remaining).toBe(100);
    });

    it('should generate correct cache keys', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockResolvedValue(0);
      cacheService.set.mockResolvedValue(undefined);

      await rateLimiterService.checkRateLimit('api', mockReq);

      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:api:192.168.1.1:')
      );
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit information', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockResolvedValue(25);

      const info = await rateLimiterService.getRateLimitInfo('api', mockReq);

      expect(info).toHaveProperty('limit', 100);
      expect(info).toHaveProperty('remaining', 75);
      expect(info).toHaveProperty('resetTime');
      expect(info).toHaveProperty('windowMs', 60000);
    });

    it('should return null for unknown config', async () => {
      const info = await rateLimiterService.getRateLimitInfo('unknown', mockReq);
      expect(info).toBeNull();
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for user', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.del.mockResolvedValue(undefined);

      const result = await rateLimiterService.resetRateLimit('api', mockReq);

      expect(result).toBe(true);
      expect(cacheService.del).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:api:192.168.1.1:')
      );
    });

    it('should return false for unknown config', async () => {
      const result = await rateLimiterService.resetRateLimit('unknown', mockReq);
      expect(result).toBe(false);
    });
  });

  describe('checkSlidingWindowRateLimit', () => {
    it('should allow requests within sliding window', async () => {
      const { cacheService } = require('../../../src/services/cache');
      const now = Date.now();
      const requests = [now - 1000, now - 2000, now - 3000]; // 3 requests in last 5 seconds
      cacheService.get.mockResolvedValue(requests);
      cacheService.set.mockResolvedValue(undefined);

      const result = await rateLimiterService.checkSlidingWindowRateLimit(
        'test-key',
        5000, // 5 second window
        10    // 10 requests max
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(6); // 10 - 3 - 1
    });

    it('should block requests exceeding sliding window', async () => {
      const { cacheService } = require('../../../src/services/cache');
      const now = Date.now();
      const requests = Array.from({ length: 10 }, (_, i) => now - i * 100); // 10 requests
      cacheService.get.mockResolvedValue(requests);

      const result = await rateLimiterService.checkSlidingWindowRateLimit(
        'test-key',
        5000,
        10
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should filter out old requests', async () => {
      const { cacheService } = require('../../../src/services/cache');
      const now = Date.now();
      const requests = [
        now - 1000,  // Valid
        now - 2000,  // Valid
        now - 6000,  // Too old
        now - 7000   // Too old
      ];
      cacheService.get.mockResolvedValue(requests);
      cacheService.set.mockResolvedValue(undefined);

      const result = await rateLimiterService.checkSlidingWindowRateLimit(
        'test-key',
        5000,
        10
      );

      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(3); // 2 valid + 1 new
    });
  });

  describe('checkBurstProtection', () => {
    it('should allow normal burst patterns', async () => {
      const { cacheService } = require('../../../src/services/cache');
      cacheService.get.mockResolvedValue([]);

      const result = await rateLimiterService.checkBurstProtection('test-key');

      expect(result).toBe(true);
    });

    it('should block excessive bursts', async () => {
      const { cacheService } = require('../../../src/services/cache');
      const now = Date.now();
      const requests = Array.from({ length: 6 }, () => now); // 6 requests at same time
      cacheService.get.mockResolvedValue(requests);

      const result = await rateLimiterService.checkBurstProtection('test-key', 1000, 5);

      expect(result).toBe(false);
    });
  });

  describe('config management', () => {
    it('should add custom config', () => {
      const customConfig = {
        windowMs: 30000,
        maxRequests: 50,
        keyGenerator: (req: any) => `custom:${req.ip}`
      };

      rateLimiterService.addConfig('custom', customConfig);
      const configs = rateLimiterService.getConfigs();

      expect(configs.has('custom')).toBe(true);
      expect(configs.get('custom')).toEqual(customConfig);
    });

    it('should remove config', () => {
      const result = rateLimiterService.removeConfig('custom');
      expect(result).toBe(true);

      const configs = rateLimiterService.getConfigs();
      expect(configs.has('custom')).toBe(false);
    });

    it('should return all configs', () => {
      const configs = rateLimiterService.getConfigs();

      expect(configs).toBeInstanceOf(Map);
      expect(configs.size).toBeGreaterThan(0);
      expect(configs.has('api')).toBe(true);
      expect(configs.has('auth')).toBe(true);
      expect(configs.has('ai')).toBe(true);
    });
  });
});
