import { Router } from 'express';
import { verificarSesion } from '../middlewares/authMiddleware.js';
import {
  getEvaluacionYHistorial,
  solicitarPrestamo,
  apelarPrestamo,
} from '../controllers/prestamosController.js';

const router = Router();

router.use(verificarSesion);

router.get('/evaluacion', getEvaluacionYHistorial);
router.post('/solicitar', solicitarPrestamo);
router.patch('/:auditoriaId/apelar', apelarPrestamo);

export default router;