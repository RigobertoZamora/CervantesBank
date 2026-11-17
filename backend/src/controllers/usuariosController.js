import sequelize from '../config/postgres.js';
import Usuario from '../models/sql/Usuario.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import Cuenta from '../models/sql/Cuenta.js';
import { BloqueoAntifraudeModel } from '../models/redis/BloqueoAntifraude.js';

// Genera una CLABE simulada de 18 dígitos (ej. prefijo STP/Neobanco 646 + 15 dígitos)
const generarClabe = () => {
  const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
  return `646180${random12}`;
};

// GET /api/usuarios -> Lista todos los usuarios activos (defaultScope filtra isDeleted: false)
export const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      order: [['id', 'ASC']],
    });
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios', detalle: error.message });
  }
};

// GET /api/usuarios/:id -> Obtiene un usuario específico por su ID
export const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o eliminado' });
    }

    res.status(200).json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar el usuario', detalle: error.message });
  }
};

// POST /api/usuarios -> Onboarding políglota atómico (SQL Usuario + SQL Cuenta + Mongo + Redis)
export const createUsuario = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      nombre,
      apellidoUno,
      apellidoDos,
      rfc,
      email,
      metadatosIdentificacion,
      historialDomicilios,
    } = req.body;

    if (!nombre || !apellidoUno || !rfc || !email) {
      await t.rollback();
      return res.status(400).json({
        error: 'Campos obligatorios faltantes: nombre, apellidoUno, rfc y email.',
      });
    }

    // 1. Transacción Relacional (PostgreSQL): Usuario + Cuenta inicial en $0.00
    const nuevoUsuario = await Usuario.create(
      {
        nombre,
        apellidoUno,
        apellidoDos: apellidoDos || null,
        rfc: rfc.toUpperCase(),
        email: email.toLowerCase(),
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

    // 2. Persistencia Documental (MongoDB): Expediente pendiente para el panel del Admin
    const nuevoExpediente = await ExpedienteKYC.create({
      usuarioId: Number(nuevoUsuario.id),
      estatusValidacion: 'PENDIENTE',
      observacionesAdmin: 'Registro nuevo: pendiente de revisión en panel Gestionar Cuentas.',
      metadatosIdentificacion: metadatosIdentificacion || {
        tipoDocumento: 'INE',
        estatusCarga: 'Pendiente de adjuntar',
      },
      historialDomicilios: historialDomicilios || [],
      isDeleted: false,
    });

    // 3. Persistencia Clave-Valor (Redis): Monitoreo antifraude limpio
    const seguridadInicial = await BloqueoAntifraudeModel.save(nuevoUsuario.id, {
      intentosFallidos: 0,
      bloqueado: false,
      motivo: 'Cuenta recién creada - Sin incidentes',
      ipSospechosa: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      mensaje: 'Usuario y cuenta bancaria inicializados correctamente.',
      usuario: nuevoUsuario,
      cuentaInicial,
      notificacionAdminKYC: nuevoExpediente,
      estadoAntifraude: seguridadInicial,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El RFC o el correo electrónico ya están registrados.' });
    }
    res.status(500).json({ error: 'Error al registrar usuario', detalle: error.message });
  }
};

// PATCH /api/usuarios/:id -> Actualización parcial de datos del usuario
export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o eliminado' });
    }

    // Evitamos que PATCH modifique el id o salte el flujo de DELETE lógico
    const { id: _id, isDeleted: _isDeleted, ...camposActualizables } = req.body;

    await usuario.update(camposActualizables);

    res.status(200).json({
      mensaje: 'Datos de usuario actualizados correctamente.',
      usuario,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario', detalle: error.message });
  }
};

// DELETE /api/usuarios/:id -> Borrado lógico (Soft Delete) sin destruir el registro físico
export const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado o ya fue eliminado' });
    }
    // Desactivación de la cuenta bancaria asociada y del usuario en SQL
    await Cuenta.update({ isDeleted: true, estatus: 0 }, { where: { idUsuario: id } });
    // Mutación lógica en SQL
    await usuario.update({ isDeleted: true, estatus: 0 });

    // Mutación lógica consistente en MongoDB para su expediente KYC
    await ExpedienteKYC.updateMany({ usuarioId: Number(id) }, { isDeleted: true });

    res.status(200).json({
      mensaje: `Usuario con ID ${id} marcado como borrado lógico (isDeleted: true).`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al ejecutar borrado lógico', detalle: error.message });
  }
};