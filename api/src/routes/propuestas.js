import { Router } from 'express';
import db from '../db.js';
import { requireAuth, canManageTournament } from '../middleware/auth.js';
import { settleMatchProde } from '../domain/prode.js';

const router = Router();

function toPropuestaResponse(row) {
  return {
    id_propuesta: row.id_propuesta,
    id_torneo: row.id_torneo ?? null,
    id_local: row.id_local,
    id_visitante: row.id_visitante,
    goles_local: row.goles_local,
    goles_visitante: row.goles_visitante,
    numero_fecha: row.numero_fecha,
    goleadores: JSON.parse(row.goleadores_json),
    rojas: JSON.parse(row.rojas_json),
    nombre_solicitante: row.nombre_solicitante,
    estado: row.estado,
    creado_en: row.creado_en,
  };
}

router.post('/', async (req, res, next) => {
  try {
    const {
      id_local,
      id_visitante,
      goles_local,
      goles_visitante,
      numero_fecha,
      goleadores,
      rojas,
      nombre_solicitante,
      id_torneo,
    } = req.body;

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }
    if (!nombre_solicitante || !nombre_solicitante.trim()) {
      return res.status(400).json({ error: 'nombre_solicitante is required' });
    }

    if (id_torneo) {
      const torneoRes = await db.execute({
        sql: 'SELECT estado FROM torneo WHERE id_torneo = ?',
        args: [id_torneo]
      });
      if (torneoRes.rows.length === 0) {
        return res.status(404).json({ error: 'Torneo not found' });
      }
      if (torneoRes.rows[0].estado !== 'en_curso') {
        return res.status(409).json({ error: 'Solo se pueden cargar resultados en torneos en curso' });
      }
    }

    const goleadoresArr = goleadores ?? [];
    const rojasArr = rojas ?? [];

    const result = await db.execute({
      sql: `INSERT INTO propuesta_partido
              (id_local, id_visitante, goles_local, goles_visitante, numero_fecha, goleadores_json, rojas_json, nombre_solicitante, estado, id_torneo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      args: [
        id_local,
        id_visitante,
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        JSON.stringify(goleadoresArr),
        JSON.stringify(rojasArr),
        nombre_solicitante ?? null,
        id_torneo ?? null,
      ],
    });

    res.status(201).json({
      id_propuesta: Number(result.lastInsertRowid),
      id_local,
      id_visitante,
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      goleadores: goleadoresArr,
      rojas: rojasArr,
      nombre_solicitante: nombre_solicitante ?? null,
      id_torneo: id_torneo ?? null,
      estado: 'pendiente',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { estado, id_torneo } = req.query;
    let sql = 'SELECT * FROM propuesta_partido';
    const conditions = [];
    const args = [];

    if (req.user.role !== 'admin') {
      if (id_torneo) {
        const allowed = await canManageTournament(req.user, id_torneo, db);
        if (!allowed) {
          return res.status(403).json({ error: 'No tenés permisos para ver propuestas de este torneo' });
        }
      } else {
        conditions.push(`(
          id_torneo IN (SELECT id_torneo FROM torneo WHERE id_organizador = ?)
          OR id_torneo IN (SELECT id_torneo FROM torneo_administrador WHERE id_usuario = ?)
        )`);
        args.push(req.user.id, req.user.id);
      }
    }

    if (estado) {
      conditions.push('estado = ?');
      args.push(estado);
    }
    if (id_torneo) {
      conditions.push('id_torneo = ?');
      args.push(id_torneo);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await db.execute({ sql, args });
    res.json(result.rows.map(toPropuestaResponse));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const {
      id_local,
      id_visitante,
      goles_local,
      goles_visitante,
      numero_fecha,
      goleadores,
      rojas,
    } = req.body;

    const propuestaResult = await db.execute({
      sql: 'SELECT * FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    if (propuestaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    const propuesta = propuestaResult.rows[0];

    if (propuesta.estado !== 'pendiente') {
      return res.status(409).json({ error: 'Solo se pueden editar propuestas pendientes' });
    }

    const allowed = await canManageTournament(req.user, propuesta.id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para editar propuestas de este torneo' });
    }

    if (!id_local || !id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante are required' });
    }
    if (id_local === id_visitante) {
      return res.status(400).json({ error: 'id_local and id_visitante must differ' });
    }

    const goleadoresArr = goleadores ?? [];
    const rojasArr = rojas ?? [];

    await db.execute({
      sql: `UPDATE propuesta_partido
            SET id_local = ?, id_visitante = ?, goles_local = ?, goles_visitante = ?, numero_fecha = ?, goleadores_json = ?, rojas_json = ?
            WHERE id_propuesta = ?`,
      args: [
        id_local,
        id_visitante,
        goles_local ?? 0,
        goles_visitante ?? 0,
        numero_fecha ?? null,
        JSON.stringify(goleadoresArr),
        JSON.stringify(rojasArr),
        req.params.id,
      ],
    });

    res.status(200).json({
      ...toPropuestaResponse(propuesta),
      id_local,
      id_visitante,
      goles_local: goles_local ?? 0,
      goles_visitante: goles_visitante ?? 0,
      numero_fecha: numero_fecha ?? null,
      goleadores: goleadoresArr,
      rojas: rojasArr,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/aprobar', requireAuth, async (req, res, next) => {
  try {
    const propuestaResult = await db.execute({
      sql: 'SELECT * FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    if (propuestaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    const propuesta = propuestaResult.rows[0];
    if (propuesta.estado !== 'pendiente') {
      return res.status(409).json({ error: 'Esta propuesta ya fue procesada' });
    }

    const allowed = await canManageTournament(req.user, propuesta.id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para moderar propuestas de este torneo' });
    }

    let conflictoSql = `SELECT * FROM partido
          WHERE (estado IS NULL OR estado != 'pendiente')
            AND numero_fecha = ?
            AND ((id_local = ? AND id_visitante = ?) OR (id_local = ? AND id_visitante = ?))`;
    const conflictoArgs = [
      propuesta.numero_fecha,
      propuesta.id_local,
      propuesta.id_visitante,
      propuesta.id_visitante,
      propuesta.id_local,
    ];

    if (propuesta.id_torneo) {
      conflictoSql += ' AND id_torneo = ?';
      conflictoArgs.push(propuesta.id_torneo);
    }

    const conflicto = await db.execute({
      sql: conflictoSql,
      args: conflictoArgs,
    });
    if (conflicto.rows.length > 0) {
      return res
        .status(409)
        .json({ error: 'Ya existe un resultado cargado para esa fecha entre estos rivales' });
    }

    // Check if there is an existing pending match for this pairing
    let pendingSql = `SELECT id_partido FROM partido
          WHERE estado = 'pendiente'
            AND ((id_local = ? AND id_visitante = ?) OR (id_local = ? AND id_visitante = ?))`;
    const pendingArgs = [
      propuesta.id_local,
      propuesta.id_visitante,
      propuesta.id_visitante,
      propuesta.id_local,
    ];
    if (propuesta.numero_fecha) {
      pendingSql += ' AND numero_fecha = ?';
      pendingArgs.push(propuesta.numero_fecha);
    }
    if (propuesta.id_torneo) {
      pendingSql += ' AND id_torneo = ?';
      pendingArgs.push(propuesta.id_torneo);
    }

    const pendingRes = await db.execute({ sql: pendingSql, args: pendingArgs });
    let id_partido;

    if (pendingRes.rows.length > 0) {
      id_partido = Number(pendingRes.rows[0].id_partido);
      await db.execute({
        sql: `UPDATE partido
              SET goles_local = ?, goles_visitante = ?, estado = 'jugado', id_local = ?, id_visitante = ?
              WHERE id_partido = ?`,
        args: [
          propuesta.goles_local,
          propuesta.goles_visitante,
          propuesta.id_local,
          propuesta.id_visitante,
          id_partido,
        ],
      });
    } else {
      const partidoResult = await db.execute({
        sql: `INSERT INTO partido (goles_local, goles_visitante, numero_fecha, estado, id_local, id_visitante, id_torneo)
              VALUES (?, ?, ?, 'jugado', ?, ?, ?)`,
        args: [
          propuesta.goles_local,
          propuesta.goles_visitante,
          propuesta.numero_fecha,
          propuesta.id_local,
          propuesta.id_visitante,
          propuesta.id_torneo ?? null,
        ],
      });
      id_partido = Number(partidoResult.lastInsertRowid);
    }

    // Settle prode predictions
    await settleMatchProde(db, id_partido, propuesta.goles_local, propuesta.goles_visitante);

    const goleadores = JSON.parse(propuesta.goleadores_json);
    const rojas = JSON.parse(propuesta.rojas_json);

    for (const g of goleadores) {
      for (let n = 0; n < g.cantidad; n++) {
        await db.execute({
          sql: `INSERT INTO incidencia (jugador_virtual, tipo, id_persona, id_partido)
                VALUES (?, 'G', ?, ?)`,
          args: [g.jugador, g.personaId, id_partido],
        });
      }
    }
    for (const r of rojas) {
      await db.execute({
        sql: `INSERT INTO incidencia (jugador_virtual, tipo, id_persona, id_partido)
              VALUES (?, 'R', ?, ?)`,
        args: [r.jugador, r.personaId, id_partido],
      });
    }

    await db.execute({
      sql: `UPDATE propuesta_partido SET estado = 'aprobado' WHERE id_propuesta = ?`,
      args: [req.params.id],
    });

    res.status(201).json({
      id_partido,
      goles_local: propuesta.goles_local,
      goles_visitante: propuesta.goles_visitante,
      numero_fecha: propuesta.numero_fecha,
      estado: null,
      id_local: propuesta.id_local,
      id_visitante: propuesta.id_visitante,
      id_torneo: propuesta.id_torneo ?? null,
    });
  } catch (err) {
    next(err);
  }
});


router.post('/:id/rechazar', requireAuth, async (req, res, next) => {
  try {
    const propuestaResult = await db.execute({
      sql: 'SELECT * FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    if (propuestaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    const propuesta = propuestaResult.rows[0];

    const allowed = await canManageTournament(req.user, propuesta.id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para moderar propuestas de este torneo' });
    }

    await db.execute({
      sql: `UPDATE propuesta_partido SET estado = 'rechazado' WHERE id_propuesta = ?`,
      args: [req.params.id],
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const propuestaResult = await db.execute({
      sql: 'SELECT * FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    if (propuestaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Propuesta not found' });
    }
    const propuesta = propuestaResult.rows[0];

    const allowed = await canManageTournament(req.user, propuesta.id_torneo, db);
    if (!allowed) {
      return res.status(403).json({ error: 'No tenés permisos para eliminar propuestas de este torneo' });
    }

    await db.execute({
      sql: 'DELETE FROM propuesta_partido WHERE id_propuesta = ?',
      args: [req.params.id],
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
