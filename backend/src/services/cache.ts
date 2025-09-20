// src/services/cache.ts
import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

export class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis connection error:', error);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  // Cache Keys
  private static getCacheKey(type: string, identifier: string): string {
    return `radbefund:${type}:${identifier}`;
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  // Specific cache methods
  async getUserSession(userId: string): Promise<any | null> {
    const key = CacheService.getCacheKey('user_session', userId);
    return await this.get(key);
  }

  async setUserSession(userId: string, sessionData: any): Promise<boolean> {
    const key = CacheService.getCacheKey('user_session', userId);
    return await this.set(key, sessionData, config.cache.ttl.userSession);
  }

  async getLayoutTemplate(layoutId: string): Promise<any | null> {
    const key = CacheService.getCacheKey('layout', layoutId);
    return await this.get(key);
  }

  async setLayoutTemplate(layoutId: string, template: any): Promise<boolean> {
    const key = CacheService.getCacheKey('layout', layoutId);
    return await this.set(key, template, config.cache.ttl.layoutTemplate);
  }

  async getAIResponse(hash: string): Promise<string | null> {
    const key = CacheService.getCacheKey('ai_response', hash);
    return await this.get(key);
  }

  async setAIResponse(hash: string, response: string): Promise<boolean> {
    const key = CacheService.getCacheKey('ai_response', hash);
    return await this.set(key, response, config.cache.ttl.aiResponse);
  }

  async getUserPreferences(userId: string): Promise<any | null> {
    const key = CacheService.getCacheKey('user_prefs', userId);
    return await this.get(key);
  }

  async setUserPreferences(userId: string, preferences: any): Promise<boolean> {
    const key = CacheService.getCacheKey('user_prefs', userId);
    return await this.set(key, preferences, config.cache.ttl.userPreferences);
  }

  // Cache statistics
  async getStats(): Promise<any> {
    if (!this.isConnected) return null;
    
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: this.isConnected,
        memory: info,
        keyspace: keyspace,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return null;
    }
  }

  // Clear all cache
  async clearAll(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.redis.flushdb();
      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
