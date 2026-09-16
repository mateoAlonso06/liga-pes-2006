import { Router } from 'express';
import db from '../db.js';
import { requireAuth, canManageTournament } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { id_partido, id_torneo } = req.query;
    let sql = 'SELECT i.* FROM incidencia i';
    const conditions = [];
    const args = [];

    if (id_torneo) {
      sql += ' JOIN partido p ON i.id_partido = p.id_partido';
      conditions.push('p.id_torneo = ?');
      args.push(id_torneo);
    }

    if (id_partido) {
      conditions.push('i.id_partido = ?');
      args.push(id_partido);
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


router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { jugador_virtual, tipo, id_persona, id_partido } = req.body;

    if (typeof jugador_virtual !== 'string' || jugador_virtual.trim() === '') {
      return res.status(400).json({ error: 'jugador_virtual is required' });
    }
    if (tipo !== 'G' && tipo !== 'R') {
      return res.status(400).json({ error: "tipo must be 'G' or 'R'" });
    }
    if (!id_persona || !id_partido) {
      return res.status(400).json({ error: 'id_persona and id_partido are required' });
    }

    const matchRes = await db.execute({
      sql: 'SELECT id_torneo FROM partido WHERE id_partido = ?',
      args: [id_partido],
    });
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partido not found' });
    }

    const allowed = await canManageTournament(req.user, matchRes.rows[0].id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para registrar incidencias en este partido' });
    }

    const result = await db.execute({
      sql: `INSERT INTO incidencia (jugador_virtual, tipo, id_persona, id_partido)
            VALUES (?, ?, ?, ?)`,
      args: [jugador_virtual, tipo, id_persona, id_partido],
    });
    res.status(201).json({
      id_incidencia: Number(result.lastInsertRowid),
      jugador_virtual,
      tipo,
      id_persona,
      id_partido,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const incRes = await db.execute({
      sql: `SELECT p.id_torneo FROM incidencia i
            JOIN partido p ON i.id_partido = p.id_partido
            WHERE i.id_incidencia = ?`,
      args: [req.params.id],
    });
    if (incRes.rows.length === 0) {
      return res.status(404).json({ error: 'Incidencia not found' });
    }

    const allowed = await canManageTournament(req.user, incRes.rows[0].id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para eliminar esta incidencia' });
    }

    await db.execute({
      sql: 'DELETE FROM incidencia WHERE id_incidencia = ?',
      args: [req.params.id],
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
