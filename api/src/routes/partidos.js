import { Router } from 'express';
import db from '../db.js';
import { requireAuth, canManageTournament } from '../middleware/auth.js';
import { settleMatchProde } from '../domain/prode.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { numero_fecha, id_torneo } = req.query;
    let sql = 'SELECT * FROM partido';
    const conditions = [];
    const args = [];

    if (id_torneo) {
      conditions.push('id_torneo = ?');
      args.push(id_torneo);
    }
    if (numero_fecha) {
      conditions.push('numero_fecha = ?');
      args.push(numero_fecha);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM partido WHERE id_partido = ?',
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      goles_local,
      goles_visitante,
      numero_fecha,
      estado,
      id_local,
      id_visitante,
      id_torneo,
      etapa,
      penales_local,
      penales_visitante,
      siguiente_partido_id,
    } = req.body;

    const allowed = await canManageTournament(req.user, id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para registrar partidos en este torneo' });
    }

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }

    const resolvedEstado = estado ?? (goles_local !== undefined || goles_visitante !== undefined ? 'jugado' : 'pendiente');

    const result = await db.execute({
      sql: `INSERT INTO partido (
              goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante,
              id_torneo, etapa, penales_local, penales_visitante, siguiente_partido_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        resolvedEstado,
        id_local,
        id_visitante,
        id_torneo ?? null,
        etapa || 'fecha',
        penales_local ?? null,
        penales_visitante ?? null,
        siguiente_partido_id ?? null,
      ],
    });
    const newMatchId = Number(result.lastInsertRowid);

    if (resolvedEstado !== 'pendiente' && goles_local !== undefined && goles_visitante !== undefined) {
      await settleMatchProde(db, newMatchId, goles_local, goles_visitante);
    }

    res.status(201).json({
      id_partido: newMatchId,
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      estado: resolvedEstado,
      id_local,
      id_visitante,
      id_torneo: id_torneo ?? null,
      etapa: etapa || 'fecha',
      penales_local: penales_local ?? null,
      penales_visitante: penales_visitante ?? null,
      siguiente_partido_id: siguiente_partido_id ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const {
      goles_local,
      goles_visitante,
      numero_fecha,
      estado,
      id_local,
      id_visitante,
      id_torneo,
      etapa,
      penales_local,
      penales_visitante,
      siguiente_partido_id,
    } = req.body;

    const matchRes = await db.execute({
      sql: 'SELECT * FROM partido WHERE id_partido = ?',
      args: [req.params.id],
    });
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    const existingMatch = matchRes.rows[0];

    const allowed = await canManageTournament(req.user, existingMatch.id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para modificar este partido' });
    }

    if (id_torneo && id_torneo !== existingMatch.id_torneo) {
      const allowedNew = await canManageTournament(req.user, id_torneo, db);
      if (!allowedNew) {
        return res.status(403).json({ error: 'No tenés permisos para mover el partido al torneo destino' });
      }
    }

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }

    await db.execute({
      sql: `UPDATE partido
            SET goles_local = ?, goles_visitante = ?, numero_fecha = ?, estado = ?,
                id_local = ?, id_visitante = ?, id_torneo = ?, etapa = ?,
                penales_local = ?, penales_visitante = ?, siguiente_partido_id = ?
            WHERE id_partido = ?`,
      args: [
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        estado ?? null,
        id_local,
        id_visitante,
        id_torneo ?? null,
        etapa || 'fecha',
        penales_local ?? null,
        penales_visitante ?? null,
        siguiente_partido_id ?? null,
        req.params.id,
      ],
    });

    if (estado !== 'pendiente' && goles_local !== undefined && goles_visitante !== undefined) {
      await settleMatchProde(db, req.params.id, goles_local, goles_visitante);
    }

    res.json({
      id_partido: Number(req.params.id),
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      estado: estado ?? null,
      id_local,
      id_visitante,
      id_torneo: id_torneo ?? null,
      etapa: etapa || 'fecha',
      penales_local: penales_local ?? null,
      penales_visitante: penales_visitante ?? null,
      siguiente_partido_id: siguiente_partido_id ?? null,
    });
  } catch (err) {
    next(err);
  }
});


router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const matchRes = await db.execute({
      sql: 'SELECT * FROM partido WHERE id_partido = ?',
      args: [req.params.id],
    });
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }
    const existingMatch = matchRes.rows[0];

    const allowed = await canManageTournament(req.user, existingMatch.id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para eliminar este partido' });
    }

    await db.execute({
      sql: 'DELETE FROM partido WHERE id_partido = ?',
      args: [req.params.id],
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
