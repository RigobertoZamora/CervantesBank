import redisClient from '../../config/redis.js';

const PREFIX = 'fraude:cuenta:';

export const BloqueoAntifraudeModel = {
  async getAll() {
    const keys = await redisClient.keys(`${PREFIX}*`);
    const resultados = [];
    for (const key of keys) {
      const raw = await redisClient.get(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (!data.isDeleted) resultados.push(data);
      }
    }
    return resultados;
  },

  async getByCuentaId(cuentaId) {
    const raw = await redisClient.get(`${PREFIX}${cuentaId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.isDeleted ? null : data;
  },

  
  async save(cuentaId, payload) {
    const registro = {
      cuentaId: Number(cuentaId),

      // Control antifraude
      intentosFallidos: payload.intentosFallidos ?? 0,
      bloqueado: payload.bloqueado ?? false,

      // Control de sesión JWT
      tokenJti: payload.tokenJti ?? '',
      sesionActiva: payload.sesionActiva ?? false,

      // Información del evento
      accion: payload.accion || 'SIN_ACCION',
      motivo: payload.motivo || 'Actividad sospechosa',
      ipSospechosa: payload.ipSospechosa || '0.0.0.0',
      dispositivo: payload.dispositivo || 'Desconocido',
      fechaEvento: payload.fechaEvento || new Date().toISOString(),

      fechaActualizacion: new Date().toISOString(),
      isDeleted: false,
    };

    await redisClient.set(
      `${PREFIX}${cuentaId}`,
      JSON.stringify(registro)
    );

    return registro;
  },


  async softDelete(cuentaId) {
    const raw = await redisClient.get(`${PREFIX}${cuentaId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.isDeleted = true;
    data.fechaActualizacion = new Date().toISOString();
    await redisClient.set(`${PREFIX}${cuentaId}`, JSON.stringify(data));
    return data;
  },
};