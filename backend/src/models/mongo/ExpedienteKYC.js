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
  fechaCreacion: { type: Date, default: Date.now },
  fechaActualizacion: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

expedienteKYCSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

export default mongoose.model('ExpedienteKYC', expedienteKYCSchema);