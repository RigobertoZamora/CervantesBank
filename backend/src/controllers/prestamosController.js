import sequelize from '../config/postgres.js';
import Cuenta from '../models/sql/Cuenta.js';
import Prestamo from '../models/sql/Prestamo.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';
import { calcularRangoCreditoYPerfil, leerAntifraudeRedis } from '../services/creditoService.js';

// GET /api/prestamos/evaluacion -> Rango calculado + préstamos otorgados (SQL) + solicitudes/apelaciones (Mongo)
export const getEvaluacionYHistorial = async (req, res) => {
  try {
    const idUsuario = Number(req.user.id);
    const cuenta = await Cuenta.findOne({ where: { idUsuario } });
    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta bancaria no encontrada.' });
    }

    const idCuenta = Number(cuenta.idCuenta);
    const expedienteKYC = await ExpedienteKYC.findOne({ usuarioId: idUsuario, isDeleted: false });
    const antifraude = await leerAntifraudeRedis(idUsuario);

    const prestamosSQL = await Prestamo.findAll({
      where: { idCuenta },
      order: [['idPrestamo', 'DESC']],
    });

    const solicitudesMongo = await AuditoriaTransaccion.find({
      cuentaOrigenId: idCuenta,
      tipoMovimiento: { $in: ['SOLICITUD_PRESTAMO', 'INGRESO_PRESTAMO'] },
    }).sort({ createdAt: -1 });

    const evaluacion = calcularRangoCreditoYPerfil({
      cuenta,
      expedienteKYC,
      antifraude,
      prestamos: prestamosSQL,
    });

    res.status(200).json({
      evaluacion,
      prestamosOtorgados: evaluacion.prestamosConMora,
      bitacoraSolicitudes: solicitudesMongo,
    });
  } catch (error) {
    console.error('Error en getEvaluacionYHistorial:', error);
    res.status(500).json({ error: 'Error al evaluar capacidad crediticia.' });
  }
};

// POST /api/prestamos/solicitar -> Aprobación automática en SQL + Mongo, o rechazo apelable en Mongo
export const solicitarPrestamo = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const idUsuario = Number(req.user.id);
    const montoSolicitado = Number(req.body.montoSolicitado);
    const plazoMeses = [3, 6, 12, 18, 24].includes(Number(req.body.plazoMeses))
      ? Number(req.body.plazoMeses)
      : 12;
    const motivoSolicitud =
      typeof req.body.motivoSolicitud === 'string'
        ? req.body.motivoSolicitud.replace(/[<>]/g, '').trim().slice(0, 250)
        : '';

    if (motivoSolicitud.length < 5) {
      await t.rollback();
      return res.status(400).json({ error: 'Indica el motivo de tu solicitud (mínimo 5 caracteres).' });
    }

    if (!montoSolicitado || montoSolicitado < 500) {
      await t.rollback();
      return res.status(400).json({ error: 'El monto mínimo de solicitud es de $500.00 MXN.' });
    }

    const cuenta = await Cuenta.findOne({ where: { idUsuario }, transaction: t });
    if (!cuenta || cuenta.estatus !== 1) {
      await t.rollback();
      return res.status(403).json({ error: 'Tu cuenta no está activa para solicitar préstamos.' });
    }

    const idCuenta = Number(cuenta.idCuenta);
    const expedienteKYC = await ExpedienteKYC.findOne({ usuarioId: idUsuario, isDeleted: false });
    const antifraude = await leerAntifraudeRedis(idUsuario);
    const prestamosPrevios = await Prestamo.findAll({ where: { idCuenta }, transaction: t });

    const evaluacion = calcularRangoCreditoYPerfil({
      cuenta,
      expedienteKYC,
      antifraude,
      prestamos: prestamosPrevios,
    });

    const entraEnRango =
      evaluacion.elegibleAutomatico && montoSolicitado <= evaluacion.montoMaximoPermitido;

    const fechaInicio = new Date();
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + plazoMeses);
    const tasaInteresMensual = 2.5; // 2.5% mensual

    if (entraEnRango) {
      // 1. Insertar préstamo real en PostgreSQL
      const nuevoPrestamo = await Prestamo.create(
        {
          idCuenta,
          montoOtorgado: montoSolicitado,
          saldoPendiente: montoSolicitado,
          fechaInicio,
          fechaVencimiento,
          fechaUltimoPago: null,
          tasaInteresMensual,
          estatus: 1,
          isDeleted: false,
        },
        { transaction: t }
      );

      // 2. Abonar el monto a la cuenta de débito
      const nuevoSaldo = Number(cuenta.saldo) + montoSolicitado;
      await cuenta.update({ saldo: nuevoSaldo, fechaUpdate: new Date() }, { transaction: t });
      await t.commit();

      // 3. Registrar ingreso aprobado en AuditoriaTransaccion (MongoDB)
      const auditoria = await AuditoriaTransaccion.create({
        cuentaOrigenId: idCuenta,
        cuentaDestinoId: idCuenta,
        tipoMovimiento: 'INGRESO_PRESTAMO',
        monto: montoSolicitado,
        estatus: 'EXITOSA',
        payloadCompleto: {
          usuarioId: idUsuario,
          idPrestamoSQL: Number(nuevoPrestamo.idPrestamo),
          plazoMeses,
          tasaInteresMensual,
          rangoMaximoCalculado: evaluacion.montoMaximoPermitido,
          motivoSolicitud,
          origenAprobacion: 'AUTOMATICA',
        },
      });

      return res.status(201).json({
        aprobadoAutomaticamente: true,
        mensaje: `¡Préstamo aprobado automáticamente por $${montoSolicitado.toFixed(2)} MXN y depositado en tu cuenta!`,
        prestamo: nuevoPrestamo,
        auditoria,
        nuevoSaldoCuenta: nuevoSaldo,
        evaluacion,
      });
    }

    // Fuera de rango: NO se inserta en PostgreSQL; se registra en MongoDB para permitir apelación
    await t.commit();

    const auditoriaRechazo = await AuditoriaTransaccion.create({
      cuentaOrigenId: idCuenta,
      cuentaDestinoId: null,
      tipoMovimiento: 'SOLICITUD_PRESTAMO',
      monto: montoSolicitado,
      estatus: 'RECHAZADA',
      payloadCompleto: {
        usuarioId: idUsuario,
        plazoMeses,
        tasaInteresMensual,
        rangoMaximoCalculado: evaluacion.montoMaximoPermitido,
        motivoSolicitud,
        motivoRechazo: `Monto solicitado ($${montoSolicitado.toFixed(2)}) excede el rango calculado ($${evaluacion.montoMaximoPermitido.toFixed(2)} MXN). ${evaluacion.motivoRegla}`,
      },
    });

    return res.status(200).json({
      aprobadoAutomaticamente: false,
      mensaje: `Solicitud rechazada automáticamente: excede tu rango actual ($${evaluacion.montoMaximoPermitido.toFixed(2)} MXN). Puedes apelar esta decisión al banco.`,
      auditoria: auditoriaRechazo,
      evaluacion,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error('Error en solicitarPrestamo:', error);
    res.status(500).json({ error: 'Error interno al procesar la solicitud de préstamo.' });
  }
};

// PATCH /api/prestamos/:auditoriaId/apelar -> Cambia estatus a EN_APELACION en MongoDB
export const apelarPrestamo = async (req, res) => {
  try {
    const idUsuario = Number(req.user.id);
    const { auditoriaId } = req.params;
    const motivoApelacion =
      typeof req.body.motivoApelacion === 'string'
        ? req.body.motivoApelacion.replace(/[<>]/g, '').trim().slice(0, 480)
        : '';

    if (motivoApelacion.length < 10) {
      return res.status(400).json({
        error: 'Describe el motivo de tu apelación (mínimo 10 caracteres).',
      });
    }

    const cuenta = await Cuenta.findOne({ where: { idUsuario } });
    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta bancaria no encontrada.' });
    }

    const documento = await AuditoriaTransaccion.findOne({
      _id: auditoriaId,
      cuentaOrigenId: Number(cuenta.idCuenta),
      tipoMovimiento: 'SOLICITUD_PRESTAMO',
    });

    if (!documento) {
      return res.status(404).json({ error: 'Solicitud de préstamo no encontrada.' });
    }

    if (documento.estatus !== 'RECHAZADA' || documento.payloadCompleto?.resolucionAdmin) {
      return res.status(400).json({
        error: 'Esta solicitud ya fue apelada o cuenta con un dictamen definitivo del administrador.',
      });
    }

    documento.estatus = 'EN_APELACION';
    documento.fechaActualizacion = new Date();
    documento.payloadCompleto = {
      ...documento.payloadCompleto,
      apelacion: {
        motivoCliente: motivoApelacion,
        fechaApelacion: new Date().toISOString(),
      },
    };
    documento.markModified('payloadCompleto');
    await documento.save();

    res.status(200).json({
      mensaje: 'Apelación enviada como prioridad al panel del Administrador.',
      auditoria: documento,
    });
  } catch (error) {
    console.error('Error en apelarPrestamo:', error);
    res.status(500).json({ error: 'Error al registrar la apelación.' });
  }
};