import mongoose from 'mongoose';

const auditoriaTransaccionSchema = new mongoose.Schema({
  cuentaOrigenId: { type: Number, required: true },
  cuentaDestinoId: { type: Number, default: null },
  tipoMovimiento: {
    type: String,
    enum: ['TRANSFERENCIA', 'PAGO_PRESTAMO', 'DEPOSITO', 'INTERES_PRESTAMO', 'INGRESO_PRESTAMO', 'SOLICITUD_PRESTAMO'], // Nuevo: registra solicitudes rechazadas o en apelación
    required: true,
  },
  monto: { type: Number, required: true },
  estatus: { type: String, enum: ['EXITOSA', 'RECHAZADA' , 'EN_APELACION'], default: 'EXITOSA' }, // Nuevo: cola prioritaria para el Admin 
  fechaCreacion: { type: Date, default: Date.now },
  fechaActualizacion: { type: Date, default: Date.now },
  payloadCompleto: { type: mongoose.Schema.Types.Mixed, required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

auditoriaTransaccionSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

export default mongoose.model('AuditoriaTransaccion', auditoriaTransaccionSchema);