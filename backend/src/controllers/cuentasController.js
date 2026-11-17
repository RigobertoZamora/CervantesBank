import Cuenta from '../models/sql/Cuenta.js';
import Usuario from '../models/sql/Usuario.js';
import Prestamo from '../models/sql/Prestamo.js';
import { aPrestamoResumen, esPrestamoActivo } from '../services/prestamoFormato.js';

const generarClabe = () => {
  const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
  return `646180${random12}`;
};

// GET /api/cuentas/resumen  (requiere sesión)
// Datos de la pantalla de inicio del cliente: saldo de su cuenta, historial y préstamos.
export const getResumenCuenta = async (req, res) => {
  try {
    // 1. El id sale del JWT que validó verificarSesion (req.user), NO de la URL:
    //    así cada cliente solo puede consultar su propia cuenta.
    const cuenta = await Cuenta.findOne({
      where: { idUsuario: req.user.id },
      include: [{ model: Usuario, attributes: ['nombre', 'apellidoUno', 'apellidoDos'] }],
    });

    // 2. Sin cuenta activa (o con borrado lógico) -> 404
    if (!cuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }

    // 3. Armar el nombre completo del titular
    const { nombre, apellidoUno, apellidoDos } = cuenta.Usuario ?? {};
    const titular = [nombre, apellidoUno, apellidoDos].filter(Boolean).join(' ');

    // 4. Préstamos activos de la cuenta (PostgreSQL)
    const prestamos = await Prestamo.findAll({
      where: { idCuenta: cuenta.idCuenta },
      order: [['fechaVencimiento', 'ASC']],
    });

    // 5. Responder lo que necesita la pantalla
    res.status(200).json({
      cuenta: {
        idCuenta: cuenta.idCuenta,
        titular,
        clabeInterbancaria: cuenta.clabeInterbancaria,
        moneda: 'MXN',
        saldo: Number(cuenta.saldo), // Sequelize entrega los DECIMAL como texto
      },
      historial: [], // pendiente: movimientos (AuditoriaTransaccion en MongoDB)
      prestamos: prestamos.filter(esPrestamoActivo).map(aPrestamoResumen),
    });
  } catch (error) {
    console.error('Error en getResumenCuenta:', error);
    res.status(500).json({ error: 'Error interno al consultar el saldo.' });
  }
};

// GET /api/cuentas -> Lista cuentas activas del usuario autenticado (o todas si es admin)
export const getCuentas = async (req, res) => {
  try {
    const filtro = Number(req.user.isAdmin) === 1 ? {} : { idUsuario: req.user.id };
    const cuentas = await Cuenta.findAll({
      where: filtro,
      order: [['idCuenta', 'ASC']],
    });
    res.status(200).json(cuentas);
  } catch (error) {
    console.error('Error en getCuentas:', error);
    res.status(500).json({ error: 'Error al consultar las cuentas.' });
  }
};

// POST /api/cuentas -> Abre una cuenta adicional (ej. ahorro/respaldo) en PostgreSQL
export const createCuenta = async (req, res) => {
  try {
    const idUsuario = Number(req.user.isAdmin) === 1 && req.body.idUsuario
      ? Number(req.body.idUsuario)
      : Number(req.user.id);

    const usuario = await Usuario.findByPk(idUsuario);
    if (!usuario || usuario.estatus !== 1) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    const nuevaCuenta = await Cuenta.create({
      idUsuario,
      saldo: 0.0,
      clabeInterbancaria: generarClabe(),
      estatus: 1,
      isDeleted: false,
    });

    res.status(201).json({
      mensaje: 'Cuenta bancaria creada correctamente.',
      cuenta: nuevaCuenta,
    });
  } catch (error) {
    console.error('Error en createCuenta:', error);
    res.status(500).json({ error: 'Error interno al crear la cuenta.' });
  }
};

// PATCH /api/cuentas/:idCuenta -> Actualiza estatus (1 = Activa, 0 = Suspendida)
export const updateCuenta = async (req, res) => {
  try {
    const { idCuenta } = req.params;
    const cuenta = await Cuenta.findByPk(idCuenta);

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada o eliminada.' });
    }
    if (Number(req.user.isAdmin) !== 1 && Number(cuenta.idUsuario) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta cuenta.' });
    }

    const cambios = { fechaUpdate: new Date() };
    if (req.body.estatus !== undefined && [0, 1].includes(Number(req.body.estatus))) {
      cambios.estatus = Number(req.body.estatus);
    }

    await cuenta.update(cambios);
    res.status(200).json({ mensaje: 'Cuenta actualizada correctamente.', cuenta });
  } catch (error) {
    console.error('Error en updateCuenta:', error);
    res.status(500).json({ error: 'Error al actualizar la cuenta.' });
  }
};

// DELETE /api/cuentas/:idCuenta -> Borrado lógico en PostgreSQL
export const deleteCuenta = async (req, res) => {
  try {
    const { idCuenta } = req.params;
    const cuenta = await Cuenta.findByPk(idCuenta);

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada o ya eliminada.' });
    }
    if (Number(req.user.isAdmin) !== 1 && Number(cuenta.idUsuario) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta cuenta.' });
    }
    if (Number(cuenta.saldo) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una cuenta con saldo disponible. Transfiere los fondos primero.',
      });
    }

    await cuenta.update({ isDeleted: true, estatus: 0, fechaUpdate: new Date() });
    res.status(200).json({ mensaje: `Cuenta #${idCuenta} marcada como borrada lógicamente.` });
  } catch (error) {
    console.error('Error en deleteCuenta:', error);
    res.status(500).json({ error: 'Error al eliminar la cuenta.' });
  }
};