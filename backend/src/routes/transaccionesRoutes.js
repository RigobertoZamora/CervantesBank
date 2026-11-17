import { Router } from 'express';
import { getDetalleTransaccion, getTransacciones } from '../controllers/transaccionesController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', verificarSesion, getTransacciones);
router.get('/:id', verificarSesion, getDetalleTransaccion);

export default router;
