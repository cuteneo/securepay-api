const request = require('supertest');
const app = require('../../src/app');

describe('API Validation and Security Middleware Integration Tests', () => {
  describe('Input Validation on /api/v1/auth/register', () => {
    it('should return 422 Unprocessable Entity when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({});

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          username: 'validuser',
          password: 'Password123!',
          fullName: 'Valid User',
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      const emailErr = res.body.errors.find((e) => e.field === 'email');
      expect(emailErr).toBeDefined();
    });

    it('should reject weak password not meeting security complexity requirements', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          username: 'validuser',
          password: 'weak', // no uppercase, no number, no special char, length < 8
          fullName: 'Valid User',
        });

      expect(res.statusCode).toBe(422);
      const passwordErr = res.body.errors.find((e) => e.field === 'password');
      expect(passwordErr).toBeDefined();
    });
  });

  describe('Protected Routes Authentication Checks', () => {
    it('should return 401 Unauthorized when accessing /api/v1/wallet without Bearer token', async () => {
      const res = await request(app).get('/api/v1/wallet');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authorization token required');
    });

    it('should return 401 Unauthorized when accessing /api/v1/transfers without Bearer token', async () => {
      const res = await request(app)
        .post('/api/v1/transfers')
        .send({ recipientIdentifier: 'bob', amount: 50 });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 Unauthorized when token is invalid or corrupted', async () => {
      const res = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', 'Bearer invalid.corrupted.token');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid authorization token');
    });
  });
});
