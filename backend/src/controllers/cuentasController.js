import Cuenta from '../models/sql/Cuenta.js';
import Usuario from '../models/sql/Usuario.js';
import Prestamo from '../models/sql/Prestamo.js';
import { aPrestamoResumen, esPrestamoActivo } from '../services/prestamoFormato.js';

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
