import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';

const MAX_ACCESOS_GUARDADOS = 50;

// Guarda un evento de acceso (login, intento fallido, logout) en el ExpedienteKYC (MongoDB).
// Nunca debe romper el flujo de autenticación: si falla, solo se registra en consola.
export const registrarAcceso = async (usuarioId, { accion, motivo = '', ipSospechosa = '', dispositivo = '', fechaEvento }) => {
  try {
    await ExpedienteKYC.updateOne(
      { usuarioId: Number(usuarioId), isDeleted: false },
      {
        $push: {
          historialAccesos: {
            $each: [
              {
                accion,
                motivo,
                ip: ipSospechosa,
                dispositivo,
                fecha: fechaEvento || new Date().toISOString(),
              },
            ],
            $slice: -MAX_ACCESOS_GUARDADOS,
          },
        },
      }
    );
  } catch (error) {
    console.error('No se pudo registrar el acceso en el expediente:', error.message);
  }
};
