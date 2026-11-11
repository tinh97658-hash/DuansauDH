import express from 'express';
import request from 'supertest';
import { requestSecurity } from '../../src/common/request-security.js';

describe('Request protection before database work', () => {
  const origin = 'https://training.example.invalid';
  const fixture = (limit = 1500) => {
    const app = express();
    const databaseWork = jest.fn();
    app.use(...requestSecurity(origin, limit));
    app.use(express.urlencoded({ extended: true }));
    app.use((_req, res) => { databaseWork(); res.json({ ok: true }); });
    return { app, databaseWork };
  };

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s from a sibling origin before database work', async method => {
    const { app, databaseWork } = fixture();
    await (request(app) as any)[method.toLowerCase()]('/accounts')
      .set('Origin', 'https://untrusted.example.invalid').type('form').send({ name: 'forged' }).expect(403);
    expect(databaseWork).not.toHaveBeenCalled();
  });
  it.each([undefined, 'null', 'https://training.example.invalid.evil.invalid', `${origin}/`])('rejects a missing/invalid origin: %s', async supplied => {
    const { app, databaseWork } = fixture();
    const call = request(app).post('/accounts');
    if (supplied) call.set('Origin', supplied);
    await call.expect(403);
    expect(databaseWork).not.toHaveBeenCalled();
  });
  it('allows trusted writes and read-only health checks without Origin', async () => {
    const { app, databaseWork } = fixture();
    await request(app).post('/accounts').set('Origin', origin).send({ name: 'valid' }).expect(200);
    await request(app).get('/health').expect(200);
    await request(app).options('/accounts').expect(200);
    expect(databaseWork).toHaveBeenCalledTimes(3);
  });
  it('rejects excessive requests without reaching the database middleware', async () => {
    const { app, databaseWork } = fixture(2);
    await request(app).get('/health').expect(200);
    await request(app).get('/health').expect(200);
    await request(app).get('/health').expect(429);
    expect(databaseWork).toHaveBeenCalledTimes(2);
  });
  it('keeps the recovery limiter effective for mixed-case routes and trailing slashes', async () => {
    const { app, databaseWork } = fixture();
    for (let i = 0; i < 100; i++) await request(app).post('/USER/forgotPassword/').set('Origin', origin).expect(200);
    await request(app).post('/user/forgotPassword').set('Origin', origin).expect(429);
    expect(databaseWork).toHaveBeenCalledTimes(100);
  });
});
