import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatarStream, deleteAvatarByUserId } from '../services/cloudinary.js';

const router = Router();
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Solo se permiten imágenes (JPEG, PNG, WebP o GIF).'));
    }
  },
});

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.username, id: user.id_usuario, role: user.rol, avatar_url: user.avatar_url || null },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function createRefreshTokenSession(userId) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: 'INSERT INTO sesion_refresh (id_usuario, token_hash, expira_en, revocado) VALUES (?, ?, ?, 0)',
    args: [userId, tokenHash, expiresAt],
  });

  return { rawToken, expiresAt };
}

function setRefreshTokenCookie(res, rawToken) {
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanUsername = username.trim();

    const existing = await db.execute({
      sql: 'SELECT id_usuario FROM usuario WHERE LOWER(username) = LOWER(?)',
      args: [cleanUsername],
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El nombre de usuario ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await db.execute({
      sql: "INSERT INTO usuario (username, password_hash, rol) VALUES (?, ?, 'user')",
      args: [cleanUsername, passwordHash],
    });

    const newUserId = Number(insertResult.lastInsertRowid);
    const user = { id_usuario: newUserId, username: cleanUsername, rol: 'user' };

    const { rawToken } = await createRefreshTokenSession(newUserId);
    setRefreshTokenCookie(res, rawToken);

    const accessToken = generateAccessToken(user);

    res.status(201).json({
      accessToken,
      token: accessToken,
      user: { id: user.id_usuario, username: user.username, role: user.rol, avatar_url: null },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Credenciales incompletas' });
    }

    let result = await db.execute({
      sql: 'SELECT id_usuario, username, password_hash, rol, avatar_url FROM usuario WHERE LOWER(username) = LOWER(?)',
      args: [username.trim()],
    });

    let user = result.rows[0];

    // Fallback de retrocompatibilidad con tabla admin
    if (!user) {
      const adminResult = await db.execute({
        sql: 'SELECT id_admin, username, password_hash FROM admin WHERE LOWER(username) = LOWER(?)',
        args: [username.trim()],
      });
      const legacyAdmin = adminResult.rows[0];
      if (legacyAdmin) {
        const matchLegacy = await bcrypt.compare(password, legacyAdmin.password_hash);
        if (matchLegacy) {
          // Migrar al usuario moderno
          const migrateResult = await db.execute({
            sql: "INSERT INTO usuario (username, password_hash, rol) VALUES (?, ?, 'admin')",
            args: [legacyAdmin.username, legacyAdmin.password_hash],
          });
          user = {
            id_usuario: Number(migrateResult.lastInsertRowid),
            username: legacyAdmin.username,
            password_hash: legacyAdmin.password_hash,
            rol: 'admin',
            avatar_url: null,
          };
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const { rawToken } = await createRefreshTokenSession(user.id_usuario);
    setRefreshTokenCookie(res, rawToken);

    const accessToken = generateAccessToken(user);

    res.json({
      accessToken,
      token: accessToken,
      user: {
        id: user.id_usuario,
        username: user.username,
        role: user.rol,
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token no proporcionado' });
    }

    const tokenHash = hashToken(rawToken);
    const result = await db.execute({
      sql: `SELECT s.id_sesion, s.expira_en, s.revocado, u.id_usuario, u.username, u.rol, u.avatar_url
            FROM sesion_refresh s
            JOIN usuario u ON s.id_usuario = u.id_usuario
            WHERE s.token_hash = ?`,
      args: [tokenHash],
    });

    const session = result.rows[0];
    if (!session || session.revocado === 1) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ error: 'Sesión inválida o revocada' });
    }

    if (new Date(session.expira_en) <= new Date()) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ error: 'Sesión expirada' });
    }

    const user = {
      id_usuario: session.id_usuario,
      username: session.username,
      rol: session.rol,
      avatar_url: session.avatar_url || null,
    };

    const accessToken = generateAccessToken(user);

    res.json({
      accessToken,
      token: accessToken,
      user: {
        id: user.id_usuario,
        username: user.username,
        role: user.rol,
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await db.execute({
        sql: 'UPDATE sesion_refresh SET revocado = 1 WHERE token_hash = ?',
        args: [tokenHash],
      });
    }

    res.clearCookie('refreshToken', { path: '/' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id_usuario, username, rol, avatar_url FROM usuario WHERE id_usuario = ?',
      args: [req.user.id],
    });
    const u = result.rows[0];
    if (!u) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({
      user: {
        id: u.id_usuario,
        username: u.username,
        role: u.rol,
        avatar_url: u.avatar_url || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo de imagen' });
    }

    const { secure_url } = await uploadAvatarStream(req.file.buffer, req.user.id);

    await db.execute({
      sql: 'UPDATE usuario SET avatar_url = ? WHERE id_usuario = ?',
      args: [secure_url, req.user.id],
    });

    res.json({
      message: 'Avatar actualizado correctamente',
      avatar_url: secure_url,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        avatar_url: secure_url,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/avatar', requireAuth, async (req, res, next) => {
  try {
    await deleteAvatarByUserId(req.user.id);

    await db.execute({
      sql: 'UPDATE usuario SET avatar_url = NULL WHERE id_usuario = ?',
      args: [req.user.id],
    });

    res.json({
      message: 'Avatar eliminado correctamente',
      avatar_url: null,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        avatar_url: null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
