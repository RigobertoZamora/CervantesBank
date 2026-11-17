import { Router } from 'express';
import { getActividad } from '../controllers/actividadController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', verificarSesion, getActividad);

export default router;
