import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import Usuario from '../models/sql/Usuario.js';
import Cuenta from '../models/sql/Cuenta.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import redisClient from '../config/redis.js';
import { BloqueoAntifraudeModel } from '../models/redis/BloqueoAntifraude.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cervantesbank_clave_jwt_2026';
const MAX_INTENTOS = 3;

// Helper compatible tanto si Redis guarda JSON string (GET) o Hash (HGETALL)
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

// POST /api/auth/login -> Autenticación + Monitoreo de sesión en Redis + Consulta KYC
export const loginUsuario = async (req, res) => {
  try {
    const identificador = typeof req.body.identificador === 'string'
      ? req.body.identificador.replace(/[<>]/g, '').trim()
      : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!identificador || !password) {
      return res.status(400).json({
        error: 'Ingresa tu correo electrónico (o RFC) y tu contraseña.',
      });
    }

    // 1. Buscar usuario activo en PostgreSQL por correo o RFC
    const usuario = await Usuario.scope('conPassword').findOne({
      where: {
        [Op.or]: [
          { email: identificador.toLowerCase() },
          { rfc: identificador.toUpperCase() },
        ],
      },
    });

    if (!usuario || !usuario.password) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (usuario.estatus !== 1) {
      return res.status(403).json({ error: 'La cuenta se encuentra suspendida o inactiva.' });
    }

    const datosSesion = {
      ipSospechosa: req.ip || req.socket?.remoteAddress || '127.0.0.1',
      dispositivo: (req.headers['user-agent'] || 'Desconocido').slice(0, 120),
      fechaEvento: new Date().toISOString(),
    };

    // 2. Consultar en Redis si la cuenta ya está bloqueada (ahora que ya tenemos usuario.id)
    const estadoPrevio = await leerAntifraudeRedis(usuario.id);
    const estaBloqueado = estadoPrevio?.bloqueado === true || estadoPrevio?.bloqueado === 'true';

    if (estaBloqueado) {
      return res.status(423).json({
        error: 'Acceso bloqueado temporalmente por seguridad ante múltiples intentos fallidos.',
        antifraude: estadoPrevio,
      });
    }

    // 3. Validar contraseña hasheada
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      const intentosPrevios = Number(estadoPrevio?.intentosFallidos) || 0;
      const intentosAcumulados = intentosPrevios + 1;
      const debeBloquearse = intentosAcumulados >= MAX_INTENTOS;
      const teniaSesionActiva =
        estadoPrevio?.sesionActiva === true || estadoPrevio?.sesionActiva === 'true';

      const registroFallo = await BloqueoAntifraudeModel.save(usuario.id, {
        intentosFallidos: intentosAcumulados,
        bloqueado: debeBloquearse,
        // Si llega al 3er fallo, borra el jti y mata la sesión abierta; si no, conserva la sesión vigente
        tokenJti: debeBloquearse ? '' : (estadoPrevio?.tokenJti || ''),
        sesionActiva: debeBloquearse ? false : teniaSesionActiva,
        accion: 'LOGIN_FALLIDO',
        motivo: debeBloquearse
          ? `Bloqueo preventivo tras ${MAX_INTENTOS} intentos fallidos`
          : `Contraseña incorrecta (intento ${intentosAcumulados} de ${MAX_INTENTOS})`,
        ...datosSesion,
      });

      return res.status(debeBloquearse ? 423 : 401).json({
        error: debeBloquearse
          ? 'Cuenta bloqueada por seguridad tras 3 intentos fallidos.'
          : `Credenciales inválidas. Te quedan ${MAX_INTENTOS - intentosAcumulados} intento(s).`,
        antifraude: registroFallo,
      });
    }

    // 4. Login exitoso: generar identificador único de sesión (jti) y guardarlo en Redis
    const jti = crypto.randomUUID();

    const registroExito = await BloqueoAntifraudeModel.save(usuario.id, {
      intentosFallidos: 0,
      bloqueado: false,
      tokenJti: jti,
      sesionActiva: true,
      accion: 'LOGIN_EXITOSO',
      motivo: 'Inicio de sesión verificado correctamente',
      ...datosSesion,
    });

    // 5. Consultar cuenta bancaria (SQL) y estatus documental KYC (MongoDB)
    const cuenta = await Cuenta.findOne({ where: { idUsuario: usuario.id } });
    const expediente = await ExpedienteKYC.findOne({
      usuarioId: Number(usuario.id),
      isDeleted: false,
    });

    // 6. Emitir JWT vinculado al jti de Redis en cookie HttpOnly
    const token = jwt.sign(
      { id: Number(usuario.id), email: usuario.email, jti },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('cb_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidoUno: usuario.apellidoUno,
        apellidoDos: usuario.apellidoDos,
        rfc: usuario.rfc,
        email: usuario.email,
      },
      cuenta: cuenta
        ? {
            idCuenta: cuenta.idCuenta,
            clabeInterbancaria: cuenta.clabeInterbancaria,
            saldo: cuenta.saldo,
          }
        : null,
      expedienteKYC: {
        estatusValidacion: expediente?.estatusValidacion || 'PENDIENTE',
        observacionesAdmin: expediente?.observacionesAdmin || '',
      },
      sesionAntifraude: registroExito,
    });
  } catch (error) {
    console.error('Error en loginUsuario:', error);
    res.status(500).json({ error: 'Error interno al procesar el inicio de sesión.' });
  }
};

// GET /api/auth/me -> Devuelve el contexto completo del cliente autenticado
export const getPerfilAutenticado = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const cuenta = await Cuenta.findOne({ where: { idUsuario: usuario.id } });
    const expediente = await ExpedienteKYC.findOne({
      usuarioId: Number(usuario.id),
      isDeleted: false,
    });
    const sesionAntifraude = await leerAntifraudeRedis(usuario.id);

    res.status(200).json({
      usuario,
      cuenta,
      expedienteKYC: expediente,
      sesionAntifraude,
    });
  } catch (error) {
    console.error('Error en getPerfilAutenticado:', error);
    res.status(500).json({ error: 'Error interno al verificar la sesión.' });
  }
};
    
// POST /api/auth/logout -> Revoca la sesión en Redis y limpia la cookie HttpOnly
export const logoutUsuario = async (req, res) => {
  try {
    if (req.user?.id) {
      await BloqueoAntifraudeModel.save(req.user.id, {
        intentosFallidos: 0,
        bloqueado: false,
        sesionActiva: false,
        tokenJti: '',
        accion: 'LOGOUT',
        motivo: 'Sesión cerrada explícitamente por el usuario',
        fechaEvento: new Date().toISOString(),
      });
    }

    res.clearCookie('cb_token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(200).json({ mensaje: 'Sesión revocada y cerrada correctamente.' });
  } catch (error) {
    console.error('Error en logoutUsuario:', error);
    res.status(500).json({ error: 'Error interno al cerrar sesión.' });
  }
};