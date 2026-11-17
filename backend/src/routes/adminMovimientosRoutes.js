import { Router } from 'express';
import { getDetalleMovimientoAdmin, getMovimientosAdmin } from '../controllers/adminMovimientosController.js';
import { verificarAdmin, verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

// Solo el administrador único: 401 sin sesión, 403 si no es admin.
router.use(verificarSesion, verificarAdmin);

router.get('/', getMovimientosAdmin);
router.get('/:id', getDetalleMovimientoAdmin);

export default router;
