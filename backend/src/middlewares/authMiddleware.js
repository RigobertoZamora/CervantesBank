import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cervantesbank_clave_jwt_2026';

const leerAntifraudeRedis = async (usuarioId) => {
  const key = `fraude:cuenta:${usuarioId}`;
  const tipo = await redisClient.type(key);
  if (tipo === 'string') {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  if (tipo === 'hash') {
    const hash = await redisClient.hGetAll(key);
    return Object.keys(hash).length ? hash : null;
  }
  return null;
};

export const verificarSesion = async (req, res, next) => {
  try {
    const tokenCookie = req.cookies?.cb_token;
    const authHeader = req.headers.authorization;
    const tokenBearer = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = tokenCookie || tokenBearer;

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado. Inicia sesión para continuar.' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const estadoRedis = await leerAntifraudeRedis(payload.id);

    const estaBloqueado = estadoRedis?.bloqueado === true || estadoRedis?.bloqueado === 'true';
    const sesionValida = estadoRedis?.sesionActiva === true || estadoRedis?.sesionActiva === 'true';

    if (!estadoRedis || estaBloqueado || !sesionValida || estadoRedis.tokenJti !== payload.jti) {
      return res.status(401).json({
        error: 'Tu sesión fue revocada, expiró o la cuenta fue bloqueada por seguridad.',
      });
    }

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
  }
};