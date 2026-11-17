import { Router } from 'express';
import { verificarSesion, verificarAdmin } from '../middlewares/authMiddleware.js';
import {
  getResumenPoliglota,
  dictaminarKYC,
  gestionarEstadoCuenta,
  resolverApelacionPrestamo,
} from '../controllers/adminController.js';

const router = Router();

router.use(verificarSesion, verificarAdmin);

router.get('/resumen-poliglota', getResumenPoliglota);
router.patch('/kyc/:usuarioId', dictaminarKYC);
router.patch('/cuentas/:usuarioId/estado', gestionarEstadoCuenta);
router.patch('/apelaciones/:auditoriaId/resolver', resolverApelacionPrestamo);

export default router;