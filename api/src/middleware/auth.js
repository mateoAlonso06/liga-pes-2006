import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.sub,
      role: decoded.role || 'user',
      avatar_url: decoded.avatar_url || null,
    };
    req.admin = req.user; // backwards compatibility
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  });
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.id,
        username: decoded.sub,
        role: decoded.role || 'user',
      };
      req.admin = req.user;
    } catch {
      // Ignore token error in optional auth
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

export async function canManageTournament(user, idTorneo, dbInstance) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!idTorneo) return false;

  const result = await dbInstance.execute({
    sql: 'SELECT id_organizador FROM torneo WHERE id_torneo = ?',
    args: [idTorneo],
  });

  if (result.rows.length === 0) return false;
  return Number(result.rows[0].id_organizador) === Number(user.id);
}
