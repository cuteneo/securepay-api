const request = require('supertest');
const app = require('../../src/app');

describe('Health Check Integration Test', () => {
  it('GET /api/v1/health should return 200 OK with service status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'SecurePay API');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET / should return root landing info', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', 'SecurePay API');
    expect(res.body).toHaveProperty('documentation', '/api-docs');
  });

  it('GET /api/v1/unknown-endpoint should return 404 Not Found', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
