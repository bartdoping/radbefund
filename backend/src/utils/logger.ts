// src/utils/logger.ts
import winston from 'winston';
import config from '../config';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.monitoring.logLevel,
  format: logFormat,
  defaultMeta: { 
    service: 'radbefund-plus',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    
    // File transports
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.userId || 'anonymous',
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  next();
};

// Audit logging for sensitive operations
export const auditLogger = {
  userAction: (userId: string, action: string, details: any) => {
    logger.info('User Action', {
      type: 'audit',
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  },
  
  securityEvent: (event: string, details: any) => {
    logger.warn('Security Event', {
      type: 'security',
      event,
      details,
      timestamp: new Date().toISOString(),
    });
  },
  
  aiRequest: (userId: string, textLength: number, options: any, duration: number) => {
    logger.info('AI Request', {
      type: 'ai',
      userId,
      textLength,
      options,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;
