import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Usage: node src/restore-backup.js <path-to-backup.json> [target-db-path]');
    process.exit(1);
  }

  const targetDbPath = process.argv[3] || path.join(__dirname, '..', 'backups', 'production_mirror.db');
  const raw = readFileSync(backupFile, 'utf-8');
  const backup = JSON.parse(raw);

  const client = createClient({
    url: `file:${targetDbPath}`,
  });

  console.log(`Restoring schema and ${backupFile} into ${targetDbPath} ...`);

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await client.execute(statement);
  }

  // Restore equipos
  for (const eq of backup.data.equipos) {
    await client.execute({
      sql: 'INSERT OR REPLACE INTO equipo (id_equipo, nombre) VALUES (?, ?)',
      args: [eq.id_equipo, eq.nombre],
    });
  }

  // Restore personas
  for (const p of backup.data.personas) {
    await client.execute({
      sql: 'INSERT OR REPLACE INTO persona (id_persona, nombre, id_equipo) VALUES (?, ?, ?)',
      args: [p.id_persona, p.nombre, p.id_equipo],
    });
  }

  // Restore partidos
  for (const m of backup.data.partidos) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO partido 
            (id_partido, goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.id_partido,
        m.goles_local,
        m.goles_visitante,
        m.numero_fecha,
        m.estado,
        m.id_local,
        m.id_visitante,
      ],
    });
  }

  // Restore incidencias
  for (const inc of backup.data.incidencias) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO incidencia 
            (id_incidencia, jugador_virtual, tipo, id_persona, id_partido)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        inc.id_incidencia,
        inc.jugador_virtual,
        inc.tipo,
        inc.id_persona,
        inc.id_partido,
      ],
    });
  }

  // Generate an SQL dump file as well
  const sqlDumpPath = targetDbPath.replace(/\.db$/, '.sql');
  let sqlDump = '-- Production Backup SQL Dump\nBEGIN TRANSACTION;\n';
  for (const eq of backup.data.equipos) {
    sqlDump += `INSERT INTO equipo (id_equipo, nombre) VALUES (${eq.id_equipo}, '${eq.nombre.replace(/'/g, "''")}');\n`;
  }
  for (const p of backup.data.personas) {
    sqlDump += `INSERT INTO persona (id_persona, nombre, id_equipo) VALUES (${p.id_persona}, '${p.nombre.replace(/'/g, "''")}', ${p.id_equipo});\n`;
  }
  for (const m of backup.data.partidos) {
    sqlDump += `INSERT INTO partido (id_partido, goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante) VALUES (${m.id_partido}, ${m.goles_local}, ${m.goles_visitante}, ${m.numero_fecha}, ${m.estado ? `'${m.estado}'` : 'NULL'}, ${m.id_local}, ${m.id_visitante});\n`;
  }
  for (const inc of backup.data.incidencias) {
    sqlDump += `INSERT INTO incidencia (id_incidencia, jugador_virtual, tipo, id_persona, id_partido) VALUES (${inc.id_incidencia}, '${inc.jugador_virtual.replace(/'/g, "''")}', '${inc.tipo}', ${inc.id_persona}, ${inc.id_partido});\n`;
  }
  sqlDump += 'COMMIT;\n';
  writeFileSync(sqlDumpPath, sqlDump, 'utf-8');

  console.log(`Restoration complete:`);
  console.log(` - SQLite DB: ${targetDbPath}`);
  console.log(` - SQL script: ${sqlDumpPath}`);
}

run().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
