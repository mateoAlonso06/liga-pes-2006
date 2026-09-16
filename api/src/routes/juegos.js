import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /juegos - Listar todos los juegos y parches activos
router.get('/', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id_juego, nombre, descripcion, activo, creado_en FROM juego WHERE activo = 1 ORDER BY id_juego ASC',
      args: [],
    });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /juegos/:id - Obtener un juego específico
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id_juego, nombre, descripcion, activo, creado_en FROM juego WHERE id_juego = ?',
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Juego no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /juegos/:id/equipos - Listar los equipos pertenecientes al juego
router.get('/:id/equipos', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id_equipo, nombre, id_juego FROM equipo WHERE id_juego = ? ORDER BY nombre ASC',
      args: [req.params.id],
    });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /juegos - Dar de alta un nuevo juego o parche (Solo Administrador)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del juego es obligatorio' });
    }

    const cleanName = nombre.trim();
    const cleanDesc = descripcion ? descripcion.trim() : null;

    const existing = await db.execute({
      sql: 'SELECT id_juego FROM juego WHERE LOWER(nombre) = LOWER(?)',
      args: [cleanName],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un juego o parche con ese nombre' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO juego (nombre, descripcion) VALUES (?, ?)',
      args: [cleanName, cleanDesc],
    });

    res.status(201).json({
      id_juego: Number(result.lastInsertRowid),
      nombre: cleanName,
      descripcion: cleanDesc,
      activo: 1,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
