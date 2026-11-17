import mongoose from 'mongoose';

const expedienteKYCSchema = new mongoose.Schema({
  usuarioId: { type: Number, required: true },
  estatusValidacion: {
    type: String,
    enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'],
    default: 'PENDIENTE',
  },
  observacionesAdmin: { type: String, default: '' },
  metadatosIdentificacion: { type: mongoose.Schema.Types.Mixed, required: true },
  historialDomicilios: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // Bitácora de accesos (login, intento fallido, logout); se alimenta desde authController
  historialAccesos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  fechaCreacion: { type: Date, default: Date.now },
  fechaActualizacion: { type: Date, default: Date.now },
  cancelacionCuenta: {
    solicitada: { type: Boolean, default: false }, motivo: { type: String, default: '' },
    detalle: { type: String, default: '' }, fecha: { type: Date, default: null },
    prioridadAtencion: { type: String, enum: ['NORMAL', 'ALTA'], default: 'NORMAL' },
  },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

expedienteKYCSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

export default mongoose.model('ExpedienteKYC', expedienteKYCSchema);