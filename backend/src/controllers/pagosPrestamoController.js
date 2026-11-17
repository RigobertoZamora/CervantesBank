import sequelize from '../config/postgres.js';
import Cuenta from '../models/sql/Cuenta.js';
import Prestamo from '../models/sql/Prestamo.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';
import { aPrestamoResumen, esPrestamoActivo } from '../services/prestamoFormato.js';

const redondear = (n) => Math.round(n * 100) / 100;

// GET /api/pagos-prestamo  (requiere sesión)
// Préstamos activos del cliente + saldo disponible de su cuenta (para validar el monto en pantalla).
export const getPrestamosPagables = async (req, res) => {
  try {
    const cuenta = await Cuenta.findOne({ where: { idUsuario: req.user.id, estatus: 1 } });
    if (!cuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const prestamos = await Prestamo.findAll({
      where: { idCuenta: cuenta.idCuenta },
      order: [['fechaVencimiento', 'ASC']],
    });

    res.status(200).json({
      saldoCuenta: Number(cuenta.saldo),
      prestamos: prestamos.filter(esPrestamoActivo).map(aPrestamoResumen),
    });
  } catch (error) {
    console.error('Error en getPrestamosPagables:', error);
    res.status(500).json({ error: 'Error interno al consultar tus préstamos.' });
  }
};

// POST /api/pagos-prestamo  { idPrestamo, monto }  (requiere sesión)
// Descuenta el monto del saldo de la cuenta, lo abona al préstamo (SQL) y lo registra en AuditoriaTransaccion (Mongo).
export const pagarPrestamo = async (req, res) => {
  const idPrestamo = Number(req.body?.idPrestamo);
  const monto = redondear(Number(req.body?.monto));

  if (!Number.isInteger(idPrestamo) || idPrestamo <= 0) {
    return res.status(400).json({ error: 'Selecciona el préstamo que deseas pagar.' });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ error: 'Ingresa un monto mayor que cero.' });
  }

  try {
    const resultado = await sequelize.transaction(async (transaction) => {
      // El dueño sale del token: solo se puede pagar un préstamo de la propia cuenta.
      const cuenta = await Cuenta.findOne({
        where: { idUsuario: req.user.id, estatus: 1 },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!cuenta) throw Object.assign(new Error('No se encontró una cuenta activa.'), { status: 404 });

      const prestamo = await Prestamo.findOne({
        where: { idPrestamo, idCuenta: cuenta.idCuenta },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!prestamo || !esPrestamoActivo(prestamo)) {
        throw Object.assign(new Error('El préstamo no existe o ya está liquidado.'), { status: 404 });
      }

      const saldoCuenta = Number(cuenta.saldo);
      const saldoPendiente = Number(prestamo.saldoPendiente);

      if (monto > saldoCuenta) {
        throw Object.assign(new Error('El monto supera el saldo disponible en tu cuenta.'), { status: 400 });
      }
      if (monto > saldoPendiente) {
        throw Object.assign(
          new Error(`El monto supera lo que debes en este préstamo ($${saldoPendiente.toFixed(2)} MXN).`),
          { status: 400 }
        );
      }

      const nuevoSaldoCuenta = redondear(saldoCuenta - monto);
      const nuevoPendiente = redondear(saldoPendiente - monto);
      const liquidado = nuevoPendiente <= 0;
      const ahora = new Date();

      await cuenta.update({ saldo: nuevoSaldoCuenta.toFixed(6), fechaUpdate: ahora }, { transaction });
      await prestamo.update(
        {
          saldoPendiente: nuevoPendiente.toFixed(6),
          fechaUltimoPago: ahora,
          fechaUpdate: ahora,
          estatus: liquidado ? 2 : 1,
        },
        { transaction }
      );

      return {
        idCuenta: Number(cuenta.idCuenta),
        saldoAnterior: saldoCuenta,
        nuevoSaldoCuenta,
        saldoPendienteAnterior: saldoPendiente,
        nuevoPendiente,
        liquidado,
        prestamo: aPrestamoResumen(prestamo),
      };
    });

    // Auditoría Mongo después de confirmar PostgreSQL (bases separadas), igual que en transferencias.
    const auditoria = await AuditoriaTransaccion.create({
      cuentaOrigenId: resultado.idCuenta,
      cuentaDestinoId: null,
      tipoMovimiento: 'PAGO_PRESTAMO',
      monto,
      estatus: 'EXITOSA',
      payloadCompleto: {
        usuarioId: Number(req.user.id),
        concepto: `Pago de préstamo #${idPrestamo}`,
        idPrestamoSQL: idPrestamo,
        saldoCuentaAnterior: resultado.saldoAnterior,
        saldoCuentaPosterior: resultado.nuevoSaldoCuenta,
        saldoPendienteAnterior: resultado.saldoPendienteAnterior,
        saldoPendientePosterior: resultado.nuevoPendiente,
        prestamoLiquidado: resultado.liquidado,
      },
    });

    res.status(201).json({
      mensaje: resultado.liquidado
        ? `¡Liquidaste el préstamo #${idPrestamo}! Se descontaron $${monto.toFixed(2)} MXN de tu cuenta.`
        : `Pago de $${monto.toFixed(2)} MXN aplicado al préstamo #${idPrestamo}.`,
      liquidado: resultado.liquidado,
      nuevoSaldoCuenta: resultado.nuevoSaldoCuenta,
      prestamo: resultado.prestamo,
      auditoriaId: String(auditoria._id),
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en pagarPrestamo:', error);
    // Si SQL se confirmó pero Mongo falló, no repetir el pago: revisar conciliación.
    res.status(500).json({ error: 'No se pudo completar el pago. Revisa tu saldo antes de reintentar.' });
  }
};
