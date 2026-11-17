import sequelize from '../config/postgres.js';
import Usuario from '../models/sql/Usuario.js';
import Cuenta from '../models/sql/Cuenta.js';
import Prestamo from '../models/sql/Prestamo.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';
import { BloqueoAntifraudeModel } from '../models/redis/BloqueoAntifraude.js';
import { calcularRangoCreditoYPerfil, leerAntifraudeRedis } from '../services/creditoService.js';

// GET /api/admin/resumen-poliglota -> Consolida las 3 tarjetas + apelaciones prioritarias + ranking
export const getResumenPoliglota = async (req, res) => {
  try {
    const clientesSQL = await Usuario.findAll({
      where: { isAdmin: 0 },
      order: [['id', 'ASC']],
    });
    const cuentasSQL = await Cuenta.findAll();
    const prestamosSQL = await Prestamo.findAll({ order: [['idPrestamo', 'DESC']] });
    const expedientesMongo = await ExpedienteKYC.find({ isDeleted: false });

    // Cola prioritaria leída directamente de MongoDB sin booleanos redundantes
    const apelacionesMongo = await AuditoriaTransaccion.find({
      tipoMovimiento: 'SOLICITUD_PRESTAMO',
      estatus: 'EN_APELACION',
    }).sort({ createdAt: 1 });

    const mapaCuentasPorUsuario = new Map(cuentasSQL.map((c) => [Number(c.idUsuario), c]));
    const mapaCuentasPorId = new Map(cuentasSQL.map((c) => [Number(c.idCuenta), c]));
    const mapaUsuarios = new Map(clientesSQL.map((u) => [Number(u.id), u]));
    const mapaKyc = new Map(expedientesMongo.map((k) => [Number(k.usuarioId), k]));

    const clientesConsolidados = await Promise.all(
      clientesSQL.map(async (u) => {
        const uid = Number(u.id);
        const cuenta = mapaCuentasPorUsuario.get(uid) || null;
        const idCuenta = cuenta ? Number(cuenta.idCuenta) : null;
        const kyc = mapaKyc.get(uid) || null;
        const antifraude = await leerAntifraudeRedis(uid);
        const prestamosCliente = idCuenta
          ? prestamosSQL.filter((p) => Number(p.idCuenta) === idCuenta)
          : [];

        const analisisCredito = calcularRangoCreditoYPerfil({
          cuenta,
          expedienteKYC: kyc,
          antifraude,
          prestamos: prestamosCliente,
        });

        return {
          usuario: {
            id: uid,
            nombre: u.nombre,
            apellidoUno: u.apellidoUno,
            apellidoDos: u.apellidoDos,
            rfc: u.rfc,
            email: u.email,
            estatus: u.estatus,
          },
          cuenta: cuenta
            ? {
                idCuenta,
                clabeInterbancaria: cuenta.clabeInterbancaria,
                saldo: Number(cuenta.saldo),
                estatus: cuenta.estatus,
              }
            : null,
          kyc: {
            estatusValidacion: kyc?.estatusValidacion || 'PENDIENTE',
            observacionesAdmin: kyc?.observacionesAdmin || '',
            tipoDocumento: kyc?.metadatosIdentificacion?.tipoDocumento || 'INE',
            numeroDocumento: kyc?.metadatosIdentificacion?.numeroDocumento || 'N/A',
          },
          antifraude: {
            bloqueado: antifraude?.bloqueado === true || antifraude?.bloqueado === 'true',
            intentosFallidos: Number(antifraude?.intentosFallidos || 0),
            motivo: antifraude?.motivo || 'Sin incidentes',
          },
          prestamos: analisisCredito.prestamosConMora,
          analisisCredito,
        };
      })
    );

    const apelacionesPrioritarias = apelacionesMongo.map((doc) => {
      const cuenta = mapaCuentasPorId.get(Number(doc.cuentaOrigenId));
      const usuario = cuenta ? mapaUsuarios.get(Number(cuenta.idUsuario)) : null;
      return {
        _id: doc._id,
        cuentaOrigenId: doc.cuentaOrigenId,
        monto: doc.monto,
        estatus: doc.estatus,
        createdAt: doc.createdAt,
        payloadCompleto: doc.payloadCompleto,
        clienteNombre: usuario
          ? `${usuario.nombre} ${usuario.apellidoUno} (${usuario.rfc})`
          : `Cuenta #${doc.cuentaOrigenId}`,
      };
    });

    const mejoresRendimiento = clientesConsolidados
      .filter((c) => c.analisisCredito.clasificacionAdmin === 'MEJOR_RENDIMIENTO')
      .sort((a, b) => b.analisisCredito.score - a.analisisCredito.score);

    const peoresMorosos = clientesConsolidados
      .filter((c) => c.analisisCredito.clasificacionAdmin === 'PEOR_MOROSO')
      .sort((a, b) => a.analisisCredito.score - b.analisisCredito.score);

    res.status(200).json({
      kpis: {
        totalClientes: clientesConsolidados.length,
        kycPendientes: clientesConsolidados.filter((c) => c.kyc.estatusValidacion === 'PENDIENTE').length,
        apelacionesPendientes: apelacionesPrioritarias.length,
        totalMejoresRendimiento: mejoresRendimiento.length,
        totalPeoresMorosos: peoresMorosos.length,
      },
      apelacionesPrioritarias,
      clientes: clientesConsolidados,
      mejoresRendimiento,
      peoresMorosos,
    });
  } catch (error) {
    console.error('Error en getResumenPoliglota:', error);
    res.status(500).json({ error: 'Error al consolidar el panel administrativo.' });
  }
};

// PATCH /api/admin/kyc/:usuarioId -> Validar documentación KYC (MongoDB)
export const dictaminarKYC = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { estatusValidacion, observacionesAdmin } = req.body;

    if (!['APROBADO', 'RECHAZADO', 'PENDIENTE'].includes(estatusValidacion)) {
      return res.status(400).json({ error: 'Estatus KYC inválido.' });
    }

    const expediente = await ExpedienteKYC.findOneAndUpdate(
      { usuarioId: Number(usuarioId), isDeleted: false },
      {
        estatusValidacion,
        observacionesAdmin:
          typeof observacionesAdmin === 'string' && observacionesAdmin.trim()
            ? observacionesAdmin.replace(/[<>]/g, '').trim()
            : `Dictamen administrativo: ${estatusValidacion}`,
      },
      { new: true }
    );

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente KYC no encontrado.' });
    }

    res.status(200).json({ mensaje: `KYC actualizado a ${estatusValidacion}.`, expediente });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar KYC.' });
  }
};

// PATCH /api/admin/cuentas/:usuarioId/estado -> Gestionar Cuentas (PostgreSQL + Redis)
export const gestionarEstadoCuenta = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { accion } = req.body;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario || Number(usuario.isAdmin) === 1) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    if (accion === 'SUSPENDER') {
      await usuario.update({ estatus: 0, fechaUpdate: new Date() });
      await Cuenta.update({ estatus: 0, fechaUpdate: new Date() }, { where: { idUsuario: usuarioId } });
      return res.status(200).json({ mensaje: 'Cuenta suspendida en PostgreSQL.' });
    }

    if (accion === 'ACTIVAR') {
      await usuario.update({ estatus: 1, fechaUpdate: new Date() });
      await Cuenta.update({ estatus: 1, fechaUpdate: new Date() }, { where: { idUsuario: usuarioId } });
      return res.status(200).json({ mensaje: 'Cuenta reactivada en PostgreSQL.' });
    }

    if (accion === 'DESBLOQUEAR_REDIS') {
      await BloqueoAntifraudeModel.save(usuarioId, {
        intentosFallidos: 0,
        bloqueado: false,
        accion: 'DESBLOQUEO_ADMIN',
        motivo: 'Desbloqueado manualmente por el administrador',
        fechaEvento: new Date().toISOString(),
      });
      return res.status(200).json({ mensaje: 'Bloqueo antifraude limpio en Redis.' });
    }

    res.status(400).json({ error: 'Acción inválida.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al gestionar estado de cuenta.' });
  }
};

// PATCH /api/admin/apelaciones/:auditoriaId/resolver -> Resuelve apelación en Mongo y crea Prestamo en SQL si aprueba
export const resolverApelacionPrestamo = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { auditoriaId } = req.params;
    const { decision, montoAprobado, observacionesAdmin } = req.body; // 'APROBAR' | 'RECHAZAR'

    const documento = await AuditoriaTransaccion.findOne({
      _id: auditoriaId,
      tipoMovimiento: 'SOLICITUD_PRESTAMO',
      estatus: 'EN_APELACION',
    });

    if (!documento) {
      await t.rollback();
      return res.status(404).json({ error: 'Apelación no encontrada o ya fue resuelta.' });
    }

    if (decision === 'APROBAR') {
      const montoFinal = Number(montoAprobado) > 0 ? Number(montoAprobado) : Number(documento.monto);
      const plazoMeses = Number(documento.payloadCompleto?.plazoMeses) || 12;
      const tasaInteresMensual = Number(documento.payloadCompleto?.tasaInteresMensual) || 2.5;

      const cuenta = await Cuenta.findByPk(documento.cuentaOrigenId, { transaction: t });
      if (!cuenta) {
        await t.rollback();
        return res.status(404).json({ error: 'Cuenta destino no encontrada.' });
      }

      const fechaInicio = new Date();
      const fechaVencimiento = new Date(fechaInicio);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + plazoMeses);

      // 1. Insertar el préstamo oficial en PostgreSQL
      const nuevoPrestamo = await Prestamo.create(
        {
          idCuenta: cuenta.idCuenta,
          montoOtorgado: montoFinal,
          saldoPendiente: montoFinal,
          fechaInicio,
          fechaVencimiento,
          fechaUltimoPago: null,
          tasaInteresMensual,
          estatus: 1,
          isDeleted: false,
        },
        { transaction: t }
      );

      // 2. Abonar fondos a la cuenta de débito
      await cuenta.update(
        { saldo: Number(cuenta.saldo) + montoFinal, fechaUpdate: new Date() },
        { transaction: t }
      );

      await t.commit();

      // 3. Actualizar documento en MongoDB a EXITOSA / INGRESO_PRESTAMO
      documento.estatus = 'EXITOSA';
      documento.tipoMovimiento = 'INGRESO_PRESTAMO';
      documento.monto = montoFinal;
      documento.cuentaDestinoId = Number(cuenta.idCuenta);
      documento.fechaActualizacion = new Date();
      documento.payloadCompleto = {
        ...documento.payloadCompleto,
        idPrestamoSQL: Number(nuevoPrestamo.idPrestamo),
        resolucionAdmin: {
          decision: 'APROBADA',
          observacionesAdmin:
            observacionesAdmin?.trim() || `Apelación aprobada por $${montoFinal.toFixed(2)} MXN.`,
          fechaResolucion: new Date().toISOString(),
        },
      };
      documento.markModified('payloadCompleto');
      await documento.save();

      return res.status(200).json({
        mensaje: 'Apelación aprobada, préstamo creado en PostgreSQL y saldo abonado.',
        prestamo: nuevoPrestamo,
      });
    }

    if (decision === 'RECHAZAR') {
      await t.commit();

      documento.estatus = 'RECHAZADA';
      documento.fechaActualizacion = new Date();
      documento.payloadCompleto = {
        ...documento.payloadCompleto,
        resolucionAdmin: {
          decision: 'RECHAZADA_DEFINITIVA',
          observacionesAdmin:
            observacionesAdmin?.trim() || 'Apelación rechazada tras revisión del comité de crédito.',
          fechaResolucion: new Date().toISOString(),
        },
      };
      documento.markModified('payloadCompleto');
      await documento.save();

      return res.status(200).json({ mensaje: 'Apelación rechazada definitivamente.' });
    }

    await t.rollback();
    res.status(400).json({ error: 'Decisión inválida. Usa APROBAR o RECHAZAR.' });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error('Error en resolverApelacionPrestamo:', error);
    res.status(500).json({ error: 'Error al resolver la apelación.' });
  }
};