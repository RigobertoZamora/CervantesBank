import { Router } from 'express';
import { cancelarCuenta } from '../controllers/cancelacionCuentaController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/cancelar', verificarSesion, cancelarCuenta);

export default router;
