import redisClient from '../config/redis.js';
import { BloqueoAntifraudeModel } from '../models/redis/BloqueoAntifraude.js';

const leerKeyRedis = async (key) => {
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

const marcarBorradoLogicoRedis = async (usuarioId, estado) => {
  const key = `fraude:cuenta:${usuarioId}`;
  const tipo = await redisClient.type(key);
  if (tipo === 'string') {
    await redisClient.set(key, JSON.stringify({ ...estado, isDeleted: true }));
  } else if (tipo === 'hash') {
    await redisClient.hSet(key, 'isDeleted', 'true');
  }
};

// GET /api/antifraude -> Lista registros antifraude activos en Redis
export const getAntifraudeTodos = async (req, res) => {
  try {
    const keys =
      Number(req.user.isAdmin) === 1
        ? await redisClient.keys('fraude:cuenta:*')
        : [`fraude:cuenta:${req.user.id}`];

    const registros = [];
    for (const key of keys) {
      const data = await leerKeyRedis(key);
      if (data && data.isDeleted !== true && data.isDeleted !== 'true') {
        registros.push({ usuarioId: key.replace('fraude:cuenta:', ''), ...data });
      }
    }

    res.status(200).json(registros);
  } catch (error) {
    console.error('Error en getAntifraudeTodos:', error);
    res.status(500).json({ error: 'Error al consultar registros antifraude en Redis.' });
  }
};

// GET /api/antifraude/:usuarioId -> Consulta estado antifraude de un usuario
export const getAntifraudeByUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    if (Number(req.user.isAdmin) !== 1 && Number(usuarioId) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const data = await leerKeyRedis(`fraude:cuenta:${usuarioId}`);
    if (!data || data.isDeleted === true || data.isDeleted === 'true') {
      return res.status(404).json({ error: 'Registro antifraude no encontrado o eliminado.' });
    }

    res.status(200).json({ usuarioId: Number(usuarioId), ...data });
  } catch (error) {
    console.error('Error en getAntifraudeByUsuario:', error);
    res.status(500).json({ error: 'Error al consultar Redis.' });
  }
};

// POST /api/antifraude/:usuarioId -> Crea/registra estado antifraude en Redis
export const createAntifraude = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    if (Number(req.user.isAdmin) !== 1 && Number(usuarioId) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const guardado = await BloqueoAntifraudeModel.save(usuarioId, {
      intentosFallidos: Number(req.body.intentosFallidos || 0),
      bloqueado: Boolean(req.body.bloqueado),
      accion: 'REGISTRO_MANUAL',
      motivo:
        typeof req.body.motivo === 'string' && req.body.motivo.trim()
          ? req.body.motivo.replace(/[<>]/g, '').trim()
          : 'Registro antifraude inicializado',
      ipSospechosa: req.ip || '127.0.0.1',
      fechaEvento: new Date().toISOString(),
    });

    res.status(201).json({ mensaje: 'Registro antifraude guardado en Redis.', registro: guardado });
  } catch (error) {
    console.error('Error en createAntifraude:', error);
    res.status(500).json({ error: 'Error al guardar en Redis.' });
  }
};

// PATCH /api/antifraude/:usuarioId -> Actualiza intentos o estado de bloqueo en Redis
export const updateAntifraude = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    if (Number(req.user.isAdmin) !== 1) {
      return res.status(403).json({ error: 'Solo el administrador puede modificar bloqueos.' });
    }

    const previo = await leerKeyRedis(`fraude:cuenta:${usuarioId}`);
    if (!previo || previo.isDeleted === true || previo.isDeleted === 'true') {
      return res.status(404).json({ error: 'Registro antifraude no encontrado.' });
    }

    const actualizado = await BloqueoAntifraudeModel.save(usuarioId, {
      intentosFallidos:
        req.body.intentosFallidos !== undefined
          ? Number(req.body.intentosFallidos)
          : Number(previo.intentosFallidos || 0),
      bloqueado:
        req.body.bloqueado !== undefined
          ? Boolean(req.body.bloqueado)
          : previo.bloqueado === true || previo.bloqueado === 'true',
      accion: 'ACTUALIZACION_ADMIN',
      motivo:
        typeof req.body.motivo === 'string' && req.body.motivo.trim()
          ? req.body.motivo.replace(/[<>]/g, '').trim()
          : previo.motivo || 'Actualizado por administrador',
      ipSospechosa: previo.ipSospechosa || req.ip || '127.0.0.1',
      fechaEvento: new Date().toISOString(),
    });

    res.status(200).json({ mensaje: 'Registro antifraude actualizado en Redis.', registro: actualizado });
  } catch (error) {
    console.error('Error en updateAntifraude:', error);
    res.status(500).json({ error: 'Error al actualizar Redis.' });
  }
};

// DELETE /api/antifraude/:usuarioId -> Borrado lógico en Redis (no usa DEL)
export const deleteAntifraude = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    if (Number(req.user.isAdmin) !== 1) {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar bloqueos.' });
    }

    const previo = await leerKeyRedis(`fraude:cuenta:${usuarioId}`);
    if (!previo || previo.isDeleted === true || previo.isDeleted === 'true') {
      return res.status(404).json({ error: 'Registro antifraude no encontrado o ya eliminado.' });
    }

    const limpiado = await BloqueoAntifraudeModel.save(usuarioId, {
      intentosFallidos: 0,
      bloqueado: false,
      accion: 'ELIMINADO_LOGICO',
      motivo: 'Registro antifraude marcado como eliminado lógicamente',
      fechaEvento: new Date().toISOString(),
    });
    await marcarBorradoLogicoRedis(usuarioId, limpiado);

    res.status(200).json({
      mensaje: `Registro antifraude del usuario #${usuarioId} marcado como borrado lógicamente en Redis.`,
    });
  } catch (error) {
    console.error('Error en deleteAntifraude:', error);
    res.status(500).json({ error: 'Error al ejecutar borrado lógico en Redis.' });
  }
};