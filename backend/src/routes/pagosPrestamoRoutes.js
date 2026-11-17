import { Router } from 'express';
import { getPrestamosPagables, pagarPrestamo } from '../controllers/pagosPrestamoController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', verificarSesion, getPrestamosPagables);
router.post('/', verificarSesion, pagarPrestamo);

export default router;
