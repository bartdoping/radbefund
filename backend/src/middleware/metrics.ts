// src/middleware/metrics.ts
import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import config from '../config';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
export const metrics = {
  // HTTP metrics
  httpRequests: new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  }),

  httpDuration: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [register],
  }),

  // AI metrics
  aiRequests: new client.Counter({
    name: 'ai_requests_total',
    help: 'Total AI requests',
    labelNames: ['model', 'status'],
    registers: [register],
  }),

  aiProcessingTime: new client.Histogram({
    name: 'ai_processing_duration_seconds',
    help: 'AI processing duration in seconds',
    labelNames: ['model'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30],
    registers: [register],
  }),

  aiTokensUsed: new client.Counter({
    name: 'ai_tokens_total',
    help: 'Total AI tokens used',
    labelNames: ['model', 'type'],
    registers: [register],
  }),

  // Cache metrics
  cacheHits: new client.Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['cache_type'],
    registers: [register],
  }),

  cacheMisses: new client.Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['cache_type'],
    registers: [register],
  }),

  // User metrics
  activeUsers: new client.Gauge({
    name: 'active_users_total',
    help: 'Number of active users',
    registers: [register],
  }),

  userRegistrations: new client.Counter({
    name: 'user_registrations_total',
    help: 'Total user registrations',
    registers: [register],
  }),

  userLogins: new client.Counter({
    name: 'user_logins_total',
    help: 'Total user logins',
    registers: [register],
  }),

  // Error metrics
  errors: new client.Counter({
    name: 'errors_total',
    help: 'Total errors',
    labelNames: ['type', 'severity'],
    registers: [register],
  }),

  // Database metrics
  dbConnections: new client.Gauge({
    name: 'database_connections_active',
    help: 'Active database connections',
    registers: [register],
  }),

  dbQueryDuration: new client.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
  }),
};

// HTTP request metrics middleware
export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    metrics.httpRequests
      .labels(req.method, route, res.statusCode.toString())
      .inc();
    
    metrics.httpDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
};

// AI metrics helper
export const recordAIMetrics = {
  request: (model: string, status: 'success' | 'error') => {
    metrics.aiRequests.labels(model, status).inc();
  },
  
  processingTime: (model: string, duration: number) => {
    metrics.aiProcessingTime.labels(model).observe(duration / 1000);
  },
  
  tokensUsed: (model: string, promptTokens: number, completionTokens: number) => {
    metrics.aiTokensUsed.labels(model, 'prompt').inc(promptTokens);
    metrics.aiTokensUsed.labels(model, 'completion').inc(completionTokens);
  },
};

// Cache metrics helper
export const recordCacheMetrics = {
  hit: (cacheType: string) => {
    metrics.cacheHits.labels(cacheType).inc();
  },
  
  miss: (cacheType: string) => {
    metrics.cacheMisses.labels(cacheType).inc();
  },
};

// Error metrics helper
export const recordError = (type: string, severity: 'low' | 'medium' | 'high' | 'critical') => {
  metrics.errors.labels(type, severity).inc();
};

// Metrics endpoint
export const metricsHandler = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error generating metrics');
  }
};

// Health check endpoint
export const healthCheckHandler = async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.nodeEnv,
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export { register };
