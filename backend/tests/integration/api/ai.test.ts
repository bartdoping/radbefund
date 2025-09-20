// tests/integration/api/ai.test.ts
import request from 'supertest';
import { app } from '../../../server';
import { databaseService } from '../../../src/services/database';

describe('AI Processing API Integration Tests', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    await databaseService.connect();
  });

  afterAll(async () => {
    await databaseService.disconnect();
  });

  beforeEach(async () => {
    // Create test user
    const userData = {
      email: 'ai-test@example.com',
      password: 'TestPassword123!',
      name: 'AI Test User'
    };

    const registerResponse = await request(app)
      .post('/auth/register')
      .send(userData);

    accessToken = registerResponse.body.accessToken;
    userId = registerResponse.body.user.id;

    // Clean up previous test data
    await databaseService.query('DELETE FROM api_usage WHERE user_id = $1', [userId]);
    await databaseService.query('DELETE FROM ai_jobs WHERE user_id = $1', [userId]);
  });

  describe('POST /structured', () => {
    const testText = `
      Thorax CT
      
      Technik: Spiral-CT in Atemanhaltetechnik
      
      Befund:
      Herz: Normal groß, keine Perikarderguss
      Lunge: Beidseits basal diskrete Atelektasen
      Pleura: Frei
      
      Beurteilung:
      Unauffälliger Thorax-CT ohne pathologische Befunde
    `;

    it('should process text with level 1 (basic correction)', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '1',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: false
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('blocked', false);
      expect(response.body).toHaveProperty('answer');
      expect(response.body.answer).toHaveProperty('befund');
      expect(response.body.answer.befund).toBeTruthy();
    });

    it('should process text with level 3 (restructuring + assessment)', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '3',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: true
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('blocked', false);
      expect(response.body).toHaveProperty('answer');
      expect(response.body.answer).toHaveProperty('befund');
      expect(response.body.answer).toHaveProperty('beurteilung');
      expect(response.body.answer.beurteilung).toBeTruthy();
    });

    it('should process text with level 5 (full features)', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '5',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: true
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('blocked', false);
      expect(response.body).toHaveProperty('answer');
      expect(response.body.answer).toHaveProperty('befund');
      expect(response.body.answer).toHaveProperty('beurteilung');
      expect(response.body.answer).toHaveProperty('empfehlungen');
      expect(response.body.answer).toHaveProperty('zusatzinformationen');
    });

    it('should handle content changes blocking', async () => {
      const problematicText = `
        Befund: Tumor 2.5 cm
        Beurteilung: Malignität wahrscheinlich
      `;

      const requestData = {
        text: problematicText,
        options: {
          mode: '3',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: true
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData);

      // Should either be blocked or successful
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('blocked');
    });

    it('should track API usage', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '1',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: false
        },
        allowContentChanges: false
      };

      await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      // Check if API usage was tracked
      const usageResult = await databaseService.query(
        'SELECT * FROM api_usage WHERE user_id = $1 AND endpoint = $2',
        [userId, '/structured']
      );

      expect(usageResult.rows).toHaveLength(1);
      expect(usageResult.rows[0].status_code).toBe(200);
      expect(usageResult.rows[0].method).toBe('POST');
    });

    it('should require authentication', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '1',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: false
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .send(requestData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should validate request schema', async () => {
      const invalidRequestData = {
        text: '', // Empty text should be invalid
        options: {
          mode: 'invalid', // Invalid mode
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: false
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidRequestData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.details).toBeDefined();
    });

    it('should handle layout templates', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '3',
          stil: 'neutral',
          ansprache: 'neutral',
          layout: 'Thorax\nHerz:\nGefäße:\nLunge:\n\nBeurteilung:',
          includeRecommendations: true
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('blocked', false);
      expect(response.body).toHaveProperty('answer');
    });
  });

  describe('POST /process', () => {
    const testText = 'Einfacher Befundtext mit Tippfehlern.';

    it('should process text with basic options', async () => {
      const requestData = {
        text: testText,
        options: {
          mode: '1',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: false
        },
        allowContentChanges: false
      };

      const response = await request(app)
        .post('/process')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('blocked', false);
      expect(response.body).toHaveProperty('answer');
    });
  });

  describe('POST /impression', () => {
    const testText = `
      Befund: Unauffälliger Thorax-CT
      Beurteilung: Keine pathologischen Befunde
    `;

    it('should generate impression', async () => {
      const requestData = {
        text: testText
      };

      const response = await request(app)
        .post('/impression')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body).toHaveProperty('blocked', false);
      expect(response.body).toHaveProperty('answer');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce AI rate limits', async () => {
      const requestData = {
        text: 'Test text',
        options: {
          mode: '1',
          stil: 'neutral',
          ansprache: 'neutral',
          includeRecommendations: false
        },
        allowContentChanges: false
      };

      // Make multiple requests quickly
      const promises = Array.from({ length: 15 }, () =>
        request(app)
          .post('/structured')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(requestData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/structured')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
    });
  });
});
