// tests/integration/api/auth.test.ts
import request from 'supertest';
import { app } from '../../../server';
import { databaseService } from '../../../src/services/database';

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database
    await databaseService.connect();
  });

  afterAll(async () => {
    await databaseService.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await databaseService.query('DELETE FROM user_sessions');
    await databaseService.query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
        organization: 'Test Org'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Benutzer erfolgreich registriert');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.accessToken).toBeValidJWT();
      expect(response.body.refreshToken).toBeValidJWT();
    });

    it('should reject weak passwords', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'weak',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Ungültige Eingabedaten');
      expect(response.body.details).toBeDefined();
    });

    it('should reject duplicate emails', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      // First registration
      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Benutzer mit dieser E-Mail existiert bereits');
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Ungültige Eingabedaten');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create test user
      const userData = {
        email: 'login@example.com',
        password: 'TestPassword123!',
        name: 'Login Test User'
      };

      await request(app)
        .post('/auth/register')
        .send(userData);
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Erfolgreich angemeldet');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Ungültige Anmeldedaten');
    });

    it('should reject non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Ungültige Anmeldedaten');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create test user and get refresh token
      const userData = {
        email: 'refresh@example.com',
        password: 'TestPassword123!',
        name: 'Refresh Test User'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      refreshToken = registerResponse.body.refreshToken;
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).toBeValidJWT();
      expect(response.body.refreshToken).toBeValidJWT();
      expect(response.body.refreshToken).not.toBe(refreshToken); // Should be new token
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Ungültiger Refresh Token');
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create test user and get access token
      const userData = {
        email: 'logout@example.com',
        password: 'TestPassword123!',
        name: 'Logout Test User'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      accessToken = registerResponse.body.accessToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Erfolgreich abgemeldet');
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Invalid or expired token');
    });
  });

  describe('GET /auth/profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create test user and get access token
      const userData = {
        email: 'profile@example.com',
        password: 'TestPassword123!',
        name: 'Profile Test User',
        organization: 'Test Organization'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      accessToken = registerResponse.body.accessToken;
    });

    it('should return user profile', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('profile@example.com');
      expect(response.body.user.name).toBe('Profile Test User');
      expect(response.body.user.organization).toBe('Test Organization');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce auth rate limits', async () => {
      const loginData = {
        email: 'ratelimit@example.com',
        password: 'WrongPassword123!'
      };

      // Make multiple failed login attempts
      const promises = Array.from({ length: 6 }, () =>
        request(app)
          .post('/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
