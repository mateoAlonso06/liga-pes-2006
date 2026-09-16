import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import app from '../src/server.js';
import db from '../src/db.js';

describe('Auth & RBAC Flow Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  const testUser = `test_player_${Date.now()}`;
  const testPass = 'secret123';
  let userToken = '';
  let refreshCookie = '';

  it('registers a new user with role "user"', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: testPass }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user.username, testUser);
    assert.equal(data.user.role, 'user');
    assert.ok(data.accessToken);

    userToken = data.accessToken;
    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader);
    assert.match(cookieHeader, /refreshToken=/);
    refreshCookie = cookieHeader.split(';')[0];
  });

  it('rejects duplicate username registration with 409', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: testPass }),
    });

    assert.equal(res.status, 409);
  });

  it('refreshes access token via HttpOnly refresh cookie', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: refreshCookie,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken);
    assert.equal(data.user.username, testUser);
    assert.equal(data.user.role, 'user');
  });

  it('prevents regular user from accessing admin-only endpoint (403 Forbidden)', async () => {
    // Try to access POST /equipos as regular user
    const res = await fetch(`${baseUrl}/equipos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ nombre: 'Hack FC' }),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /Admin access required/i);
  });

  it('allows seeded admin user to login and access admin endpoint', async () => {
    // Login as admin
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USER || 'admin',
        password: process.env.ADMIN_PASSWORD || 'testpass123',
      }),
    });

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.user.role, 'admin');
    const adminToken = loginData.accessToken;

    // Check GET /propuestas as admin (requireAdmin)
    const adminRes = await fetch(`${baseUrl}/propuestas`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(adminRes.status, 200);
  });

  it('logs out and revokes session', async () => {
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: refreshCookie,
      },
    });

    assert.equal(logoutRes.status, 200);

    // Refresh after logout must fail with 401
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: refreshCookie,
      },
    });

    assert.equal(refreshRes.status, 401);
  });

  it('GET /auth/me returns authenticated user with avatar_url', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.username, testUser);
    assert.equal(data.user.avatar_url, null);
  });

  it('POST /auth/avatar rejects unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/auth/avatar`, {
      method: 'POST',
    });

    assert.equal(res.status, 401);
  });

  it('POST /auth/avatar rejects request without file', async () => {
    const res = await fetch(`${baseUrl}/auth/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /No se envió ningún archivo/i);
  });

  it('DELETE /auth/avatar removes avatar and sets avatar_url to null', async () => {
    const res = await fetch(`${baseUrl}/auth/avatar`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.avatar_url, null);
  });
});
