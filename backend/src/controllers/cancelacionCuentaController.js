import sequelize from '../config/postgres.js';
import Cuenta from '../models/sql/Cuenta.js';
import Usuario from '../models/sql/Usuario.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';
import { BloqueoAntifraudeModel } from '../models/redis/BloqueoAntifraude.js';

const MOTIVOS_PERMITIDOS = [
  'Ya no necesito la cuenta',
  'Comisiones o costos',
  'Problemas con el servicio',
  'Abrí una cuenta en otra institución',
  'Otro motivo',
];

// POST /api/cuentas/cancelar
// La identidad se obtiene de la sesión validada, nunca de datos enviados por el cliente.
export const cancelarCuenta = async (req, res) => {
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  const detalle = typeof req.body?.detalle === 'string'
    ? req.body.detalle.replace(/[<>]/g, '').trim()
    : '';

  if (
    !MOTIVOS_PERMITIDOS.includes(motivo) ||
    !detalle ||
    detalle.length > 500 ||
    req.body?.confirmarIrreversible !== true
  ) {
    return res.status(400).json({
      error: 'Selecciona un motivo, describe tu decisión (máximo 500 caracteres) y confirma que es irreversible.',
    });
  }

  let cuentaCancelada;
  const fecha = new Date();

  try {
    // PostgreSQL: usuario y cuenta se desactivan dentro de una sola transacción.
    await sequelize.transaction(async (transaction) => {
      const usuario = await Usuario.findByPk(req.user.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const cuenta = await Cuenta.findOne({
        where: { idUsuario: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!usuario || !cuenta || usuario.estatus !== 1 || cuenta.estatus !== 1) {
        const error = new Error('La cuenta ya está inactiva o no se encuentra disponible.');
        error.status = 409;
        throw error;
      }

      await usuario.update({ estatus: 0, fechaUpdate: fecha }, { transaction });
      await cuenta.update({ estatus: 0, fechaUpdate: fecha }, { transaction });
      cuentaCancelada = cuenta;
    });

    // MongoDB: se conserva el motivo y se genera el registro de auditoría.
    await ExpedienteKYC.findOneAndUpdate(
      { usuarioId: Number(req.user.id), isDeleted: false },
      {
        $set: {
          'cancelacionCuenta.solicitada': true,
          'cancelacionCuenta.motivo': motivo,
          'cancelacionCuenta.detalle': detalle,
          'cancelacionCuenta.fecha': fecha,
          'cancelacionCuenta.prioridadAtencion': 'ALTA',
          fechaActualizacion: fecha,
          observacionesAdmin: `CANCELACIÓN DE CUENTA — PRIORIDAD ALTA. Motivo: ${motivo}.`,
        },
      },
      { new: true },
    );

    await AuditoriaTransaccion.create({
      cuentaOrigenId: Number(cuentaCancelada.idCuenta),
      cuentaDestinoId: null,
      tipoMovimiento: 'CANCELACION_CUENTA',
      monto: 0,
      estatus: 'EXITOSA',
      fechaCreacion: fecha,
      fechaActualizacion: fecha,
      payloadCompleto: {
        tipo: 'CANCELACION_CUENTA',
        usuarioId: Number(req.user.id),
        motivo,
        detalle,
        prioridadAtencion: 'ALTA',
        fechaCancelacion: fecha,
      },
    });

    // Redis: bloquea la sesión y evita que el JWT actual siga siendo válido.
    await BloqueoAntifraudeModel.save(req.user.id, {
      intentosFallidos: 0,
      bloqueado: true,
      sesionActiva: false,
      tokenJti: '',
      accion: 'CUENTA_CANCELADA',
      motivo: 'Cancelación permanente solicitada por el titular',
      fechaEvento: fecha.toISOString(),
      ipSospechosa: req.ip || '127.0.0.1',
    });

    res.clearCookie('cb_token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(200).json({
      mensaje: 'La cuenta fue cancelada permanentemente.',
      cancelacion: { fecha, prioridadAtencion: 'ALTA' },
    });
  } catch (error) {
    console.error('Error en cancelarCuenta:', error);
    return res.status(error.status || 500).json({
      error: error.status === 409
        ? error.message
        : 'No fue posible completar la cancelación. Si el problema persiste, contacta a administración.',
    });
  }
};
