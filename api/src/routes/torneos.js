import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import prodeRouter from './prode.js';
import { initializeTournamentMatches } from '../domain/fixtureGenerator.js';

const router = Router();

router.use('/:id/prode', prodeRouter);

const VALID_FORMATOS = ['liga_ida', 'liga_ida_vuelta', 'eliminacion_directa', 'grupos_eliminacion'];

function generateTournamentCode() {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TRN-${rand}`;
}

async function getTorneoOr404(id, res) {
  const result = await db.execute({
    sql: `SELECT t.*, j.nombre as juego_nombre, u.username as organizador_username, p.nombre as campeon_nombre
          FROM torneo t
          LEFT JOIN juego j ON t.id_juego = j.id_juego
          LEFT JOIN usuario u ON t.id_organizador = u.id_usuario
          LEFT JOIN persona p ON t.campeon_id = p.id_persona
          WHERE t.id_torneo = ?`,
    args: [id],
  });
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Torneo no encontrado' });
    return null;
  }
  return result.rows[0];
}

function checkCanManageTorneo(user, torneo, res) {
  if (user.role === 'admin' || torneo.id_organizador === user.id) {
    return true;
  }
  res.status(403).json({ error: 'No tenés permisos para gestionar este torneo' });
  return false;
}

// GET /torneos - Listar torneos
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { estado } = req.query;
    let sql = `
      SELECT 
        t.id_torneo,
        t.nombre,
        t.descripcion,
        t.codigo_invitacion,
        t.id_juego,
        COALESCE(j.nombre, t.juego) as juego,
        t.formato,
        t.estado,
        t.id_organizador,
        u.username as organizador_username,
        t.campeon_id,
        p.nombre as campeon_nombre,
        t.configuracion_json,
        t.creado_en,
        COUNT(DISTINCT tp.id_persona) as participantes_count,
        COUNT(DISTINCT part.id_partido) as partidos_count
      FROM torneo t
      LEFT JOIN juego j ON t.id_juego = j.id_juego
      LEFT JOIN usuario u ON t.id_organizador = u.id_usuario
      LEFT JOIN persona p ON t.campeon_id = p.id_persona
      LEFT JOIN torneo_participante tp ON t.id_torneo = tp.id_torneo
      LEFT JOIN partido part ON t.id_torneo = part.id_torneo
    `;
    const args = [];

    if (estado) {
      sql += ' WHERE t.estado = ?';
      args.push(estado);
    }

    sql += ' GROUP BY t.id_torneo ORDER BY t.id_torneo DESC';

    const result = await db.execute({ sql, args });
    const rows = result.rows.map((t) => {
      const canSeeCode = req.user && (req.user.role === 'admin' || req.user.id === t.id_organizador);
      return {
        ...t,
        codigo_invitacion: canSeeCode ? t.codigo_invitacion : null,
      };
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /torneos/unirse-codigo - Unirse a un torneo mediante código de invitación
router.post('/unirse-codigo', requireAuth, async (req, res, next) => {
  try {
    const { codigo, id_equipo } = req.body;
    if (!codigo || !codigo.trim()) {
      return res.status(400).json({ error: 'El código de invitación es obligatorio' });
    }

    const cleanCode = codigo.trim().toUpperCase();
    const torneoRes = await db.execute({
      sql: 'SELECT * FROM torneo WHERE UPPER(TRIM(codigo_invitacion)) = ?',
      args: [cleanCode],
    });

    if (torneoRes.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ningún torneo con ese código de invitación.' });
    }

    const torneo = torneoRes.rows[0];
    if (torneo.estado !== 'borrador') {
      return res.status(400).json({ error: 'El torneo ya se encuentra iniciado o finalizado y no admite nuevos participantes.' });
    }

    // Check if user is blocked from this tournament
    const blockCheck = await db.execute({
      sql: 'SELECT motivo FROM torneo_bloqueado WHERE id_torneo = ? AND id_usuario = ?',
      args: [torneo.id_torneo, req.user.id],
    });
    if (blockCheck.rows.length > 0) {
      const reason = blockCheck.rows[0].motivo ? ` Motivo: ${blockCheck.rows[0].motivo}` : '';
      return res.status(403).json({ error: `Has sido bloqueado de este torneo por el organizador.${reason}` });
    }

    // Resolve or create persona for current user
    let targetPersonaId;
    const personaRes = await db.execute({
      sql: 'SELECT id_persona FROM persona WHERE id_usuario = ?',
      args: [req.user.id],
    });
    if (personaRes.rows.length > 0) {
      targetPersonaId = personaRes.rows[0].id_persona;
    } else {
      const createPersonaRes = await db.execute({
        sql: 'INSERT INTO persona (nombre, id_usuario) VALUES (?, ?)',
        args: [req.user.username, req.user.id],
      });
      targetPersonaId = Number(createPersonaRes.lastInsertRowid);
    }

    // Check if already participant
    const alreadyIn = await db.execute({
      sql: 'SELECT id_persona FROM torneo_participante WHERE id_torneo = ? AND id_persona = ?',
      args: [torneo.id_torneo, targetPersonaId],
    });
    if (alreadyIn.rows.length > 0) {
      return res.status(409).json({ error: 'Ya estás participando en este torneo.' });
    }

    let finalIdEquipo = id_equipo ? Number(id_equipo) : null;

    if (finalIdEquipo) {
      const eqRes = await db.execute({
        sql: 'SELECT id_equipo, id_juego FROM equipo WHERE id_equipo = ?',
        args: [finalIdEquipo],
      });
      if (eqRes.rows.length === 0 || eqRes.rows[0].id_juego !== torneo.id_juego) {
        return res.status(400).json({ error: 'El equipo seleccionado no pertenece al catálogo de este juego.' });
      }

      const takenRes = await db.execute({
        sql: 'SELECT id_persona FROM torneo_participante WHERE id_torneo = ? AND id_equipo = ?',
        args: [torneo.id_torneo, finalIdEquipo],
      });
      if (takenRes.rows.length > 0) {
        return res.status(409).json({ error: 'Ese equipo ya ha sido tomado por otro participante.' });
      }
    } else {
      const availRes = await db.execute({
        sql: `SELECT id_equipo FROM equipo 
              WHERE id_juego = ? 
                AND id_equipo NOT IN (SELECT id_equipo FROM torneo_participante WHERE id_torneo = ?)
              ORDER BY id_equipo ASC LIMIT 1`,
        args: [torneo.id_juego, torneo.id_torneo],
      });
      if (availRes.rows.length === 0) {
        return res.status(400).json({ error: 'No quedan equipos disponibles en el catálogo de este juego.' });
      }
      finalIdEquipo = Number(availRes.rows[0].id_equipo);
    }

    await db.execute({
      sql: 'INSERT INTO torneo_participante (id_torneo, id_persona, id_equipo) VALUES (?, ?, ?)',
      args: [torneo.id_torneo, targetPersonaId, finalIdEquipo],
    });

    await db.execute({
      sql: "UPDATE torneo_solicitud SET estado = 'aprobada' WHERE id_torneo = ? AND id_usuario = ?",
      args: [torneo.id_torneo, req.user.id],
    });

    res.status(201).json({
      message: `Te has unido exitosamente al torneo "${torneo.nombre}".`,
      id_torneo: torneo.id_torneo,
      id_persona: targetPersonaId,
      id_equipo: finalIdEquipo,
    });
  } catch (err) {
    next(err);
  }
});

// GET /torneos/:id - Detalle con participantes
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;

    const participantesResult = await db.execute({
      sql: `
        SELECT 
          tp.id_persona,
          p.nombre as persona_nombre,
          p.id_usuario,
          u_part.username as usuario_username,
          u_part.avatar_url as usuario_avatar_url,
          tp.id_equipo,
          e.nombre as equipo_nombre,
          tp.grupo,
          tp.sembrado
        FROM torneo_participante tp
        JOIN persona p ON tp.id_persona = p.id_persona
        LEFT JOIN usuario u_part ON p.id_usuario = u_part.id_usuario
        JOIN equipo e ON tp.id_equipo = e.id_equipo
        WHERE tp.id_torneo = ?
        ORDER BY tp.grupo ASC, p.nombre ASC
      `,
      args: [req.params.id],
    });

    const canSeeCode = req.user && (req.user.role === 'admin' || req.user.id === torneo.id_organizador);

    res.json({
      ...torneo,
      codigo_invitacion: canSeeCode ? torneo.codigo_invitacion : null,
      configuracion: JSON.parse(torneo.configuracion_json || '{}'),
      participantes: participantesResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos - Crear torneo en borrador
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { nombre, descripcion, id_juego, juego, formato, configuracion } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del torneo es obligatorio' });
    }

    const formatoElegido = formato || 'liga_ida';
    if (!VALID_FORMATOS.includes(formatoElegido)) {
      return res.status(400).json({
        error: `Formato inválido. Opciones válidas: ${VALID_FORMATOS.join(', ')}`,
      });
    }

    let resolvedIdJuego = id_juego ? Number(id_juego) : null;
    let resolvedJuegoNombre = juego ? juego.trim() : null;

    if (resolvedIdJuego) {
      const jRes = await db.execute({
        sql: 'SELECT id_juego, nombre FROM juego WHERE id_juego = ?',
        args: [resolvedIdJuego],
      });
      if (jRes.rows.length > 0) {
        resolvedJuegoNombre = jRes.rows[0].nombre;
      }
    } else if (resolvedJuegoNombre) {
      const jRes = await db.execute({
        sql: 'SELECT id_juego, nombre FROM juego WHERE LOWER(nombre) = LOWER(?)',
        args: [resolvedJuegoNombre],
      });
      if (jRes.rows.length > 0) {
        resolvedIdJuego = jRes.rows[0].id_juego;
        resolvedJuegoNombre = jRes.rows[0].nombre;
      }
    }

    if (!resolvedIdJuego) {
      resolvedIdJuego = 1;
      resolvedJuegoNombre = resolvedJuegoNombre || 'PES 6 EuroAmericano Clásico 2';
    }

    const { codigo_invitacion } = req.body;
    const resolvedCodigo = codigo_invitacion && codigo_invitacion.trim()
      ? codigo_invitacion.trim().toUpperCase()
      : generateTournamentCode();

    const result = await db.execute({
      sql: `INSERT INTO torneo (nombre, descripcion, codigo_invitacion, id_juego, juego, formato, estado, id_organizador, configuracion_json)
            VALUES (?, ?, ?, ?, ?, ?, 'borrador', ?, ?)`,
      args: [
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        resolvedCodigo,
        resolvedIdJuego,
        resolvedJuegoNombre,
        formatoElegido,
        req.user.id,
        JSON.stringify(configuracion || {}),
      ],
    });

    const id_torneo = Number(result.lastInsertRowid);
    res.status(201).json({
      id_torneo,
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      codigo_invitacion: resolvedCodigo,
      id_juego: resolvedIdJuego,
      juego: resolvedJuegoNombre,
      formato: formatoElegido,
      estado: 'borrador',
      id_organizador: req.user.id,
      configuracion: configuracion || {},
    });
  } catch (err) {
    next(err);
  }
});

// PUT /torneos/:id - Modificar metadatos (Solo en borrador)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'borrador') {
      return res.status(400).json({
        error: 'No se pueden modificar las configuraciones de un torneo que ya no está en borrador.',
      });
    }

    const { nombre, descripcion, id_juego, juego, formato, configuracion } = req.body;

    if (formato && !VALID_FORMATOS.includes(formato)) {
      return res.status(400).json({
        error: `Formato inválido. Opciones válidas: ${VALID_FORMATOS.join(', ')}`,
      });
    }

    const nuevoNombre = nombre ? nombre.trim() : torneo.nombre;
    const nuevaDesc = descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : torneo.descripcion;
    let nuevoIdJuego = id_juego ? Number(id_juego) : torneo.id_juego;
    let nuevoJuego = juego ? juego.trim() : torneo.juego;

    if (id_juego && id_juego !== torneo.id_juego) {
      const jRes = await db.execute({
        sql: 'SELECT id_juego, nombre FROM juego WHERE id_juego = ?',
        args: [nuevoIdJuego],
      });
      if (jRes.rows.length > 0) {
        nuevoJuego = jRes.rows[0].nombre;
      }
    }

    const nuevoFormato = formato || torneo.formato;
    const nuevaConf = configuracion ? JSON.stringify(configuracion) : torneo.configuracion_json;

    await db.execute({
      sql: `UPDATE torneo
            SET nombre = ?, descripcion = ?, id_juego = ?, juego = ?, formato = ?, configuracion_json = ?
            WHERE id_torneo = ?`,
      args: [nuevoNombre, nuevaDesc, nuevoIdJuego, nuevoJuego, nuevoFormato, nuevaConf, req.params.id],
    });

    res.json({
      id_torneo: Number(req.params.id),
      nombre: nuevoNombre,
      descripcion: nuevaDesc,
      id_juego: nuevoIdJuego,
      juego: nuevoJuego,
      formato: nuevoFormato,
      estado: torneo.estado,
      id_organizador: torneo.id_organizador,
      configuracion: JSON.parse(nuevaConf || '{}'),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /torneos/:id - Eliminar torneo (Solo en borrador, salvo admin)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'borrador' && req.user.role !== 'admin') {
      return res.status(400).json({
        error: 'Solo los administradores globales pueden eliminar un torneo iniciado o finalizado.',
      });
    }

    await db.execute({
      sql: 'DELETE FROM torneo WHERE id_torneo = ?',
      args: [req.params.id],
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/participantes - Asignar participante(s)
router.post('/:id/participantes', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'borrador') {
      return res.status(400).json({
        error: 'No se pueden añadir o modificar participantes una vez iniciado el torneo.',
      });
    }

    const { participantes } = req.body;
    const list = Array.isArray(participantes)
      ? participantes
      : [{
          id_persona: req.body.id_persona,
          nombre: req.body.nombre,
          id_usuario: req.body.id_usuario,
          id_equipo: req.body.id_equipo,
          grupo: req.body.grupo,
          sembrado: req.body.sembrado,
        }];

    for (const item of list) {
      let targetPersonaId = item.id_persona;

      // Si no viene id_persona pero viene nombre o id_usuario, resolver o crear
      if (!targetPersonaId && (item.nombre || item.id_usuario)) {
        if (item.id_usuario) {
          const userPersona = await db.execute({
            sql: 'SELECT id_persona FROM persona WHERE id_usuario = ?',
            args: [item.id_usuario],
          });
          if (userPersona.rows.length > 0) {
            targetPersonaId = userPersona.rows[0].id_persona;
          }
        }
        if (!targetPersonaId && item.nombre) {
          const namedPersona = await db.execute({
            sql: 'SELECT id_persona FROM persona WHERE LOWER(nombre) = LOWER(?)',
            args: [item.nombre.trim()],
          });
          if (namedPersona.rows.length > 0) {
            targetPersonaId = namedPersona.rows[0].id_persona;
          } else {
            const createPersonaRes = await db.execute({
              sql: 'INSERT INTO persona (nombre, id_equipo, id_usuario) VALUES (?, ?, ?)',
              args: [item.nombre.trim(), item.id_equipo, item.id_usuario ?? null],
            });
            targetPersonaId = Number(createPersonaRes.lastInsertRowid);
          }
        }
      }

      if (!targetPersonaId || !item.id_equipo) {
        return res.status(400).json({ error: 'id_persona (o nombre) y id_equipo son obligatorios para cada participante' });
      }

      await db.execute({
        sql: `INSERT INTO torneo_participante (id_torneo, id_persona, id_equipo, grupo, sembrado)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id_torneo, id_persona) DO UPDATE SET
                id_equipo = excluded.id_equipo,
                grupo = excluded.grupo,
                sembrado = excluded.sembrado`,
        args: [
          req.params.id,
          targetPersonaId,
          item.id_equipo,
          item.grupo ?? null,
          item.sembrado ?? null,
        ],
      });
    }

    res.status(201).json({ message: `${list.length} participante(s) asignado(s) exitosamente.` });
  } catch (err) {
    next(err);
  }
});

// DELETE /torneos/:id/participantes/:id_persona - Quitar un participante
router.delete('/:id/participantes/:id_persona', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'borrador') {
      return res.status(400).json({
        error: 'No se pueden quitar participantes de un torneo que ya comenzó.',
      });
    }

    await db.execute({
      sql: 'DELETE FROM torneo_participante WHERE id_torneo = ? AND id_persona = ?',
      args: [req.params.id, req.params.id_persona],
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/iniciar - Iniciar torneo (Borrador -> En Curso)
router.post('/:id/iniciar', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'borrador') {
      return res.status(400).json({ error: 'El torneo ya se encuentra iniciado o finalizado.' });
    }

    const countRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM torneo_participante WHERE id_torneo = ?',
      args: [req.params.id],
    });
    const count = Number(countRes.rows[0]?.count ?? 0);
    if (count < 2) {
      return res.status(400).json({
        error: 'Se necesitan al menos 2 participantes para iniciar un torneo.',
      });
    }

    await db.execute({
      sql: "UPDATE torneo SET estado = 'en_curso' WHERE id_torneo = ?",
      args: [req.params.id],
    });

    if (req.body?.generar_fixture) {
      await initializeTournamentMatches(db, req.params.id, torneo.formato);
    }

    res.json({
      id_torneo: Number(req.params.id),
      estado: 'en_curso',
      message: 'Torneo iniciado correctamente.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/generar-fixture - Generar fixture oficial en base a participantes y formato
router.post('/:id/generar-fixture', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado === 'finalizado') {
      return res.status(400).json({ error: 'No se puede generar fixture para un torneo finalizado.' });
    }

    const existingMatches = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM partido WHERE id_torneo = ?',
      args: [req.params.id],
    });
    if (Number(existingMatches.rows[0]?.count ?? 0) > 0) {
      return res.status(400).json({ error: 'El torneo ya tiene partidos registrados o generados.' });
    }

    await initializeTournamentMatches(db, req.params.id, torneo.formato);

    const generated = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM partido WHERE id_torneo = ?',
      args: [req.params.id],
    });

    res.status(201).json({
      message: 'Fixture generado exitosamente.',
      partidos_creados: Number(generated.rows[0]?.count ?? 0),
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/finalizar - Finalizar torneo (En Curso -> Finalizado)
router.post('/:id/finalizar', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'en_curso') {
      return res.status(400).json({ error: 'Solo se puede finalizar un torneo que esté en curso.' });
    }

    const { campeon_id } = req.body;

    await db.execute({
      sql: "UPDATE torneo SET estado = 'finalizado', campeon_id = ? WHERE id_torneo = ?",
      args: [campeon_id ?? null, req.params.id],
    });

    res.json({
      id_torneo: Number(req.params.id),
      estado: 'finalizado',
      campeon_id: campeon_id ?? null,
      message: 'Torneo finalizado con éxito.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/solicitar-unirse - Enviar solicitud para participar en un torneo
router.post('/:id/solicitar-unirse', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;

    if (torneo.estado !== 'borrador') {
      return res.status(400).json({ error: 'El torneo ya no acepta nuevas solicitudes porque no está en borrador.' });
    }

    // Check if user is blocked from this tournament
    const blockCheck = await db.execute({
      sql: 'SELECT motivo FROM torneo_bloqueado WHERE id_torneo = ? AND id_usuario = ?',
      args: [torneo.id_torneo, req.user.id],
    });
    if (blockCheck.rows.length > 0) {
      const reason = blockCheck.rows[0].motivo ? ` Motivo: ${blockCheck.rows[0].motivo}` : '';
      return res.status(403).json({ error: `Has sido bloqueado de este torneo por el organizador.${reason}` });
    }

    // Check if user is already participating
    const existingPersona = await db.execute({
      sql: `SELECT tp.id_persona FROM torneo_participante tp
            JOIN persona p ON tp.id_persona = p.id_persona
            WHERE tp.id_torneo = ? AND p.id_usuario = ?`,
      args: [torneo.id_torneo, req.user.id],
    });
    if (existingPersona.rows.length > 0) {
      return res.status(409).json({ error: 'Ya formás parte de este torneo.' });
    }

    // Check existing pending request
    const pendingReq = await db.execute({
      sql: "SELECT id_solicitud FROM torneo_solicitud WHERE id_torneo = ? AND id_usuario = ? AND estado = 'pendiente'",
      args: [torneo.id_torneo, req.user.id],
    });
    if (pendingReq.rows.length > 0) {
      return res.status(409).json({ error: 'Ya tenés una solicitud pendiente para unirte a este torneo.' });
    }

    const { id_equipo, mensaje } = req.body;
    let chosenEquipo = id_equipo ? Number(id_equipo) : null;

    if (chosenEquipo) {
      const eqRes = await db.execute({
        sql: 'SELECT id_equipo, id_juego FROM equipo WHERE id_equipo = ?',
        args: [chosenEquipo],
      });
      if (eqRes.rows.length === 0 || eqRes.rows[0].id_juego !== torneo.id_juego) {
        return res.status(400).json({ error: 'El equipo elegido no corresponde a este juego.' });
      }
    }

    const result = await db.execute({
      sql: `INSERT INTO torneo_solicitud (id_torneo, id_usuario, id_equipo, mensaje, estado)
            VALUES (?, ?, ?, ?, 'pendiente')
            ON CONFLICT(id_torneo, id_usuario) DO UPDATE SET
              id_equipo = excluded.id_equipo,
              mensaje = excluded.mensaje,
              estado = 'pendiente',
              creado_en = datetime('now')`,
      args: [torneo.id_torneo, req.user.id, chosenEquipo, mensaje ? mensaje.trim() : null],
    });

    res.status(201).json({
      id_solicitud: Number(result.lastInsertRowid),
      id_torneo: torneo.id_torneo,
      id_usuario: req.user.id,
      id_equipo: chosenEquipo,
      mensaje: mensaje ? mensaje.trim() : null,
      estado: 'pendiente',
    });
  } catch (err) {
    next(err);
  }
});

// GET /torneos/:id/solicitudes - Listar solicitudes (organizador o admin)
router.get('/:id/solicitudes', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    const result = await db.execute({
      sql: `SELECT s.id_solicitud, s.id_torneo, s.id_usuario, u.username, u.avatar_url,
                   s.id_equipo, e.nombre as equipo_nombre, s.mensaje, s.estado, s.creado_en
            FROM torneo_solicitud s
            JOIN usuario u ON s.id_usuario = u.id_usuario
            LEFT JOIN equipo e ON s.id_equipo = e.id_equipo
            WHERE s.id_torneo = ?
            ORDER BY s.id_solicitud DESC`,
      args: [req.params.id],
    });

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/solicitudes/:id_solicitud/aprobar - Aprobar solicitud (organizador o admin)
router.post('/:id/solicitudes/:id_solicitud/aprobar', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    if (torneo.estado !== 'borrador') {
      return res.status(400).json({ error: 'No se pueden incorporar participantes a un torneo que ya comenzó.' });
    }

    const solRes = await db.execute({
      sql: `SELECT s.*, u.username FROM torneo_solicitud s 
            JOIN usuario u ON s.id_usuario = u.id_usuario 
            WHERE s.id_solicitud = ? AND s.id_torneo = ?`,
      args: [req.params.id_solicitud, req.params.id],
    });
    if (solRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    const solicitud = solRes.rows[0];

    // Resolve or create persona
    let targetPersonaId;
    const personaRes = await db.execute({
      sql: 'SELECT id_persona FROM persona WHERE id_usuario = ?',
      args: [solicitud.id_usuario],
    });
    if (personaRes.rows.length > 0) {
      targetPersonaId = personaRes.rows[0].id_persona;
    } else {
      const createPersonaRes = await db.execute({
        sql: 'INSERT INTO persona (nombre, id_usuario) VALUES (?, ?)',
        args: [solicitud.username, solicitud.id_usuario],
      });
      targetPersonaId = Number(createPersonaRes.lastInsertRowid);
    }

    let finalIdEquipo = req.body.id_equipo ? Number(req.body.id_equipo) : solicitud.id_equipo;

    if (!finalIdEquipo) {
      const availRes = await db.execute({
        sql: `SELECT id_equipo FROM equipo 
              WHERE id_juego = ? 
                AND id_equipo NOT IN (SELECT id_equipo FROM torneo_participante WHERE id_torneo = ?)
              ORDER BY id_equipo ASC LIMIT 1`,
        args: [torneo.id_juego, torneo.id_torneo],
      });
      if (availRes.rows.length === 0) {
        return res.status(400).json({ error: 'No quedan equipos disponibles en el catálogo para asignar.' });
      }
      finalIdEquipo = Number(availRes.rows[0].id_equipo);
    } else {
      const takenRes = await db.execute({
        sql: 'SELECT id_persona FROM torneo_participante WHERE id_torneo = ? AND id_equipo = ?',
        args: [torneo.id_torneo, finalIdEquipo],
      });
      if (takenRes.rows.length > 0) {
        return res.status(409).json({ error: 'Ese equipo ya ha sido tomado por otro participante.' });
      }
    }

    await db.execute({
      sql: `INSERT INTO torneo_participante (id_torneo, id_persona, id_equipo)
            VALUES (?, ?, ?)
            ON CONFLICT(id_torneo, id_persona) DO UPDATE SET id_equipo = excluded.id_equipo`,
      args: [torneo.id_torneo, targetPersonaId, finalIdEquipo],
    });

    await db.execute({
      sql: "UPDATE torneo_solicitud SET estado = 'aprobada', id_equipo = ? WHERE id_solicitud = ?",
      args: [finalIdEquipo, req.params.id_solicitud],
    });

    res.json({
      message: 'Solicitud aprobada e incorporado exitosamente.',
      id_solicitud: Number(req.params.id_solicitud),
      id_persona: targetPersonaId,
      id_equipo: finalIdEquipo,
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/solicitudes/:id_solicitud/rechazar - Rechazar solicitud
router.post('/:id/solicitudes/:id_solicitud/rechazar', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    const result = await db.execute({
      sql: "UPDATE torneo_solicitud SET estado = 'rechazada' WHERE id_solicitud = ? AND id_torneo = ?",
      args: [req.params.id_solicitud, req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    res.json({ message: 'Solicitud rechazada.', id_solicitud: Number(req.params.id_solicitud) });
  } catch (err) {
    next(err);
  }
});

// GET /torneos/:id/mi-solicitud - Estado de solicitud del usuario logueado
router.get('/:id/mi-solicitud', requireAuth, async (req, res, next) => {
  try {
    const solRes = await db.execute({
      sql: `SELECT s.*, e.nombre as equipo_nombre
            FROM torneo_solicitud s
            LEFT JOIN equipo e ON s.id_equipo = e.id_equipo
            WHERE s.id_torneo = ? AND s.id_usuario = ?`,
      args: [req.params.id, req.user.id],
    });

    const partRes = await db.execute({
      sql: `SELECT tp.*, e.nombre as equipo_nombre
            FROM torneo_participante tp
            JOIN persona p ON tp.id_persona = p.id_persona
            JOIN equipo e ON tp.id_equipo = e.id_equipo
            WHERE tp.id_torneo = ? AND p.id_usuario = ?`,
      args: [req.params.id, req.user.id],
    });

    res.json({
      es_participante: partRes.rows.length > 0,
      participante: partRes.rows[0] || null,
      solicitud: solRes.rows[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /torneos/:id/bloquear - Bloquear a un usuario del torneo
router.post('/:id/bloquear', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    const { id_usuario, motivo } = req.body;
    if (!id_usuario) {
      return res.status(400).json({ error: 'id_usuario es obligatorio para bloquear a un usuario' });
    }

    if (Number(id_usuario) === Number(torneo.id_organizador)) {
      return res.status(400).json({ error: 'El organizador no puede bloquearse a sí mismo' });
    }

    // Insert or update in blocklist
    await db.execute({
      sql: `INSERT INTO torneo_bloqueado (id_torneo, id_usuario, motivo)
            VALUES (?, ?, ?)
            ON CONFLICT(id_torneo, id_usuario) DO UPDATE SET motivo = excluded.motivo, bloqueado_en = datetime('now')`,
      args: [torneo.id_torneo, id_usuario, motivo ? motivo.trim() : null],
    });

    // Reject any pending requests from this user
    await db.execute({
      sql: "UPDATE torneo_solicitud SET estado = 'rechazada' WHERE id_torneo = ? AND id_usuario = ?",
      args: [torneo.id_torneo, id_usuario],
    });

    // If tournament is in draft and user is currently a participant, remove them
    if (torneo.estado === 'borrador') {
      const userPersona = await db.execute({
        sql: 'SELECT id_persona FROM persona WHERE id_usuario = ?',
        args: [id_usuario],
      });
      for (const p of userPersona.rows) {
        await db.execute({
          sql: 'DELETE FROM torneo_participante WHERE id_torneo = ? AND id_persona = ?',
          args: [torneo.id_torneo, p.id_persona],
        });
      }
    }

    res.json({
      message: 'Usuario bloqueado exitosamente.',
      id_torneo: torneo.id_torneo,
      id_usuario: Number(id_usuario),
      motivo: motivo ? motivo.trim() : null,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /torneos/:id/bloquear/:id_usuario - Desbloquear a un usuario del torneo
router.delete('/:id/bloquear/:id_usuario', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    const result = await db.execute({
      sql: 'DELETE FROM torneo_bloqueado WHERE id_torneo = ? AND id_usuario = ?',
      args: [torneo.id_torneo, req.params.id_usuario],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'El usuario no se encuentra en la lista de bloqueados.' });
    }

    res.json({ message: 'Usuario desbloqueado exitosamente.' });
  } catch (err) {
    next(err);
  }
});

// GET /torneos/:id/bloqueados - Listar usuarios bloqueados del torneo
router.get('/:id/bloqueados', requireAuth, async (req, res, next) => {
  try {
    const torneo = await getTorneoOr404(req.params.id, res);
    if (!torneo) return;
    if (!checkCanManageTorneo(req.user, torneo, res)) return;

    const result = await db.execute({
      sql: `SELECT b.id_torneo, b.id_usuario, u.username, u.avatar_url, b.motivo, b.bloqueado_en
            FROM torneo_bloqueado b
            JOIN usuario u ON b.id_usuario = u.id_usuario
            WHERE b.id_torneo = ?
            ORDER BY b.bloqueado_en DESC`,
      args: [torneo.id_torneo],
    });

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
