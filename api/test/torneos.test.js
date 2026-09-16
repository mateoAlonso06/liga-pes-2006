import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import app from '../src/server.js';
import db from '../src/db.js';

describe('Torneos API Integration Tests', () => {
  let server;
  let baseUrl;
  let adminToken = '';
  let organizerToken = '';
  let organizerId = 0;
  let createdTorneoId = 0;
  let persona1Id = 0;
  let persona2Id = 0;
  let equipo1Id = 0;
  let equipo2Id = 0;

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Admin login
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

    // Register organizer user
    const orgUser = `org_${Date.now()}`;
    const orgRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: orgUser, password: 'password123' }),
    });
    const orgData = await orgRes.json();
    organizerToken = orgData.accessToken;
    organizerId = orgData.user.id;

    // Create test teams and personas
    const eq1Res = await fetch(`${baseUrl}/equipos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ nombre: `Test Team A ${Date.now()}` }),
    });
    const eq1 = await eq1Res.json();
    equipo1Id = eq1.id_equipo;

    const eq2Res = await fetch(`${baseUrl}/equipos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ nombre: `Test Team B ${Date.now()}` }),
    });
    const eq2 = await eq2Res.json();
    equipo2Id = eq2.id_equipo;

    const per1Res = await fetch(`${baseUrl}/personas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ nombre: 'Player Alpha', id_equipo: equipo1Id }),
    });
    const per1 = await per1Res.json();
    persona1Id = per1.id_persona;

    const per2Res = await fetch(`${baseUrl}/personas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ nombre: 'Player Beta', id_equipo: equipo2Id }),
    });
    const per2 = await per2Res.json();
    persona2Id = per2.id_persona;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /torneos lists existing tournaments', async () => {
    const res = await fetch(`${baseUrl}/torneos`);
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 1, 'Debe existir al menos el torneo migrado');
  });

  it('POST /torneos creates a tournament in borrador', async () => {
    const res = await fetch(`${baseUrl}/torneos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        nombre: 'Copa de Campeones PES 6',
        descripcion: 'Torneo eliminatorio con parche retro',
        juego: 'PES 6 Parche Retro',
        formato: 'eliminacion_directa',
      }),
    });

    assert.equal(res.status, 201);
    const torneo = await res.json();
    assert.ok(torneo.id_torneo);
    assert.equal(torneo.nombre, 'Copa de Campeones PES 6');
    assert.equal(torneo.estado, 'borrador');
    assert.equal(torneo.formato, 'eliminacion_directa');
    assert.equal(torneo.id_organizador, organizerId);

    createdTorneoId = torneo.id_torneo;
  });

  it('PUT /torneos/:id allows modifying metadata while in borrador', async () => {
    const res = await fetch(`${baseUrl}/torneos/${createdTorneoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        nombre: 'Copa de Campeones PES 6 - Actualizado',
        formato: 'liga_ida_vuelta',
      }),
    });

    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.nombre, 'Copa de Campeones PES 6 - Actualizado');
    assert.equal(updated.formato, 'liga_ida_vuelta');
  });

  it('POST /torneos/:id/iniciar fails if fewer than 2 participants', async () => {
    const res = await fetch(`${baseUrl}/torneos/${createdTorneoId}/iniciar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${organizerToken}`,
      },
    });

    assert.equal(res.status, 400);
    const err = await res.json();
    assert.match(err.error, /al menos 2 participantes/i);
  });

  it('POST /torneos/:id/participantes adds participants to tournament', async () => {
    const res = await fetch(`${baseUrl}/torneos/${createdTorneoId}/participantes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        participantes: [
          { id_persona: persona1Id, id_equipo: equipo1Id },
          { id_persona: persona2Id, id_equipo: equipo2Id },
        ],
      }),
    });

    assert.equal(res.status, 201);

    // Verify in GET /torneos/:id
    const detailRes = await fetch(`${baseUrl}/torneos/${createdTorneoId}`);
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    assert.equal(detail.participantes.length, 2);
  });

  it('POST /torneos/:id/iniciar transitions tournament to en_curso', async () => {
    const res = await fetch(`${baseUrl}/torneos/${createdTorneoId}/iniciar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${organizerToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.estado, 'en_curso');
  });

  it('PUT /torneos/:id rejects modifications once en_curso', async () => {
    const res = await fetch(`${baseUrl}/torneos/${createdTorneoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        nombre: 'Intento de cambio prohibido',
      }),
    });

    assert.equal(res.status, 400);
    const err = await res.json();
    assert.match(err.error, /no está en borrador/i);
  });

  it('GET /partidos filters by id_torneo', async () => {
    // Create a match in the new tournament
    const createMatchRes = await fetch(`${baseUrl}/partidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        id_local: persona1Id,
        id_visitante: persona2Id,
        goles_local: 3,
        goles_visitante: 1,
        numero_fecha: 1,
        id_torneo: createdTorneoId,
      }),
    });
    assert.equal(createMatchRes.status, 201);

    // Fetch matches for this tournament
    const listRes = await fetch(`${baseUrl}/partidos?id_torneo=${createdTorneoId}`);
    assert.equal(listRes.status, 200);
    const matches = await listRes.json();
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id_torneo, createdTorneoId);
    assert.equal(matches[0].goles_local, 3);
  });

  it('POST /torneos/:id/finalizar crowns a champion and sets estado to finalizado', async () => {
    const res = await fetch(`${baseUrl}/torneos/${createdTorneoId}/finalizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        campeon_id: persona1Id,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.estado, 'finalizado');
    assert.equal(data.campeon_id, persona1Id);
  });

  it('Organizer permissions matrix: allows organizer and blocks unauthorized users', async () => {
    // 1. Create a second tournament owned by organizer
    const newTorneoRes = await fetch(`${baseUrl}/torneos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        nombre: `Org Permissions Cup ${Date.now()}`,
        formato: 'liga_ida',
      }),
    });
    assert.equal(newTorneoRes.status, 201);
    const orgTorneo = await newTorneoRes.json();
    const orgTorneoId = orgTorneo.id_torneo;

    // Register a 3rd stranger user
    const strangerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `stranger_${Date.now()}`, password: 'password123' }),
    });
    const strangerData = await strangerRes.json();
    const strangerToken = strangerData.accessToken;

    // Stranger tries to create match in orgTorneo -> 403
    const strangerMatchRes = await fetch(`${baseUrl}/partidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${strangerToken}`,
      },
      body: JSON.stringify({
        id_local: persona1Id,
        id_visitante: persona2Id,
        id_torneo: orgTorneoId,
      }),
    });
    assert.equal(strangerMatchRes.status, 403);

    // Organizer creates match in orgTorneo -> 201
    const orgMatchRes = await fetch(`${baseUrl}/partidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        id_local: persona1Id,
        id_visitante: persona2Id,
        id_torneo: orgTorneoId,
        estado: 'pendiente',
        numero_fecha: 1,
      }),
    });
    assert.equal(orgMatchRes.status, 201);
    const createdMatch = await orgMatchRes.json();

    // Stranger tries to update match -> 403
    const strangerUpdateRes = await fetch(`${baseUrl}/partidos/${createdMatch.id_partido}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${strangerToken}`,
      },
      body: JSON.stringify({
        id_local: persona1Id,
        id_visitante: persona2Id,
        goles_local: 2,
        goles_visitante: 0,
        estado: 'jugado',
      }),
    });
    assert.equal(strangerUpdateRes.status, 403);

    // Create a proposal for this tournament
    const propRes = await fetch(`${baseUrl}/propuestas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_local: persona1Id,
        id_visitante: persona2Id,
        goles_local: 2,
        goles_visitante: 1,
        numero_fecha: 1,
        nombre_solicitante: 'Mateo',
        id_torneo: orgTorneoId,
      }),
    });
    assert.equal(propRes.status, 201);
    const prop = await propRes.json();

    // Stranger tries to view proposals for this tournament -> 403
    const strangerGetPropRes = await fetch(`${baseUrl}/propuestas?id_torneo=${orgTorneoId}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    });
    assert.equal(strangerGetPropRes.status, 403);

    // Stranger tries to approve proposal -> 403
    const strangerApproveRes = await fetch(`${baseUrl}/propuestas/${prop.id_propuesta}/aprobar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${strangerToken}` },
    });
    assert.equal(strangerApproveRes.status, 403);

    // Organizer views proposals -> 200
    const orgGetPropRes = await fetch(`${baseUrl}/propuestas?id_torneo=${orgTorneoId}`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(orgGetPropRes.status, 200);
    const orgProps = await orgGetPropRes.json();
    assert.equal(orgProps.length, 1);
    assert.equal(orgProps[0].id_propuesta, prop.id_propuesta);

    // Organizer approves proposal -> 201
    const orgApproveRes = await fetch(`${baseUrl}/propuestas/${prop.id_propuesta}/aprobar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(orgApproveRes.status, 201);
  });

  it('Player onboarding: join via invitation code and join request lifecycle', async () => {
    // 1. Create a tournament in draft
    const torneoRes = await fetch(`${baseUrl}/torneos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        nombre: `Join Flow Cup ${Date.now()}`,
        formato: 'liga_ida',
      }),
    });
    assert.equal(torneoRes.status, 201);
    const torneoData = await torneoRes.json();
    assert.ok(torneoData.codigo_invitacion, 'Tournament must have an invitation code');
    const inviteCode = torneoData.codigo_invitacion;
    const torneoId = torneoData.id_torneo;

    // 2. Register Player 1 and Player 2
    const p1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `p1_${Date.now()}`, password: 'password123' }),
    });
    const p1Data = await p1Res.json();
    const p1Token = p1Data.accessToken;

    const p2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `p2_${Date.now()}`, password: 'password123' }),
    });
    const p2Data = await p2Res.json();
    const p2Token = p2Data.accessToken;

    // Player 1 joins directly via invitation code
    const joinCodeRes = await fetch(`${baseUrl}/torneos/unirse-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p1Token}`,
      },
      body: JSON.stringify({ codigo: inviteCode }),
    });
    assert.equal(joinCodeRes.status, 201);
    const joinCodeData = await joinCodeRes.json();
    assert.match(joinCodeData.message, /unido exitosamente/i);
    assert.equal(joinCodeData.id_torneo, torneoId);

    // Player 1 tries to join again -> 409
    const joinAgainRes = await fetch(`${baseUrl}/torneos/unirse-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p1Token}`,
      },
      body: JSON.stringify({ codigo: inviteCode }),
    });
    assert.equal(joinAgainRes.status, 409);

    // Player 2 submits a join request (solicitar-unirse)
    const requestRes = await fetch(`${baseUrl}/torneos/${torneoId}/solicitar-unirse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p2Token}`,
      },
      body: JSON.stringify({ mensaje: 'Quiero jugar con un buen equipo!' }),
    });
    assert.equal(requestRes.status, 201);
    const requestData = await requestRes.json();
    assert.equal(requestData.estado, 'pendiente');
    const solicitudId = requestData.id_solicitud;

    // Player 2 checks their request status
    const myReqRes = await fetch(`${baseUrl}/torneos/${torneoId}/mi-solicitud`, {
      headers: { Authorization: `Bearer ${p2Token}` },
    });
    assert.equal(myReqRes.status, 200);
    const myReqData = await myReqRes.json();
    assert.equal(myReqData.es_participante, false);
    assert.equal(myReqData.solicitud?.estado, 'pendiente');

    // Organizer lists requests
    const listReqsRes = await fetch(`${baseUrl}/torneos/${torneoId}/solicitudes`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(listReqsRes.status, 200);
    const reqsList = await listReqsRes.json();
    assert.equal(reqsList.length, 1);
    assert.equal(reqsList[0].id_solicitud, solicitudId);

    // Organizer approves request
    const approveReqRes = await fetch(`${baseUrl}/torneos/${torneoId}/solicitudes/${solicitudId}/aprobar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(approveReqRes.status, 200);

    // Verify tournament now has both participants
    const detailsRes = await fetch(`${baseUrl}/torneos/${torneoId}`);
    assert.equal(detailsRes.status, 200);
    const details = await detailsRes.json();
    assert.equal(details.participantes.length, 2);
  });

  it('Participant management: removal and blocklist enforcement', async () => {
    // 1. Create a draft tournament
    const torneoRes = await fetch(`${baseUrl}/torneos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        nombre: `Block Test Cup ${Date.now()}`,
        formato: 'liga_ida',
      }),
    });
    const torneo = await torneoRes.json();
    const torneoId = torneo.id_torneo;
    const inviteCode = torneo.codigo_invitacion;

    // 2. Register toxic player
    const toxicUser = `toxic_${Date.now()}`;
    const toxicRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: toxicUser, password: 'password123' }),
    });
    const toxicData = await toxicRes.json();
    const toxicToken = toxicData.accessToken;
    const toxicUserId = toxicData.user.id;

    // Toxic player joins via code
    const joinRes = await fetch(`${baseUrl}/torneos/unirse-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toxicToken}`,
      },
      body: JSON.stringify({ codigo: inviteCode }),
    });
    assert.equal(joinRes.status, 201);
    const joinData = await joinRes.json();
    const personaId = joinData.id_persona;

    // Organizer removes participant
    const removeRes = await fetch(`${baseUrl}/torneos/${torneoId}/participantes/${personaId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(removeRes.status, 204);

    // Verify participant was removed
    const detailsAfterRemove = await (await fetch(`${baseUrl}/torneos/${torneoId}`)).json();
    assert.equal(detailsAfterRemove.participantes.length, 0);

    // Organizer blocks toxic user
    const blockRes = await fetch(`${baseUrl}/torneos/${torneoId}/bloquear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        id_usuario: toxicUserId,
        motivo: 'Comportamiento antideportivo',
      }),
    });
    assert.equal(blockRes.status, 200);

    // Toxic user tries to join again via code -> 403 Forbidden
    const blockedJoinRes = await fetch(`${baseUrl}/torneos/unirse-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toxicToken}`,
      },
      body: JSON.stringify({ codigo: inviteCode }),
    });
    assert.equal(blockedJoinRes.status, 403);
    const blockedErr = await blockedJoinRes.json();
    assert.match(blockedErr.error, /bloqueado/i);

    // Toxic user tries to submit join request -> 403 Forbidden
    const blockedReqRes = await fetch(`${baseUrl}/torneos/${torneoId}/solicitar-unirse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toxicToken}`,
      },
      body: JSON.stringify({ mensaje: 'Por favor dejame entrar' }),
    });
    assert.equal(blockedReqRes.status, 403);

    // Organizer lists blocked users
    const listBlockedRes = await fetch(`${baseUrl}/torneos/${torneoId}/bloqueados`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(listBlockedRes.status, 200);
    const blockedList = await listBlockedRes.json();
    assert.equal(blockedList.length, 1);
    assert.equal(blockedList[0].id_usuario, toxicUserId);

    // Organizer unblocks user
    const unblockRes = await fetch(`${baseUrl}/torneos/${torneoId}/bloquear/${toxicUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    assert.equal(unblockRes.status, 200);

    // Unblocked user can now join again!
    const rejoinRes = await fetch(`${baseUrl}/torneos/unirse-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${toxicToken}`,
      },
      body: JSON.stringify({ codigo: inviteCode }),
    });
    assert.equal(rejoinRes.status, 201);
  });
});
