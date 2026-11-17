import { calcularDiasAtrasoPrestamo } from './creditoService.js';

// Forma única con la que el frontend recibe un préstamo (SQL entrega los DECIMAL como texto).
export const aPrestamoResumen = (p) => {
  const plano = typeof p.toJSON === 'function' ? p.toJSON() : p;
  const montoOtorgado = Number(plano.montoOtorgado);
  const saldoPendiente = Number(plano.saldoPendiente);
  return {
    id: Number(plano.idPrestamo),
    montoOtorgado,
    saldoPendiente,
    tasaInteresMensual: Number(plano.tasaInteresMensual),
    fechaInicio: plano.fechaInicio,
    fechaVencimiento: plano.fechaVencimiento,
    fechaUltimoPago: plano.fechaUltimoPago,
    diasAtraso: calcularDiasAtrasoPrestamo(plano),
    estatus: Number(plano.estatus),
  };
};

export const esPrestamoActivo = (p) => Number(p.estatus) === 1 && Number(p.saldoPendiente) > 0;
