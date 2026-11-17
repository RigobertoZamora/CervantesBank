import sequelize from '../config/postgres.js';
import Usuario from '../models/sql/Usuario.js';
import Cuenta from '../models/sql/Cuenta.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import { BloqueoAntifraudeModel } from '../models/redis/BloqueoAntifraude.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize'

// Expresiones regulares de validación (Punto 14)
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sanitización básica contra XSS almacenado (Punto 15)
const sanitizarTexto = (valor) => {
  if (typeof valor !== 'string') return '';
  return valor.replace(/[<>]/g, '').trim();
};

const generarClabe = () => {
  const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
  return `646180${random12}`;
};

// GET /api/usuarios -> Devuelve solo campos necesarios (Punto 7 y 17)
export const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: ['id', 'nombre', 'apellidoUno', 'apellidoDos', 'email', 'estatus', 'fechaCreacion'],
      order: [['id', 'ASC']],
    });
    res.status(200).json(usuarios);
  } catch (error) {
    console.error('Error en getUsuarios:', error);
    res.status(500).json({ error: 'Error interno al consultar usuarios.' });
  }
};

// GET /api/usuarios/:id -> Devuelve perfil sin exponer banderas internas (Punto 17)
export const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'El identificador de usuario debe ser numérico.' });
    }

    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['isDeleted'] },
    });

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o eliminado' });
    }

    res.status(200).json(usuario);
  } catch (error) {
    console.error('Error en getUsuarioById:', error);
    res.status(500).json({ error: 'Error interno al buscar el usuario.' });
  }
};

// POST /api/usuarios -> Validación, sanitización y creación políglota atómica
export const createUsuario = async (req, res) => {
  const t = await sequelize.transaction();
  // Busca incluso entre cuentas eliminadas lógicamente (ignora defaultScope)
  const registroExistente = await Usuario.unscoped().findOne({
    where: {
      [Op.or]: [{ rfc }, { email }],
    },
  });

  if (registroExistente) {
    await t.rollback();
    if (registroExistente.isDeleted || registroExistente.estatus === 0) {
      return res.status(403).json({
        error: 'Este RFC o correo pertenece a una cuenta cancelada o suspendida. Comunícate con administración para solicitar su reactivación.',
      });
    }
    return res.status(409).json({
      error: 'El RFC o el correo electrónico ya están registrados.',
    });
  }
  try {
    // Sanitización de entradas (Punto 15)
    const nombre = sanitizarTexto(req.body.nombre);
    const apellidoUno = sanitizarTexto(req.body.apellidoUno);
    const apellidoDos = sanitizarTexto(req.body.apellidoDos);
    const rfc = sanitizarTexto(req.body.rfc).toUpperCase();
    const email = sanitizarTexto(req.body.email).toLowerCase();

    // Validación estricta de inputs (Punto 14)
    if (!nombre || !apellidoUno || !rfc || !email) {
      await t.rollback();
      return res.status(400).json({
        error: 'Campos obligatorios faltantes: nombre, apellidoUno, rfc y email.',
      });
    }

    if (nombre.length > 50 || apellidoUno.length > 50 || apellidoDos.length > 50) {
      await t.rollback();
      return res.status(400).json({ error: 'Nombre o apellidos exceden el límite de 50 caracteres.' });
    }

    if (!RFC_REGEX.test(rfc)) {
      await t.rollback();
      return res.status(400).json({ error: 'El formato del RFC no es válido.' });
    }

    if (!EMAIL_REGEX.test(email) || email.length > 50) {
      await t.rollback();
      return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
    }

    const tipoDoc = req.body.metadatosIdentificacion?.tipoDocumento === 'PASAPORTE' ? 'PASAPORTE' : 'INE';
    const numDoc = sanitizarTexto(req.body.metadatosIdentificacion?.numeroDocumento) || 'PENDIENTE_FOLIO';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!nombre || !apellidoUno || !rfc || !email || !password) {
      await t.rollback();
      return res.status(400).json({
        error: 'Campos obligatorios faltantes: nombre, apellidoUno, rfc, email y password.',
      });
    }

    if (password.length < 8) {
      await t.rollback();
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // 1. Transacción Relacional (PostgreSQL) con valores controlados por el servidor (Punto 8)
    const nuevoUsuario = await Usuario.create(
      {
        nombre,
        apellidoUno,
        apellidoDos: apellidoDos || null,
        rfc,
        email,
        password: passwordHash,
        estatus: 1,
        isDeleted: false,
      },
      { transaction: t }
    );

    const cuentaInicial = await Cuenta.create(
      {
        idUsuario: nuevoUsuario.id,
        saldo: 0.0,
        clabeInterbancaria: generarClabe(),
        estatus: 1,
        isDeleted: false,
      },
      { transaction: t }
    );

    await t.commit();

    // 2. Persistencia Documental (MongoDB)
    const nuevoExpediente = await ExpedienteKYC.create({
      usuarioId: Number(nuevoUsuario.id),
      estatusValidacion: 'PENDIENTE',
      observacionesAdmin: 'Registro nuevo: pendiente de revisión en panel Gestionar Cuentas.',
      metadatosIdentificacion: {
        tipoDocumento: tipoDoc,
        numeroDocumento: numDoc.slice(0, 30),
      },
      historialDomicilios: [],
      isDeleted: false,
    });

    // 3. Persistencia Clave-Valor (Redis)
    const seguridadInicial = await BloqueoAntifraudeModel.save(nuevoUsuario.id, {
      intentosFallidos: 0,
      bloqueado: false,
      motivo: 'Cuenta recién creada - Sin incidentes',
      ipSospechosa: req.ip || '127.0.0.1',
    });

    // Respuesta minimizada sin campos internos (Punto 17)
    res.status(201).json({
      mensaje: 'Usuario y cuenta bancaria inicializados correctamente.',
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        apellidoUno: nuevoUsuario.apellidoUno,
        apellidoDos: nuevoUsuario.apellidoDos,
        rfc: nuevoUsuario.rfc,
        email: nuevoUsuario.email,
        estatus: nuevoUsuario.estatus,
      },
      cuentaInicial: {
        idCuenta: cuentaInicial.idCuenta,
        clabeInterbancaria: cuentaInicial.clabeInterbancaria,
        saldo: cuentaInicial.saldo,
      },
      notificacionAdminKYC: {
        estatusValidacion: nuevoExpediente.estatusValidacion,
        observacionesAdmin: nuevoExpediente.observacionesAdmin,
      },
      estadoAntifraude: {
        bloqueado: seguridadInicial.bloqueado,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El RFC o el correo electrónico ya están registrados.' });
    }
    console.error('Error en createUsuario:', error);
    res.status(500).json({ error: 'Error interno al registrar el usuario.' });
  }
};

// PATCH /api/usuarios/:id -> Allowlist estricta contra Mass Assignment (Punto 8)
export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o eliminado' });
    }

    // Solo permitimos editar nombre, apellidos y email (bloquea id, rfc, estatus, isDeleted)
    const actualizacionesPermitidas = {};
    if (req.body.nombre !== undefined) actualizacionesPermitidas.nombre = sanitizarTexto(req.body.nombre);
    if (req.body.apellidoUno !== undefined) actualizacionesPermitidas.apellidoUno = sanitizarTexto(req.body.apellidoUno);
    if (req.body.apellidoDos !== undefined) actualizacionesPermitidas.apellidoDos = sanitizarTexto(req.body.apellidoDos) || null;
    if (req.body.email !== undefined) {
      const emailLimpio = sanitizarTexto(req.body.email).toLowerCase();
      if (!EMAIL_REGEX.test(emailLimpio)) {
        return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
      }
      actualizacionesPermitidas.email = emailLimpio;
    }

    actualizacionesPermitidas.fechaUpdate = new Date();
    await usuario.update(actualizacionesPermitidas);

    res.status(200).json({
      mensaje: 'Datos de usuario actualizados correctamente.',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidoUno: usuario.apellidoUno,
        apellidoDos: usuario.apellidoDos,
        email: usuario.email,
      },
    });
  } catch (error) {
    console.error('Error en updateUsuario:', error);
    res.status(500).json({ error: 'Error interno al actualizar usuario.' });
  }
};

// DELETE /api/usuarios/:id -> Borrado lógico en cascada
export const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o ya fue eliminado' });
    }

    await Cuenta.update(
      { isDeleted: true, estatus: 0, fechaUpdate: new Date() },
      { where: { idUsuario: id } }
    );
    await usuario.update({ isDeleted: true, estatus: 0, fechaUpdate: new Date() });
    await ExpedienteKYC.updateMany({ usuarioId: Number(id) }, { isDeleted: true });

    res.status(200).json({
      mensaje: `Usuario con ID ${id} marcado como borrado lógico.`,
    });
  } catch (error) {
    console.error('Error en deleteUsuario:', error);
    res.status(500).json({ error: 'Error interno al ejecutar borrado lógico.' });
  }
};