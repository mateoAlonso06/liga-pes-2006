import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import equiposRouter from './routes/equipos.js';
import personasRouter from './routes/personas.js';
import partidosRouter from './routes/partidos.js';
import incidenciasRouter from './routes/incidencias.js';
import propuestasRouter from './routes/propuestas.js';
import torneosRouter from './routes/torneos.js';
import juegosRouter from './routes/juegos.js';
import db from './db.js';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true,
  credentials: true,
}));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRouter);
app.use('/equipos', equiposRouter);
app.use('/personas', personasRouter);
app.use('/partidos', partidosRouter);
app.use('/incidencias', incidenciasRouter);
app.use('/propuestas', propuestasRouter);
app.use('/torneos', torneosRouter);
app.use('/juegos', juegosRouter);

app.get('/prode/posiciones', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `SELECT 
              u.id_usuario,
              u.username,
              u.avatar_url,
              COALESCE(SUM(p.puntos_obtenidos), 0) AS puntos_totales,
              COUNT(CASE WHEN p.puntos_obtenidos = 3 THEN 1 END) AS aciertos_exactos,
              COUNT(CASE WHEN p.puntos_obtenidos = 1 THEN 1 END) AS aciertos_resultado,
              COUNT(CASE WHEN p.puntos_obtenidos = 0 THEN 1 END) AS desaciertos,
              COUNT(p.id_pronostico) AS total_pronosticos
            FROM usuario u
            JOIN prode_pronostico p ON u.id_usuario = p.id_usuario
            GROUP BY u.id_usuario, u.username, u.avatar_url
            ORDER BY puntos_totales DESC, aciertos_exactos DESC, aciertos_resultado DESC, u.username ASC`,
    });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
