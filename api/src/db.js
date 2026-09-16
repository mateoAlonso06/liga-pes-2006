import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

if (process.env.DATABASE_URL?.startsWith('file:')) {
  db.execute('PRAGMA journal_mode = WAL;').catch(() => {});
  db.execute('PRAGMA busy_timeout = 5000;').catch(() => {});
}

export default db;

