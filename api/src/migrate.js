import 'dotenv/config';
import { createClient } from '@libsql/client';
import defaultDb from './db.js';

export async function runMigration(customClient = null) {
  const db = customClient || defaultDb;

  console.log('--- Iniciando Migración Multi-Torneo ---');

  // 1. Crear tablas base de usuarios si no existen
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuario (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'user' CHECK(rol IN ('admin', 'user')),
      avatar_url TEXT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sesion_refresh (
      id_sesion INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expira_en TEXT NOT NULL,
      revocado INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrar admins legacy a la tabla usuario
  const masterTables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((r) => r.name);
  if (masterTables.includes('admin')) {
    const legacyAdmins = await db.execute('SELECT username, password_hash FROM admin');
    for (const adm of legacyAdmins.rows) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO usuario (username, password_hash, rol) VALUES (?, ?, 'admin')",
        args: [adm.username, adm.password_hash],
      });
    }
  }

  // 1.b Crear tablas multi-torneo nuevas si no existen
  await db.execute(`
    CREATE TABLE IF NOT EXISTS juego (
      id_juego INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    INSERT OR IGNORE INTO juego (id_juego, nombre, descripcion)
    VALUES (1, 'PES 6 EuroAmericano Clásico 2', 'Parche histórico con selecciones y clubes clásicos de Europa y América.');
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS torneo (
      id_torneo INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      id_juego INTEGER NULL REFERENCES juego(id_juego),
      juego TEXT NOT NULL DEFAULT 'PES 6 EuroAmericano Clásico 2',
      formato TEXT NOT NULL CHECK(formato IN ('liga_ida', 'liga_ida_vuelta', 'eliminacion_directa', 'grupos_eliminacion')),
      estado TEXT NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador', 'en_curso', 'finalizado')),
      id_organizador INTEGER NOT NULL REFERENCES usuario(id_usuario),
      campeon_id INTEGER NULL REFERENCES persona(id_persona),
      configuracion_json TEXT NOT NULL DEFAULT '{}',
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS torneo_participante (
      id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
      id_persona INTEGER NOT NULL REFERENCES persona(id_persona),
      id_equipo INTEGER NOT NULL REFERENCES equipo(id_equipo),
      grupo TEXT NULL,
      sembrado INTEGER NULL,
      PRIMARY KEY (id_torneo, id_persona)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS prode_pronostico (
      id_pronostico INTEGER PRIMARY KEY AUTOINCREMENT,
      id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
      id_partido INTEGER NOT NULL REFERENCES partido(id_partido) ON DELETE CASCADE,
      id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      goles_local INTEGER NOT NULL,
      goles_visitante INTEGER NOT NULL,
      puntos_obtenidos INTEGER NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(id_partido, id_usuario)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS torneo_solicitud (
      id_solicitud INTEGER PRIMARY KEY AUTOINCREMENT,
      id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
      id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      id_equipo INTEGER NULL REFERENCES equipo(id_equipo),
      mensaje TEXT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobada', 'rechazada')),
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(id_torneo, id_usuario)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS torneo_bloqueado (
      id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
      id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      motivo TEXT NULL,
      bloqueado_en TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id_torneo, id_usuario)
    );
  `);

  console.log('✓ Tablas juego, torneo, torneo_participante, prode_pronostico, torneo_solicitud y torneo_bloqueado verificadas/creadas.');

  // 1.b Comprobar columnas id_juego en equipo y torneo, y id_usuario en persona
  const equipoCols = (await db.execute('PRAGMA table_info(equipo)')).rows.map((r) => r.name);
  if (!equipoCols.includes('id_juego')) {
    await db.execute('ALTER TABLE equipo ADD COLUMN id_juego INTEGER REFERENCES juego(id_juego);');
    await db.execute('UPDATE equipo SET id_juego = 1 WHERE id_juego IS NULL;');
    console.log('✓ Columna id_juego agregada a equipo y vinculada al juego 1.');
  }

  const torneoCols = (await db.execute('PRAGMA table_info(torneo)')).rows.map((r) => r.name);
  if (!torneoCols.includes('id_juego')) {
    await db.execute('ALTER TABLE torneo ADD COLUMN id_juego INTEGER REFERENCES juego(id_juego);');
    await db.execute("UPDATE torneo SET id_juego = 1, juego = 'PES 6 EuroAmericano Clásico 2' WHERE id_juego IS NULL;");
    console.log('✓ Columna id_juego agregada a torneo y vinculada al juego 1.');
  }

  if (!torneoCols.includes('codigo_invitacion')) {
    await db.execute('ALTER TABLE torneo ADD COLUMN codigo_invitacion TEXT;');
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_torneo_codigo_invitacion ON torneo(codigo_invitacion);');
    const torneosSinCodigo = await db.execute('SELECT id_torneo FROM torneo WHERE codigo_invitacion IS NULL');
    for (const t of torneosSinCodigo.rows) {
      const code = `TRN-${Math.random().toString(36).substring(2, 6).toUpperCase()}${t.id_torneo}`;
      await db.execute({
        sql: 'UPDATE torneo SET codigo_invitacion = ? WHERE id_torneo = ?',
        args: [code, t.id_torneo],
      });
    }
    console.log('✓ Columna codigo_invitacion agregada a torneo y generada para torneos existentes.');
  }

  const personaCols = (await db.execute('PRAGMA table_info(persona)')).rows.map((r) => r.name);
  if (!personaCols.includes('id_usuario')) {
    await db.execute('ALTER TABLE persona ADD COLUMN id_usuario INTEGER REFERENCES usuario(id_usuario);');
    console.log('✓ Columna id_usuario agregada a persona.');
  }

  const usuarioCols = (await db.execute('PRAGMA table_info(usuario)')).rows.map((r) => r.name);
  if (!usuarioCols.includes('avatar_url')) {
    await db.execute('ALTER TABLE usuario ADD COLUMN avatar_url TEXT NULL;');
    console.log('✓ Columna avatar_url agregada a usuario.');
  }

  // 2. Comprobar y agregar columnas a partido
  const partidoCols = (await db.execute('PRAGMA table_info(partido)')).rows.map((r) => r.name);

  if (!partidoCols.includes('id_torneo')) {
    await db.execute('ALTER TABLE partido ADD COLUMN id_torneo INTEGER REFERENCES torneo(id_torneo);');
    console.log('✓ Columna id_torneo agregada a partido.');
  }

  if (!partidoCols.includes('etapa')) {
    await db.execute("ALTER TABLE partido ADD COLUMN etapa TEXT NOT NULL DEFAULT 'fecha';");
    console.log('✓ Columna etapa agregada a partido.');
  }

  if (!partidoCols.includes('penales_local')) {
    await db.execute('ALTER TABLE partido ADD COLUMN penales_local INTEGER NULL;');
    console.log('✓ Columna penales_local agregada a partido.');
  }

  if (!partidoCols.includes('penales_visitante')) {
    await db.execute('ALTER TABLE partido ADD COLUMN penales_visitante INTEGER NULL;');
    console.log('✓ Columna penales_visitante agregada a partido.');
  }

  if (!partidoCols.includes('siguiente_partido_id')) {
    await db.execute('ALTER TABLE partido ADD COLUMN siguiente_partido_id INTEGER NULL REFERENCES partido(id_partido);');
    console.log('✓ Columna siguiente_partido_id agregada a partido.');
  }

  // 3. Comprobar y agregar columna a propuesta_partido si existe
  const tablas = (await db.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((r) => r.name);
  if (tablas.includes('propuesta_partido')) {
    const propuestaCols = (await db.execute('PRAGMA table_info(propuesta_partido)')).rows.map((r) => r.name);
    if (!propuestaCols.includes('id_torneo')) {
      await db.execute('ALTER TABLE propuesta_partido ADD COLUMN id_torneo INTEGER REFERENCES torneo(id_torneo);');
      console.log('✓ Columna id_torneo agregada a propuesta_partido.');
    }
  }

  // 4. Migrar datos existentes que no tengan id_torneo
  const partidosSinTorneo = await db.execute('SELECT COUNT(*) as count FROM partido WHERE id_torneo IS NULL');
  const countPartidos = Number(partidosSinTorneo.rows[0]?.count ?? 0);

  if (countPartidos > 0) {
    console.log(`Detectados ${countPartidos} partidos sin torneo asignado. Creando Torneo Inicial...`);

    // Obtener organizador
    let adminId = null;
    const adminUser = await db.execute("SELECT id_usuario FROM usuario WHERE rol = 'admin' LIMIT 1");
    if (adminUser.rows.length > 0) {
      adminId = adminUser.rows[0].id_usuario;
    } else {
      const anyUser = await db.execute('SELECT id_usuario FROM usuario LIMIT 1');
      if (anyUser.rows.length > 0) {
        adminId = anyUser.rows[0].id_usuario;
      } else {
        // Crear usuario admin por defecto si la base estuviera vacía de usuarios
        const createdAdmin = await db.execute({
          sql: "INSERT INTO usuario (username, password_hash, rol) VALUES ('admin', 'placeholder', 'admin')",
          args: [],
        });
        adminId = Number(createdAdmin.lastInsertRowid);
      }
    }

    // Crear torneo inicial
    const resultTorneo = await db.execute({
      sql: `INSERT INTO torneo (nombre, descripcion, id_juego, juego, codigo_invitacion, formato, estado, id_organizador)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'Liga PES 2006 - Torneo Oficial',
        'Torneo regular migrado con el historial de la liga activa.',
        1,
        'PES 6 EuroAmericano Clásico 2',
        'TRN-PES6-OFICIAL',
        'liga_ida',
        'en_curso',
        adminId,
      ],
    });
    const idTorneoInicial = Number(resultTorneo.lastInsertRowid);
    console.log(`✓ Creado Torneo Oficial con id_torneo: ${idTorneoInicial}`);

    // Migrar personas a torneo_participante
    const personas = await db.execute('SELECT id_persona, id_equipo FROM persona WHERE id_equipo IS NOT NULL');
    let participantesMigrados = 0;
    for (const p of personas.rows) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO torneo_participante (id_torneo, id_persona, id_equipo)
              VALUES (?, ?, ?)`,
        args: [idTorneoInicial, p.id_persona, p.id_equipo],
      });
      participantesMigrados++;
    }
    console.log(`✓ ${participantesMigrados} participantes vinculados a torneo_participante.`);

    // Actualizar partidos huérfanos
    await db.execute({
      sql: 'UPDATE partido SET id_torneo = ? WHERE id_torneo IS NULL',
      args: [idTorneoInicial],
    });
    console.log(`✓ ${countPartidos} partidos asociados al torneo id: ${idTorneoInicial}.`);

    // Actualizar propuestas huérfanas si las hubiera
    if (tablas.includes('propuesta_partido')) {
      await db.execute({
        sql: 'UPDATE propuesta_partido SET id_torneo = ? WHERE id_torneo IS NULL',
        args: [idTorneoInicial],
      });
      console.log('✓ Propuestas de partido asociadas al torneo.');
    }
  } else {
    console.log('No se encontraron partidos huérfanos sin id_torneo.');
  }

  // Salvaguardas de consistencia para todos los registros
  await db.execute('UPDATE equipo SET id_juego = 1 WHERE id_juego IS NULL;');
  await db.execute("UPDATE torneo SET id_juego = 1, juego = 'PES 6 EuroAmericano Clásico 2' WHERE id_juego IS NULL;");
  await db.execute("UPDATE torneo SET codigo_invitacion = 'TRN-PES6-OFICIAL' WHERE codigo_invitacion IS NULL;");

  console.log('--- Migración Finalizada con Éxito ---');
}

// Ejecución directa por CLI
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  const targetDbArg = process.argv[2];
  let client = null;
  if (targetDbArg) {
    console.log(`Conectando a base de datos destino: ${targetDbArg}`);
    client = createClient({ url: `file:${targetDbArg}` });
  }

  runMigration(client)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error durante la migración:', err);
      process.exit(1);
    });
}
