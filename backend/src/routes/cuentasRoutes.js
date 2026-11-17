import { Router } from 'express';
import { getResumenCuenta } from '../controllers/cuentasController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/resumen', verificarSesion, getResumenCuenta);

export default router;
