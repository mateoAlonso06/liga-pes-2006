import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { id_equipo, id_usuario } = req.query;
    let sql = `
      SELECT p.id_persona, p.nombre, p.id_equipo, p.id_usuario, u.username as usuario_username, u.avatar_url as usuario_avatar_url, e.nombre as equipo_nombre
      FROM persona p
      LEFT JOIN usuario u ON p.id_usuario = u.id_usuario
      LEFT JOIN equipo e ON p.id_equipo = e.id_equipo
    `;
    const conditions = [];
    const args = [];
    if (id_equipo) {
      conditions.push('p.id_equipo = ?');
      args.push(id_equipo);
    }
    if (id_usuario) {
      conditions.push('p.id_usuario = ?');
      args.push(id_usuario);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY p.nombre ASC';
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `SELECT p.id_persona, p.nombre, p.id_equipo, p.id_usuario, u.username as usuario_username, u.avatar_url as usuario_avatar_url, e.nombre as equipo_nombre
            FROM persona p
            LEFT JOIN usuario u ON p.id_usuario = u.id_usuario
            LEFT JOIN equipo e ON p.id_equipo = e.id_equipo
            WHERE p.id_persona = ?`,
      args: [req.params.id],
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, id_equipo, id_usuario } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const cleanName = nombre.trim();
    const result = await db.execute({
      sql: 'INSERT INTO persona (nombre, id_equipo, id_usuario) VALUES (?, ?, ?)',
      args: [cleanName, id_equipo ?? null, id_usuario ?? null],
    });
    res.status(201).json({
      id_persona: Number(result.lastInsertRowid),
      nombre: cleanName,
      id_equipo: id_equipo ?? null,
      id_usuario: id_usuario ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, id_equipo, id_usuario } = req.body;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'nombre is required' });
    }

    const cleanName = nombre.trim();
    const result = await db.execute({
      sql: 'UPDATE persona SET nombre = ?, id_equipo = ?, id_usuario = ? WHERE id_persona = ?',
      args: [cleanName, id_equipo ?? null, id_usuario ?? null, req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.json({
      id_persona: Number(req.params.id),
      nombre: cleanName,
      id_equipo: id_equipo ?? null,
      id_usuario: id_usuario ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM persona WHERE id_persona = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
