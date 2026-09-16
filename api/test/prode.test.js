import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import app from '../src/server.js';
import db from '../src/db.js';
import { calculateProdePoints } from '../src/domain/prode.js';

describe('Prode Domain Logic - Pure Scoring Rules', () => {
  it('returns 3 points for exact score', () => {
    assert.equal(calculateProdePoints(2, 1, 2, 1), 3);
    assert.equal(calculateProdePoints(0, 0, 0, 0), 3);
    assert.equal(calculateProdePoints('3', '2', 3, 2), 3);
  });

  it('returns 1 point for correct outcome (winner or draw) but different score', () => {
    // Both predicted home win
    assert.equal(calculateProdePoints(3, 0, 1, 0), 1);
    assert.equal(calculateProdePoints(2, 1, 4, 3), 1);

    // Both predicted away win
    assert.equal(calculateProdePoints(0, 2, 1, 3), 1);

    // Both predicted draw
    assert.equal(calculateProdePoints(1, 1, 2, 2), 1);
    assert.equal(calculateProdePoints(0, 0, 3, 3), 1);
  });

  it('returns 0 points for wrong outcome', () => {
    // Predicted home win, actual away win
    assert.equal(calculateProdePoints(2, 0, 0, 1), 0);
    // Predicted draw, actual home win
    assert.equal(calculateProdePoints(1, 1, 2, 1), 0);
    // Predicted away win, actual draw
    assert.equal(calculateProdePoints(0, 1, 2, 2), 0);
  });

  it('returns null if actual match is unplayed or scores are null/undefined', () => {
    assert.equal(calculateProdePoints(2, 1, null, null), null);
    assert.equal(calculateProdePoints(2, 1, undefined, 0), null);
  });
});

describe('Prode API & Settlement Integration Tests', () => {
  let server;
  let baseUrl;
  let adminToken;
  let userToken;
  let testTorneoId;
  let testMatchId;
  let user2Token;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Admin login using seeded credentials
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USER || 'admin',
        password: process.env.ADMIN_PASSWORD || 'testpass123',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.accessToken;

    // Create normal users
    const userReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `prode_user_${Date.now()}`,
        password: 'password123',
      }),
    });
    const userData = await userReg.json();
    userToken = userData.accessToken;

    const user2Reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `prode_user2_${Date.now()}`,
        password: 'password123',
      }),
    });
    const user2Data = await user2Reg.json();
    user2Token = user2Data.accessToken;

    // Create tournament
    const torRes = await fetch(`${baseUrl}/torneos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: 'Torneo Prode Test',
        formato: 'liga_ida',
      }),
    });
    const torData = await torRes.json();
    testTorneoId = torData.id_torneo;

    // Add 2 participants
    await fetch(`${baseUrl}/torneos/${testTorneoId}/participantes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        participantes: [
          { id_persona: 1, id_equipo: 1 },
          { id_persona: 2, id_equipo: 2 },
        ],
      }),
    });

    // Start tournament with fixture generation
    await fetch(`${baseUrl}/torneos/${testTorneoId}/iniciar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ generar_fixture: true }),
    });

    // Get the pending match created
    const matchesRes = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const prodeData = await matchesRes.json();
    testMatchId = prodeData.partidos[0].id_partido;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('allows authenticated users to submit predictions for pending matches', async () => {
    // User 1 predicts 2-1 (exact)
    const res1 = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        id_partido: testMatchId,
        goles_local: 2,
        goles_visitante: 1,
      }),
    });
    assert.equal(res1.status, 201);

    // User 2 predicts 1-0 (outcome match)
    const res2 = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({
        id_partido: testMatchId,
        goles_local: 1,
        goles_visitante: 0,
      }),
    });
    assert.equal(res2.status, 201);
  });

  it('rejects invalid predictions (negative numbers, invalid types)', async () => {
    const res = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        id_partido: testMatchId,
        goles_local: -1,
        goles_visitante: 2,
      }),
    });
    assert.equal(res.status, 400);
  });

  it('returns matches and user prediction on GET /torneos/:id/prode', async () => {
    const res = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.partidos.length > 0);

    const m = data.partidos.find((p) => p.id_partido === testMatchId);
    assert.ok(m);
    assert.equal(m.mi_pronostico.goles_local, 2);
    assert.equal(m.mi_pronostico.goles_visitante, 1);
    assert.equal(m.mi_pronostico.puntos_obtenidos, null); // not settled yet
  });

  it('settles predictions and awards points when match result is recorded', async () => {
    // Record match result: 2 - 1 (Home wins)
    const updateRes = await fetch(`${baseUrl}/partidos/${testMatchId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        id_local: 1,
        id_visitante: 2,
        goles_local: 2,
        goles_visitante: 1,
        estado: 'jugado',
        id_torneo: testTorneoId,
        numero_fecha: 1,
      }),
    });
    assert.equal(updateRes.status, 200);

    // Verify User 1 got 3 points (exact)
    const prodeUser1Res = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const prodeData1 = await prodeUser1Res.json();
    const match1 = prodeData1.partidos.find((p) => p.id_partido === testMatchId);
    assert.equal(match1.mi_pronostico.puntos_obtenidos, 3);

    // Verify User 2 got 1 point (outcome)
    const prodeUser2Res = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const prodeData2 = await prodeUser2Res.json();
    const match2 = prodeData2.partidos.find((p) => p.id_partido === testMatchId);
    assert.equal(match2.mi_pronostico.puntos_obtenidos, 1);
  });

  it('rejects predictions on matches that have already been played', async () => {
    const res = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        id_partido: testMatchId,
        goles_local: 0,
        goles_visitante: 0,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /ya fue disputado/i);
  });

  it('calculates leaderboard accurately on GET /torneos/:id/prode/posiciones', async () => {
    const res = await fetch(`${baseUrl}/torneos/${testTorneoId}/prode/posiciones`);
    assert.equal(res.status, 200);
    const leaderboard = await res.json();

    assert.ok(leaderboard.length >= 2);
    // User 1 should be first with 3 points
    assert.equal(leaderboard[0].puntos_totales, 3);
    assert.equal(leaderboard[0].aciertos_exactos, 1);
    // User 2 should be second with 1 point
    assert.equal(leaderboard[1].puntos_totales, 1);
    assert.equal(leaderboard[1].aciertos_resultado, 1);
  });

  it('returns global leaderboard on GET /prode/posiciones', async () => {
    const res = await fetch(`${baseUrl}/prode/posiciones`);
    assert.equal(res.status, 200);
    const globalBoard = await res.json();
    assert.ok(Array.isArray(globalBoard));
    assert.ok(globalBoard.length >= 2);
  });
});
