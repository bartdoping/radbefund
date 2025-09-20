// src/config/index.ts
import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  server: {
    port: number;
    nodeEnv: string;
    useHttps: boolean;
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    pool: {
      min: number;
      max: number;
      idle: number;
    };
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authWindowMs: number;
    authMaxRequests: number;
  };
  ai: {
    provider: string;
    openaiApiKey?: string;
    openaiModel: string;
  };
  monitoring: {
    prometheusPort: number;
    logLevel: string;
  };
  cache: {
    ttl: {
      userSession: number;
      layoutTemplate: number;
      aiResponse: number;
      userPreferences: number;
    };
  };
  security: {
    corsOrigin: string[];
    helmetEnabled: boolean;
  };
}

const config: Config = {
  server: {
    port: Number(process.env.PORT || 3001),
    nodeEnv: process.env.NODE_ENV || 'development',
    useHttps: (process.env.USE_HTTPS ?? 'true').toLowerCase() === 'true',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/radbefund_plus',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || 'radbefund_plus',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: 2,
      max: 10,
      idle: 10000,
    },
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 60),
    authWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 900000),
    authMaxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 5),
  },
  ai: {
    provider: (process.env.PROVIDER || 'openai').toLowerCase(),
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  monitoring: {
    prometheusPort: Number(process.env.PROMETHEUS_PORT || 9090),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  cache: {
    ttl: {
      userSession: Number(process.env.CACHE_TTL_USER_SESSION || 604800), // 7 Tage
      layoutTemplate: Number(process.env.CACHE_TTL_LAYOUT_TEMPLATE || 2592000), // 30 Tage
      aiResponse: Number(process.env.CACHE_TTL_AI_RESPONSE || 3600), // 1 Stunde
      userPreferences: Number(process.env.CACHE_TTL_USER_PREFERENCES || 86400), // 1 Tag
    },
  },
  security: {
    corsOrigin: (process.env.CORS_ORIGIN || 'https://localhost:3000,https://127.0.0.1:3000').split(','),
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
  },
};

export default config;
