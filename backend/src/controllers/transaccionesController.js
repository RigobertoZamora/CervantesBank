import mongoose from 'mongoose';
import Cuenta from '../models/sql/Cuenta.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';

// Transacción = cualquier movimiento CONFIRMADO que modificó el saldo de la cuenta.
// Las solicitudes de préstamo rechazadas o en apelación y la cancelación de cuenta no mueven dinero.
const TIPOS_QUE_MUEVEN_SALDO = [
  'TRANSFERENCIA',
  'DEPOSITO',
  'INGRESO_PRESTAMO',
  'PAGO_PRESTAMO',
  'INTERES_PRESTAMO',
];

const ETIQUETAS_TIPO = {
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
  INGRESO_PRESTAMO: 'Préstamo',
  PAGO_PRESTAMO: 'Pago de préstamo',
  INTERES_PRESTAMO: 'Interés de préstamo',
};

// Desde la perspectiva de MI cuenta: ¿entró o salió dinero?
const calcularDireccion = (doc, idCuenta) => {
  switch (doc.tipoMovimiento) {
    case 'INGRESO_PRESTAMO':
    case 'DEPOSITO':
      return 'ENTRADA';
    case 'PAGO_PRESTAMO':
    case 'INTERES_PRESTAMO':
      return 'SALIDA';
    case 'TRANSFERENCIA':
      return Number(doc.cuentaDestinoId) === idCuenta ? 'ENTRADA' : 'SALIDA';
    default:
      return 'SALIDA';
  }
};

const armarConcepto = (doc, direccion) => {
  const p = doc.payloadCompleto || {};
  if (doc.tipoMovimiento === 'TRANSFERENCIA') {
    const base = p.concepto || 'Transferencia';
    return direccion === 'ENTRADA'
      ? `${base} · transferencia recibida`
      : `${base}${p.nombreDestinatario ? ` · a ${p.nombreDestinatario}` : ''}`;
  }
  if (doc.tipoMovimiento === 'INGRESO_PRESTAMO') {
    return `Préstamo depositado${p.motivoSolicitud ? ` · ${p.motivoSolicitud}` : ''}`;
  }
  return p.concepto || ETIQUETAS_TIPO[doc.tipoMovimiento] || doc.tipoMovimiento;
};

const aResumen = (doc, idCuenta) => {
  const direccion = calcularDireccion(doc, idCuenta);
  return {
    id: String(doc._id),
    tipoMovimiento: doc.tipoMovimiento,
    etiquetaTipo: ETIQUETAS_TIPO[doc.tipoMovimiento] || doc.tipoMovimiento,
    direccion,
    concepto: armarConcepto(doc, direccion),
    monto: Number(doc.monto),
    estatus: doc.estatus,
    fecha: doc.fechaCreacion || doc.createdAt,
  };
};

// Documento de AuditoriaTransacciones tal como se guardó, sin exponer datos de la contraparte
// cuando el dinero ENTRÓ por una transferencia (el remitente no debe quedar identificado).
const aDetalle = (doc, idCuenta) => {
  const direccion = calcularDireccion(doc, idCuenta);
  const payload = { ...(doc.payloadCompleto || {}) };
  const documento = {
    _id: String(doc._id),
    cuentaOrigenId: doc.cuentaOrigenId,
    cuentaDestinoId: doc.cuentaDestinoId,
    tipoMovimiento: doc.tipoMovimiento,
    monto: Number(doc.monto),
    estatus: doc.estatus,
    fechaCreacion: doc.fechaCreacion,
    fechaActualizacion: doc.fechaActualizacion,
    payloadCompleto: payload,
  };

  if (doc.tipoMovimiento === 'TRANSFERENCIA' && direccion === 'ENTRADA') {
    delete payload.usuarioOrigenId;
    delete payload.cuentaOrigenId;
    delete payload.clabeDestino;
    delete payload.nombreDestinatario;
    documento.cuentaOrigenId = null;
  }
  return { ...aResumen(doc, idCuenta), documento };
};

const obtenerIdCuenta = async (req) => {
  const cuenta = await Cuenta.findOne({ where: { idUsuario: req.user.id } });
  return cuenta ? Number(cuenta.idCuenta) : null;
};

// GET /api/transacciones?pagina=1&limite=20  (requiere sesión)
// Historial de movimientos que modificaron el saldo de la cuenta del usuario autenticado.
export const getTransacciones = async (req, res) => {
  try {
    const idCuenta = await obtenerIdCuenta(req);
    if (!idCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);

    const filtro = {
      tipoMovimiento: { $in: TIPOS_QUE_MUEVEN_SALDO },
      estatus: 'EXITOSA',
      $or: [{ cuentaOrigenId: idCuenta }, { cuentaDestinoId: idCuenta }],
    };

    const [total, docs] = await Promise.all([
      AuditoriaTransaccion.countDocuments(filtro),
      AuditoriaTransaccion.find(filtro)
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite),
    ]);

    res.status(200).json({
      transacciones: docs.map((d) => aResumen(d, idCuenta)),
      total,
      pagina,
      limite,
      hayMas: pagina * limite < total,
    });
  } catch (error) {
    console.error('Error en getTransacciones:', error);
    res.status(500).json({ error: 'Error interno al consultar las transacciones.' });
  }
};

// GET /api/transacciones/:id  (requiere sesión)
// Detalle: documento de AuditoriaTransacciones, solo si la cuenta del usuario participó en él.
export const getDetalleTransaccion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Identificador de transacción inválido.' });
    }

    const idCuenta = await obtenerIdCuenta(req);
    if (!idCuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    const doc = await AuditoriaTransaccion.findOne({
      _id: id,
      tipoMovimiento: { $in: TIPOS_QUE_MUEVEN_SALDO },
      $or: [{ cuentaOrigenId: idCuenta }, { cuentaDestinoId: idCuenta }],
    });
    if (!doc) {
      return res.status(404).json({ error: 'Transacción no encontrada.' });
    }

    res.status(200).json({ transaccion: aDetalle(doc, idCuenta) });
  } catch (error) {
    console.error('Error en getDetalleTransaccion:', error);
    res.status(500).json({ error: 'Error interno al consultar la transacción.' });
  }
};
