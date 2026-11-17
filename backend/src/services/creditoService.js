import redisClient from '../config/redis.js';

const MS_POR_DIA = 1000 * 60 * 60 * 24;

export const leerAntifraudeRedis = async (usuarioId) => {
  const key = `fraude:cuenta:${usuarioId}`;
  const tipo = await redisClient.type(key);

  if (tipo === 'string') {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  if (tipo === 'hash') {
    const hash = await redisClient.hGetAll(key);
    return Object.keys(hash).length ? hash : null;
  }
  return null;
};

// Cálculo dinámico de días de atraso basado en fechaVencimiento y saldoPendiente
export const calcularDiasAtrasoPrestamo = (prestamo) => {
  const saldoPendiente = Number(prestamo.saldoPendiente || 0);
  if (saldoPendiente <= 0 || Number(prestamo.estatus) !== 1) {
    return 0;
  }

  const hoy = Date.now();
  const vencimiento = new Date(prestamo.fechaVencimiento).getTime();
  if (hoy <= vencimiento) {
    return 0;
  }

  return Math.floor((hoy - vencimiento) / MS_POR_DIA);
};

/**
 * Evalúa capacidad de préstamo automático y score de rendimiento/morosidad
 * cruzando PostgreSQL (Cuenta + Prestamo), MongoDB (ExpedienteKYC) y Redis.
 */
export const calcularRangoCreditoYPerfil = ({ cuenta, expedienteKYC, antifraude, prestamos = [] }) => {
  const saldoDebito = Number(cuenta?.saldo || 0);
  const estatusKyc = expedienteKYC?.estatusValidacion || 'PENDIENTE';
  const bloqueadoRedis = antifraude?.bloqueado === true || antifraude?.bloqueado === 'true';
  const intentosFallidos = Number(antifraude?.intentosFallidos || 0);

  // Enriquecer préstamos con su mora calculada en tiempo real
  const prestamosConMora = prestamos.map((p) => {
    const plain = typeof p.toJSON === 'function' ? p.toJSON() : p;
    return {
      ...plain,
      diasAtrasoCalculados: calcularDiasAtrasoPrestamo(plain),
    };
  });

  const prestamosVigentes = prestamosConMora.filter(
    (p) => Number(p.estatus) === 1 && Number(p.saldoPendiente) > 0
  );
  const prestamosLiquidados = prestamosConMora.filter(
    (p) => Number(p.saldoPendiente) === 0 || Number(p.estatus) === 2
  );

  const deudaActiva = prestamosVigentes.reduce((acc, p) => acc + Number(p.saldoPendiente || 0), 0);
  const maxDiasAtraso = prestamosConMora.reduce(
    (max, p) => Math.max(max, p.diasAtrasoCalculados),
    0
  );

  // 1. Score de comportamiento (0 a 1000, base 500) para ranking de Administrador
  let score = 500;
  score += Math.min(200, Math.floor(saldoDebito / 100)); // +1 pt por cada $100 en débito
  if (estatusKyc === 'APROBADO') score += 120;
  if (estatusKyc === 'RECHAZADO') score -= 150;
  score += prestamosLiquidados.length * 80;
  score -= maxDiasAtraso * 20; // Penalización severa por mora vencida
  if (bloqueadoRedis) score -= 200;
  score -= intentosFallidos * 35;
  score = Math.max(0, Math.min(1000, score));

  let clasificacionAdmin = 'ESTANDAR';
  if (maxDiasAtraso > 0 || score < 450 || bloqueadoRedis) {
    clasificacionAdmin = 'PEOR_MOROSO';
  } else if (score >= 680 && (prestamosLiquidados.length > 0 || saldoDebito >= 2000)) {
    clasificacionAdmin = 'MEJOR_RENDIMIENTO';
  }

  // 2. Cálculo del rango máximo para asignación automática
  if (bloqueadoRedis || estatusKyc === 'RECHAZADO' || maxDiasAtraso > 0) {
    return {
      elegibleAutomatico: false,
      montoMinimo: 500,
      montoMaximoPermitido: 0,
      deudaActiva,
      maxDiasAtraso,
      score,
      clasificacionAdmin,
      prestamosConMora,
      motivoRegla: bloqueadoRedis
        ? 'Cuenta con bloqueo antifraude en Redis.'
        : estatusKyc === 'RECHAZADO'
          ? 'Expediente KYC rechazado en MongoDB.'
          : `Tienes un préstamo vencido con ${maxDiasAtraso} día(s) de atraso.`,
    };
  }

  const capacidadBruta = 1500 + saldoDebito * 2.5 + prestamosLiquidados.length * 2000;
  const factorKyc = estatusKyc === 'APROBADO' ? 1.0 : 0.4; // 100% si KYC aprobado, 40% si pendiente
  const factorSeguridad = Math.max(0.5, 1 - intentosFallidos * 0.15);

  const capacidadNeta = Math.min(50000, capacidadBruta * factorKyc * factorSeguridad) - deudaActiva;
  const montoMaximoPermitido = Math.max(0, Math.floor(capacidadNeta));

  return {
    elegibleAutomatico: montoMaximoPermitido >= 500,
    montoMinimo: 500,
    montoMaximoPermitido,
    deudaActiva,
    maxDiasAtraso,
    score,
    clasificacionAdmin,
    prestamosConMora,
    motivoRegla:
      estatusKyc === 'APROBADO'
        ? 'Línea completa habilitada (KYC aprobado + liquidez verificada).'
        : 'Línea acotada al 40% mientras tu expediente KYC sigue PENDIENTE.',
  };
};