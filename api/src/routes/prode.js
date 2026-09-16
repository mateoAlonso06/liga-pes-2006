import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

// GET /torneos/:id/prode - List tournament matches and user's predictions
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const idTorneo = req.params.id;

    // Check if tournament exists
    const torneoRes = await db.execute({
      sql: 'SELECT id_torneo, nombre, estado FROM torneo WHERE id_torneo = ?',
      args: [idTorneo],
    });
    if (torneoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Torneo not found' });
    }

    // Get all matches for this tournament
    const matchesRes = await db.execute({
      sql: `SELECT 
              p.id_partido, p.id_torneo, p.etapa, p.numero_fecha, p.estado,
              p.id_local, p.id_visitante, p.goles_local, p.goles_visitante,
              p.penales_local, p.penales_visitante,
              perLocal.nombre AS local_nombre,
              perVisit.nombre AS visitante_nombre,
              eqLocal.nombre AS local_equipo,
              eqVisit.nombre AS visitante_equipo
            FROM partido p
            LEFT JOIN persona perLocal ON p.id_local = perLocal.id_persona
            LEFT JOIN persona perVisit ON p.id_visitante = perVisit.id_persona
            LEFT JOIN torneo_participante tpLocal ON tpLocal.id_torneo = p.id_torneo AND tpLocal.id_persona = p.id_local
            LEFT JOIN equipo eqLocal ON tpLocal.id_equipo = eqLocal.id_equipo
            LEFT JOIN torneo_participante tpVisit ON tpVisit.id_torneo = p.id_torneo AND tpVisit.id_persona = p.id_visitante
            LEFT JOIN equipo eqVisit ON tpVisit.id_equipo = eqVisit.id_equipo
            WHERE p.id_torneo = ?
            ORDER BY p.numero_fecha ASC, p.id_partido ASC`,
      args: [idTorneo],
    });

    const matches = matchesRes.rows;

    // Get current user predictions if authenticated
    const myPredictionsMap = new Map();
    if (req.user?.id) {
      const myPredsRes = await db.execute({
        sql: `SELECT id_pronostico, id_partido, goles_local, goles_visitante, puntos_obtenidos, creado_en
              FROM prode_pronostico
              WHERE id_torneo = ? AND id_usuario = ?`,
        args: [idTorneo, req.user.id],
      });
      for (const pred of myPredsRes.rows) {
        myPredictionsMap.set(pred.id_partido, pred);
      }
    }

    // Get all predictions for finished matches (for transparency)
    const communityPredsRes = await db.execute({
      sql: `SELECT pr.id_pronostico, pr.id_partido, pr.id_usuario, u.username,
                   pr.goles_local, pr.goles_visitante, pr.puntos_obtenidos
            FROM prode_pronostico pr
            JOIN usuario u ON pr.id_usuario = u.id_usuario
            JOIN partido pa ON pr.id_partido = pa.id_partido
            WHERE pr.id_torneo = ? AND (pa.estado IS NULL OR pa.estado != 'pendiente')
            ORDER BY pr.puntos_obtenidos DESC, pr.id_pronostico ASC`,
      args: [idTorneo],
    });

    const communityPredsByMatch = new Map();
    for (const cp of communityPredsRes.rows) {
      if (!communityPredsByMatch.has(cp.id_partido)) {
        communityPredsByMatch.set(cp.id_partido, []);
      }
      communityPredsByMatch.get(cp.id_partido).push(cp);
    }

    // Assemble payload
    const items = matches.map((m) => {
      const isPlayed = m.estado !== 'pendiente';
      return {
        ...m,
        isPlayed,
        mi_pronostico: myPredictionsMap.get(m.id_partido) || null,
        pronosticos_comunidad: isPlayed ? (communityPredsByMatch.get(m.id_partido) || []) : [],
      };
    });

    res.json({
      torneo: torneoRes.rows[0],
      partidos: items,
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/prode - Submit or update prediction for a match
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const idTorneo = req.params.id;
    const { id_partido, goles_local, goles_visitante } = req.body;

    if (id_partido === undefined || goles_local === undefined || goles_visitante === undefined) {
      return res.status(400).json({ error: 'id_partido, goles_local y goles_visitante son obligatorios' });
    }

    const gl = Number(goles_local);
    const gv = Number(goles_visitante);

    if (!Number.isInteger(gl) || gl < 0 || gl > 99 || !Number.isInteger(gv) || gv < 0 || gv > 99) {
      return res.status(400).json({ error: 'Los goles deben ser números enteros entre 0 y 99' });
    }

    // Validate tournament
    const torneoRes = await db.execute({
      sql: 'SELECT id_torneo, estado FROM torneo WHERE id_torneo = ?',
      args: [idTorneo],
    });
    if (torneoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Torneo not found' });
    }
    if (torneoRes.rows[0].estado !== 'en_curso') {
      return res.status(400).json({
        error: 'Solo se pueden cargar pronósticos en torneos que estén en curso.',
      });
    }

    // Validate match belongs to tournament and is pending
    const matchRes = await db.execute({
      sql: 'SELECT id_partido, estado, id_torneo FROM partido WHERE id_partido = ?',
      args: [id_partido],
    });
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    const match = matchRes.rows[0];

    if (String(match.id_torneo) !== String(idTorneo)) {
      return res.status(400).json({ error: 'El partido no pertenece a este torneo' });
    }

    if (match.estado !== 'pendiente') {
      return res.status(400).json({
        error: 'No se puede pronosticar un partido que ya fue disputado o cerrado.',
      });
    }

    // Upsert prediction
    const insertRes = await db.execute({
      sql: `INSERT INTO prode_pronostico (id_torneo, id_partido, id_usuario, goles_local, goles_visitante)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_partido, id_usuario) DO UPDATE SET
              goles_local = excluded.goles_local,
              goles_visitante = excluded.goles_visitante,
              creado_en = datetime('now')`,
      args: [idTorneo, id_partido, req.user.id, gl, gv],
    });

    res.status(201).json({
      message: 'Pronóstico guardado exitosamente',
      pronostico: {
        id_torneo: Number(idTorneo),
        id_partido: Number(id_partido),
        id_usuario: req.user.id,
        goles_local: gl,
        goles_visitante: gv,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /torneos/:id/prode/posiciones - Tournament leaderboard
router.get('/posiciones', async (req, res, next) => {
  try {
    const idTorneo = req.params.id;

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
            WHERE p.id_torneo = ?
            GROUP BY u.id_usuario, u.username, u.avatar_url
            ORDER BY puntos_totales DESC, aciertos_exactos DESC, aciertos_resultado DESC, u.username ASC`,
      args: [idTorneo],
    });

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
