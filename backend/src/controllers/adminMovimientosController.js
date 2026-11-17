import mongoose from 'mongoose';
import Cuenta from '../models/sql/Cuenta.js';
import Usuario from '../models/sql/Usuario.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';

// Movimientos = transacciones confirmadas que modificaron saldo (mismo criterio que el cliente).
const TIPOS = ['TRANSFERENCIA', 'DEPOSITO', 'INGRESO_PRESTAMO', 'PAGO_PRESTAMO', 'INTERES_PRESTAMO'];
const ETIQUETAS_TIPO = {
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
  INGRESO_PRESTAMO: 'Ingreso de préstamo',
  PAGO_PRESTAMO: 'Pago de préstamo',
  INTERES_PRESTAMO: 'Interés de préstamo',
};

const nombreCompleto = (u) => [u?.nombre, u?.apellidoUno, u?.apellidoDos].filter(Boolean).join(' ');

// Resuelve idCuenta -> { idCuenta, usuarioId, titular, clabe } para mostrar nombres en lugar de ids.
const mapaCuentas = async (ids) => {
  const unicos = [...new Set(ids.filter((i) => i !== null && i !== undefined).map(Number))];
  if (!unicos.length) return new Map();
  const cuentas = await Cuenta.findAll({
    where: { idCuenta: unicos },
    include: [{ model: Usuario, attributes: ['id', 'nombre', 'apellidoUno', 'apellidoDos'] }],
  });
  return new Map(
    cuentas.map((c) => [
      Number(c.idCuenta),
      {
        idCuenta: Number(c.idCuenta),
        usuarioId: Number(c.idUsuario),
        titular: nombreCompleto(c.Usuario) || `Cliente #${c.idUsuario}`,
        clabe: c.clabeInterbancaria,
      },
    ])
  );
};

const parteCuenta = (mapa, id) =>
  id === null || id === undefined ? null : mapa.get(Number(id)) || { idCuenta: Number(id), usuarioId: null, titular: `Cuenta #${id}`, clabe: '' };

const concepto = (doc) => {
  const p = doc.payloadCompleto || {};
  if (doc.tipoMovimiento === 'INGRESO_PRESTAMO') return `Préstamo depositado${p.motivoSolicitud ? ` · ${p.motivoSolicitud}` : ''}`;
  return p.concepto || ETIQUETAS_TIPO[doc.tipoMovimiento] || doc.tipoMovimiento;
};

// Desde la perspectiva de la cuenta consultada (solo cuando se filtra por una cuenta).
const direccionPara = (doc, idCuenta) => {
  if (!idCuenta) return null;
  if (doc.tipoMovimiento === 'TRANSFERENCIA') return Number(doc.cuentaDestinoId) === idCuenta ? 'ENTRADA' : 'SALIDA';
  return ['INGRESO_PRESTAMO', 'DEPOSITO'].includes(doc.tipoMovimiento) ? 'ENTRADA' : 'SALIDA';
};

const aResumen = (doc, mapa, idCuentaFiltro) => ({
  id: String(doc._id),
  tipoMovimiento: doc.tipoMovimiento,
  etiquetaTipo: ETIQUETAS_TIPO[doc.tipoMovimiento] || doc.tipoMovimiento,
  concepto: concepto(doc),
  monto: Number(doc.monto),
  estatus: doc.estatus,
  fecha: doc.fechaCreacion || doc.createdAt,
  direccion: direccionPara(doc, idCuentaFiltro),
  origen: parteCuenta(mapa, doc.cuentaOrigenId),
  destino: parteCuenta(mapa, doc.cuentaDestinoId),
});

// GET /api/admin-movimientos?usuarioId=&tipo=&pagina=&limite=  (solo administrador)
// Sin usuarioId: movimientos generales de todos los clientes. Con usuarioId: los de su cuenta.
export const getMovimientosAdmin = async (req, res) => {
  try {
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : null;

    const filtro = { estatus: 'EXITOSA', tipoMovimiento: tipo ? tipo : { $in: TIPOS } };

    let idCuentaFiltro = null;
    let cliente = null;
    if (req.query.usuarioId !== undefined && req.query.usuarioId !== '') {
      const usuarioId = Number(req.query.usuarioId);
      if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        return res.status(400).json({ error: 'Identificador de cliente inválido.' });
      }
      const usuario = await Usuario.findOne({ where: { id: usuarioId, isAdmin: 0 } });
      const cuenta = usuario ? await Cuenta.findOne({ where: { idUsuario: usuarioId } }) : null;
      if (!usuario || !cuenta) {
        return res.status(404).json({ error: 'No se encontró la cuenta del cliente.' });
      }
      idCuentaFiltro = Number(cuenta.idCuenta);
      filtro.$or = [{ cuentaOrigenId: idCuentaFiltro }, { cuentaDestinoId: idCuentaFiltro }];
      cliente = { usuarioId, titular: nombreCompleto(usuario), clabe: cuenta.clabeInterbancaria, saldo: Number(cuenta.saldo) };
    }

    const [total, docs] = await Promise.all([
      AuditoriaTransaccion.countDocuments(filtro),
      AuditoriaTransaccion.find(filtro)
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite),
    ]);

    const mapa = await mapaCuentas(docs.flatMap((d) => [d.cuentaOrigenId, d.cuentaDestinoId]));

    res.status(200).json({
      cliente,
      movimientos: docs.map((d) => aResumen(d, mapa, idCuentaFiltro)),
      total,
      pagina,
      limite,
      hayMas: pagina * limite < total,
    });
  } catch (error) {
    console.error('Error en getMovimientosAdmin:', error);
    res.status(500).json({ error: 'Error interno al consultar los movimientos.' });
  }
};

// GET /api/admin-movimientos/:id  (solo administrador) -> documento completo de AuditoriaTransaccion
export const getDetalleMovimientoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Identificador de movimiento inválido.' });
    }
    const doc = await AuditoriaTransaccion.findOne({ _id: id, tipoMovimiento: { $in: TIPOS } });
    if (!doc) return res.status(404).json({ error: 'Movimiento no encontrado.' });

    const mapa = await mapaCuentas([doc.cuentaOrigenId, doc.cuentaDestinoId]);
    res.status(200).json({
      movimiento: {
        ...aResumen(doc, mapa, null),
        documento: {
          _id: String(doc._id),
          cuentaOrigenId: doc.cuentaOrigenId,
          cuentaDestinoId: doc.cuentaDestinoId,
          tipoMovimiento: doc.tipoMovimiento,
          monto: Number(doc.monto),
          estatus: doc.estatus,
          fechaCreacion: doc.fechaCreacion,
          fechaActualizacion: doc.fechaActualizacion,
          payloadCompleto: doc.payloadCompleto || {},
        },
      },
    });
  } catch (error) {
    console.error('Error en getDetalleMovimientoAdmin:', error);
    res.status(500).json({ error: 'Error interno al consultar el movimiento.' });
  }
};
