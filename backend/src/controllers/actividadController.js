import Usuario from '../models/sql/Usuario.js';
import Cuenta from '../models/sql/Cuenta.js';
import Prestamo from '../models/sql/Prestamo.js';
import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';
import AuditoriaTransaccion from '../models/mongo/AuditoriaTransaccion.js';
import { calcularDiasAtrasoPrestamo } from '../services/creditoService.js';

const moneda = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ACCESOS = {
  LOGIN_EXITOSO: { titulo: 'Inicio de sesión', estado: 'ok' },
  LOGIN_FALLIDO: { titulo: 'Intento de acceso fallido', estado: 'warn' },
  LOGOUT: { titulo: 'Cierre de sesión', estado: 'info' },
};

// GET /api/actividad?limite=30  (requiere sesión)
// Historial de USO de la cuenta (no son transacciones): accesos, solicitudes de préstamo,
// estatus KYC, apertura de cuenta, etc. El usuario sale del token, no de la URL.
export const getActividad = async (req, res) => {
  try {
    const idUsuario = Number(req.user.id);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 30));

    const usuario = await Usuario.findByPk(idUsuario);
    const cuenta = await Cuenta.findOne({ where: { idUsuario } });
    if (!usuario || !cuenta) {
      return res.status(404).json({ error: 'No se encontró una cuenta activa para este usuario.' });
    }
    const idCuenta = Number(cuenta.idCuenta);

    const expediente = await ExpedienteKYC.findOne({ usuarioId: idUsuario, isDeleted: false });
    const prestamos = await Prestamo.findAll({ where: { idCuenta } });
    const solicitudes = await AuditoriaTransaccion.find({
      cuentaOrigenId: idCuenta,
      tipoMovimiento: 'SOLICITUD_PRESTAMO',
    });

    const eventos = [];
    const agregar = (categoria, titulo, detalle, fecha, estado = 'info') => {
      if (!fecha) return;
      eventos.push({ id: `${categoria}-${eventos.length}`, categoria, titulo, detalle, fecha, estado });
    };

    // --- Usuario y Cuenta (PostgreSQL) ---
    agregar('CUENTA', 'Registro de usuario', `Cliente #${usuario.id} dado de alta.`, usuario.fechaCreacion);
    agregar(
      'CUENTA',
      'Apertura de cuenta digital',
      `Cuenta en pesos con CLABE terminación ${String(cuenta.clabeInterbancaria).slice(-4)}.`,
      cuenta.fechaCreacion,
      'ok'
    );

    // --- ExpedienteKYC (MongoDB) ---
    if (expediente) {
      agregar('KYC', 'Expediente KYC creado', 'Documentación enviada a revisión de cumplimiento.', expediente.fechaCreacion);
      if (expediente.estatusValidacion !== 'PENDIENTE') {
        const aprobado = expediente.estatusValidacion === 'APROBADO';
        agregar(
          'KYC',
          `Expediente KYC ${aprobado ? 'aprobado' : 'rechazado'}`,
          expediente.observacionesAdmin || 'Dictamen emitido por el área de cumplimiento.',
          expediente.fechaActualizacion,
          aprobado ? 'ok' : 'error'
        );
      }
      if (expediente.cancelacionCuenta?.solicitada) {
        agregar(
          'KYC',
          'Solicitud de cancelación de cuenta',
          expediente.cancelacionCuenta.motivo || 'Sin motivo registrado.',
          expediente.cancelacionCuenta.fecha,
          'warn'
        );
      }
      for (const acceso of expediente.historialAccesos || []) {
        const meta = ACCESOS[acceso.accion] || { titulo: acceso.accion, estado: 'info' };
        const partes = [acceso.ip && `IP ${acceso.ip}`, acceso.dispositivo].filter(Boolean);
        agregar('ACCESO', meta.titulo, partes.join(' · ') || acceso.motivo, acceso.fecha, meta.estado);
      }
    }

    // --- Préstamo (PostgreSQL): préstamos aprobados / vencidos / liquidados ---
    for (const p of prestamos) {
      agregar(
        'PRESTAMO',
        `Solicitud aprobada · Préstamo #${p.idPrestamo}`,
        `$${moneda(p.montoOtorgado)} MXN, vence el ${new Date(p.fechaVencimiento).toLocaleDateString('es-MX')}.`,
        p.fechaInicio,
        'ok'
      );
      if (Number(p.saldoPendiente) === 0 || Number(p.estatus) === 2) {
        agregar('PRESTAMO', `Préstamo #${p.idPrestamo} liquidado`, 'Saldo pendiente en $0.00.', p.fechaUltimoPago || p.fechaUpdate, 'ok');
      } else if (calcularDiasAtrasoPrestamo(p) > 0) {
        agregar(
          'PRESTAMO',
          `Préstamo #${p.idPrestamo} vencido`,
          `${calcularDiasAtrasoPrestamo(p)} día(s) de atraso.`,
          p.fechaVencimiento,
          'error'
        );
      }
    }

    // --- Solicitudes rechazadas / en apelación (MongoDB) ---
    for (const s of solicitudes) {
      const resolucion = s.payloadCompleto?.resolucionAdmin;
      const monto = `$${moneda(s.monto)} MXN`;
      if (s.estatus === 'EN_APELACION') {
        agregar('PRESTAMO', 'Apelación de préstamo en revisión', `${monto} · turnada al administrador.`, s.fechaActualizacion || s.createdAt, 'warn');
      } else if (resolucion) {
        agregar('PRESTAMO', 'Apelación de préstamo rechazada', `${monto} · ${resolucion.observacionesAdmin || 'Dictamen definitivo.'}`, s.fechaActualizacion || s.createdAt, 'error');
      } else {
        agregar('PRESTAMO', 'Solicitud de préstamo rechazada', `${monto} · excede tu línea de crédito.`, s.fechaCreacion || s.createdAt, 'error');
      }
    }

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.status(200).json({ actividad: eventos.slice(0, limite), total: eventos.length });
  } catch (error) {
    console.error('Error en getActividad:', error);
    res.status(500).json({ error: 'Error interno al consultar el historial de actividad.' });
  }
};
