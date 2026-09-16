import 'dotenv/config';
import app from './src/server.js';
import { runMigration } from './src/migrate.js';

const port = process.env.PORT || 3001;

async function bootstrap() {
  try {
    await runMigration();
    app.listen(port, () => {
      console.log(`torneos-api listening on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Error fatal al ejecutar migraciones en el inicio del servidor:', err);
    process.exit(1);
  }
}

bootstrap();
