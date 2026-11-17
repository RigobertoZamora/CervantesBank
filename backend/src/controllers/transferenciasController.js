import { Op } from 'sequelize';
import sequelize from '../config/postgres.js';
import Cuenta from '../models/sql/Cuenta.js';
import Usuario from '../models/sql/Usuario.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';

const nombreCompleto = (usuario) => [usuario?.nombre, usuario?.apellidoUno, usuario?.apellidoDos].filter(Boolean).join(' ').trim();
const normalizarNombre = (nombre) => nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();


// GET /api/transferencias/beneficiario?clabe=... valida si existe una cuenta destino activa.
export const consultarBeneficiario = async (req, res) => {
  const clabe = String(req.query.clabe ?? '').trim();
  if (!/^\d{18}$/.test(clabe)) {
    return res.status(400).json({ error: 'La CLABE debe contener exactamente 18 dígitos.' });
  }
  try {
    const origen = await Cuenta.findOne({ where: { idUsuario: req.user.id, estatus: 1, isDeleted: false } });
    const destino = await Cuenta.findOne({
      where: { clabeInterbancaria: clabe, estatus: 1, isDeleted: false },
      include: [{ model: Usuario, attributes: ['nombre', 'apellidoUno', 'apellidoDos'] }],
    });
    if (!destino || (origen && Number(destino.idCuenta) === Number(origen.idCuenta))) {
      return res.status(404).json({ encontrado: false, mensaje: 'No encontramos una cuenta activa con esta CLABE.' });
    }
    return res.json({
      encontrado: true,
      mensaje: 'Cuenta encontrada. Verifica los datos antes de continuar.',
      beneficiario: { nombre: nombreCompleto(destino.Usuario) },
    });
  } catch (error) {
    console.error('Error al consultar beneficiario:', error);
    return res.status(500).json({ error: 'No fue posible validar la CLABE en este momento.' });
  }
};

// POST /api/transferencias: el origen siempre se obtiene de la sesión autenticada.
export const realizarTransferencia = async (req, res) => {
  const { monto, clabeInterbancaria, nombreDestinatario, concepto } = req.body ?? {};
  const cantidad = Number(monto);
  const clabe = String(clabeInterbancaria ?? '').trim();
  const nombreIngresado = String(nombreDestinatario ?? '').trim();
  const detalle = String(concepto ?? '').trim();

  if (!Number.isFinite(cantidad) || cantidad <= 0 || !/^\d{18}$/.test(clabe) || !detalle) {
    return res.status(400).json({ error: 'Ingresa un monto positivo, CLABE de 18 dígitos y concepto.' });
  }
  if (detalle.length > 120 || nombreIngresado.length > 150) {
    return res.status(400).json({ error: 'El nombre o concepto excede la longitud permitida.' });
  }

  let origenId;
  let destinoId;
  try {
    const resultado = await sequelize.transaction(async (transaction) => {
      const origen = await Cuenta.findOne({
        where: { idUsuario: req.user.id, estatus: 1, isDeleted: false },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!origen) throw Object.assign(new Error('No se encontró una cuenta de origen activa.'), { status: 404 });

      const destino = await Cuenta.findOne({
        where: { clabeInterbancaria: clabe, estatus: 1, isDeleted: false, idCuenta: { [Op.ne]: origen.idCuenta } },
        include: [{ model: Usuario, attributes: ['nombre', 'apellidoUno', 'apellidoDos'] }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!destino) throw Object.assign(new Error('No existe una cuenta destino activa con esa CLABE.'), { status: 404 });
      if (Number(origen.saldo) < cantidad) {
        throw Object.assign(new Error('El monto supera el saldo disponible.'), { status: 400 });
      }

      origen.saldo = (Number(origen.saldo) - cantidad).toFixed(6);
      destino.saldo = (Number(destino.saldo) + cantidad).toFixed(6);
      await origen.save({ transaction });
      await destino.save({ transaction });
      origenId = Number(origen.idCuenta);
      destinoId = Number(destino.idCuenta);
      return { origenId, destinoId, monto: cantidad };
    });

    // Auditoría Mongo se guarda después de confirmar PostgreSQL (bases separadas).
    await AuditoriaTransaccion.create({
      cuentaOrigenId: resultado.origenId,
      cuentaDestinoId: resultado.destinoId,
      tipoMovimiento: 'TRANSFERENCIA',
      monto: resultado.monto,
      estatus: 'EXITOSA',
      payloadCompleto: {
        usuarioOrigenId: Number(req.user.id),
        clabeDestino: clabe,
        nombreDestinatario: nombreIngresado,
        concepto: detalle,
        cuentaOrigenId: resultado.origenId,
        cuentaDestinoId: resultado.destinoId,
      },
    });
    return res.status(201).json({ mensaje: 'Transferencia realizada correctamente.', transferencia: resultado });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al realizar transferencia:', error);
    // Si SQL se confirmó pero Mongo falló, no repetir la operación: revisar conciliación.
    return res.status(500).json({ error: 'No se pudo completar la transferencia. Si hubo un cargo, contacta soporte antes de reintentar.' });
  }
};
