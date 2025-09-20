// tests/setup.ts
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Mock external services for unit tests
  if (process.env.TEST_TYPE === 'unit') {
    // Mock Redis
    jest.mock('../src/services/cache', () => ({
      cacheService: {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
        ttl: jest.fn().mockResolvedValue(-1),
        flush: jest.fn().mockResolvedValue(undefined),
      }
    }));

    // Mock Database
    jest.mock('../src/services/database', () => ({
      databaseService: {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        transaction: jest.fn().mockImplementation(async (callback) => callback({})),
        createUser: jest.fn().mockResolvedValue({ id: 'test-user-id' }),
        getUserByEmail: jest.fn().mockResolvedValue(null),
        getUserById: jest.fn().mockResolvedValue(null),
        trackApiUsage: jest.fn().mockResolvedValue(undefined),
        logAuditEvent: jest.fn().mockResolvedValue(undefined),
      }
    }));

    // Mock Queue
    jest.mock('../src/services/queue', () => ({
      queueService: {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        addAIJob: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        getJobStatus: jest.fn().mockResolvedValue({ state: 'completed' }),
        getQueueStats: jest.fn().mockResolvedValue({ waiting: 0, active: 0 }),
      }
    }));

    // Mock AI Service
    jest.mock('../src/services/ai', () => ({
      aiService: {
        processText: jest.fn().mockResolvedValue({
          content: 'Mock AI response',
          model: 'gpt-4o-mini',
          usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
          cached: false
        })
      }
    }));
  }
});

afterAll(async () => {
  // Cleanup after all tests
  jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  // Generate test user data
  createTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    organization: 'Test Org',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    isActive: true,
    ...overrides
  }),

  // Generate test layout data
  createTestLayout: (overrides = {}) => ({
    id: 'test-layout-id',
    userId: 'test-user-id',
    name: 'Test Layout',
    description: 'Test Description',
    template: 'Test Template',
    isPublic: false,
    createdAt: new Date(),
    ...overrides
  }),

  // Generate test AI job data
  createTestAIJob: (overrides = {}) => ({
    userId: 'test-user-id',
    text: 'Test text for AI processing',
    options: {
      mode: '1' as const,
      stil: 'neutral' as const,
      ansprache: 'neutral' as const,
      includeRecommendations: false
    },
    priority: 'normal' as const,
    requestId: 'test-request-id',
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock JWT token
  createMockJWT: (payload = {}) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify({
      userId: 'test-user-id',
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload
    })).toString('base64');
    const signature = 'mock-signature';
    return `${header}.${body}.${signature}`;
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },

  toBeValidJWT(received: string) {
    const parts = received.split('.');
    const pass = parts.length === 3 && parts.every(part => part.length > 0);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid JWT`,
      pass,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass,
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidJWT(): R;
      toBeValidEmail(): R;
    }
  }

  var testUtils: {
    createTestUser: (overrides?: any) => any;
    createTestLayout: (overrides?: any) => any;
    createTestAIJob: (overrides?: any) => any;
    waitFor: (ms: number) => Promise<void>;
    createMockJWT: (payload?: any) => string;
  };
}
