import ExpedienteKYC from '../models/mongo/ExpedienteKYC.js';

// GET /api/kyc -> Lista expedientes KYC activos en MongoDB
export const getExpedientesKYC = async (req, res) => {
  try {
    const filtro =
      Number(req.user.isAdmin) === 1
        ? { isDeleted: false }
        : { usuarioId: Number(req.user.id), isDeleted: false };

    const expedientes = await ExpedienteKYC.find(filtro).sort({ createdAt: -1 });
    res.status(200).json(expedientes);
  } catch (error) {
    console.error('Error en getExpedientesKYC:', error);
    res.status(500).json({ error: 'Error al consultar expedientes KYC.' });
  }
};

// GET /api/kyc/:usuarioId -> Consulta el expediente KYC de un usuario
export const getExpedienteKYCByUsuario = async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    if (Number(req.user.isAdmin) !== 1 && usuarioId !== Number(req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para ver este expediente.' });
    }

    const expediente = await ExpedienteKYC.findOne({ usuarioId, isDeleted: false });
    if (!expediente) {
      return res.status(404).json({ error: 'Expediente KYC no encontrado.' });
    }
    res.status(200).json(expediente);
  } catch (error) {
    console.error('Error en getExpedienteKYCByUsuario:', error);
    res.status(500).json({ error: 'Error al consultar el expediente KYC.' });
  }
};

// POST /api/kyc -> Crea o reactiva un expediente KYC en MongoDB
export const createExpedienteKYC = async (req, res) => {
  try {
    const usuarioId =
      Number(req.user.isAdmin) === 1 && req.body.usuarioId
        ? Number(req.body.usuarioId)
        : Number(req.user.id);

    const existente = await ExpedienteKYC.findOne({ usuarioId, isDeleted: false });
    if (existente) {
      return res.status(409).json({ error: 'El usuario ya cuenta con un expediente KYC activo.' });
    }

    const tipoDocumento =
      req.body.metadatosIdentificacion?.tipoDocumento === 'PASAPORTE' ? 'PASAPORTE' : 'INE';
    const numeroDocumento =
      typeof req.body.metadatosIdentificacion?.numeroDocumento === 'string'
        ? req.body.metadatosIdentificacion.numeroDocumento.replace(/[<>]/g, '').trim().slice(0, 30)
        : 'PENDIENTE_FOLIO';

    const nuevo = await ExpedienteKYC.create({
      usuarioId,
      estatusValidacion: 'PENDIENTE',
      observacionesAdmin: 'Expediente creado manualmente.',
      metadatosIdentificacion: { tipoDocumento, numeroDocumento },
      historialDomicilios: Array.isArray(req.body.historialDomicilios)
        ? req.body.historialDomicilios
        : [],
      isDeleted: false,
    });

    res.status(201).json({ mensaje: 'Expediente KYC creado en MongoDB.', expediente: nuevo });
  } catch (error) {
    console.error('Error en createExpedienteKYC:', error);
    res.status(500).json({ error: 'Error al crear expediente KYC.' });
  }
};

// PATCH /api/kyc/:usuarioId -> Actualiza metadatos o dictamen del expediente KYC
export const updateExpedienteKYC = async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    if (Number(req.user.isAdmin) !== 1 && usuarioId !== Number(req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para editar este expediente.' });
    }

    const expediente = await ExpedienteKYC.findOne({ usuarioId, isDeleted: false });
    if (!expediente) {
      return res.status(404).json({ error: 'Expediente KYC no encontrado.' });
    }

    if (req.body.metadatosIdentificacion) {
      const { tipoDocumento, numeroDocumento } = req.body.metadatosIdentificacion;
      if (['INE', 'PASAPORTE'].includes(tipoDocumento)) {
        expediente.metadatosIdentificacion.tipoDocumento = tipoDocumento;
      }
      if (typeof numeroDocumento === 'string' && numeroDocumento.trim()) {
        expediente.metadatosIdentificacion.numeroDocumento = numeroDocumento
          .replace(/[<>]/g, '')
          .trim()
          .slice(0, 30);
      }
    }

    if (
      Number(req.user.isAdmin) === 1 &&
      ['APROBADO', 'RECHAZADO', 'PENDIENTE'].includes(req.body.estatusValidacion)
    ) {
      expediente.estatusValidacion = req.body.estatusValidacion;
    }

    if (Number(req.user.isAdmin) === 1 && typeof req.body.observacionesAdmin === 'string') {
      expediente.observacionesAdmin = req.body.observacionesAdmin.replace(/[<>]/g, '').trim();
    }

    expediente.fechaActualizacion = new Date();
    await expediente.save();

    res.status(200).json({ mensaje: 'Expediente KYC actualizado.', expediente });
  } catch (error) {
    console.error('Error en updateExpedienteKYC:', error);
    res.status(500).json({ error: 'Error al actualizar expediente KYC.' });
  }
};

// DELETE /api/kyc/:usuarioId -> Borrado lógico en MongoDB
export const deleteExpedienteKYC = async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    if (Number(req.user.isAdmin) !== 1 && usuarioId !== Number(req.user.id)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este expediente.' });
    }

    const expediente = await ExpedienteKYC.findOneAndUpdate(
      { usuarioId, isDeleted: false },
      { isDeleted: true, fechaActualizacion: new Date() },
      { new: true }
    );

    if (!expediente) {
      return res.status(404).json({ error: 'Expediente KYC no encontrado o ya eliminado.' });
    }

    res.status(200).json({
      mensaje: `Expediente KYC del usuario #${usuarioId} marcado como borrado lógicamente.`,
    });
  } catch (error) {
    console.error('Error en deleteExpedienteKYC:', error);
    res.status(500).json({ error: 'Error al eliminar expediente KYC.' });
  }
};