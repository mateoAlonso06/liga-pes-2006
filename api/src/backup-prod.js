import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.join(__dirname, '..', 'backups');

mkdirSync(backupsDir, { recursive: true });

async function run() {
  console.log('Fetching production data from https://liga-pes-2006.onrender.com ...');
  const [equiposRes, personasRes, partidosRes, incidenciasRes] = await Promise.all([
    fetch('https://liga-pes-2006.onrender.com/equipos'),
    fetch('https://liga-pes-2006.onrender.com/personas'),
    fetch('https://liga-pes-2006.onrender.com/partidos'),
    fetch('https://liga-pes-2006.onrender.com/incidencias'),
  ]);

  if (!equiposRes.ok || !personasRes.ok || !partidosRes.ok || !incidenciasRes.ok) {
    throw new Error('Failed to fetch some endpoints from production');
  }

  const [equipos, personas, partidos, incidencias] = await Promise.all([
    equiposRes.json(),
    personasRes.json(),
    partidosRes.json(),
    incidenciasRes.json(),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `production_backup_${timestamp}.json`);

  const payload = {
    timestamp: new Date().toISOString(),
    sourceUrl: 'https://liga-pes-2006.onrender.com',
    stats: {
      equipos: equipos.length,
      personas: personas.length,
      partidos: partidos.length,
      incidencias: incidencias.length,
    },
    data: {
      equipos,
      personas,
      partidos,
      incidencias,
    },
  };

  writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Production backup successfully created at: ${backupPath}`);
  console.log('Summary:', payload.stats);
}

run().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
