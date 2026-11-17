import { Router } from 'express';
import { verificarSesion } from '../middlewares/authMiddleware.js';
import {
  getEvaluacionYHistorial,
  getPrestamos,
  solicitarPrestamo,
  apelarPrestamo,
  updatePrestamo,
  deletePrestamo,
} from '../controllers/prestamosController.js';

const router = Router();

router.use(verificarSesion);

router.get('/', getPrestamos);
router.get('/evaluacion', getEvaluacionYHistorial);
router.post('/', solicitarPrestamo);
router.post('/solicitar', solicitarPrestamo);
router.patch('/:auditoriaId/apelar', apelarPrestamo);
router.patch('/:idPrestamo', updatePrestamo);
router.delete('/:idPrestamo', deletePrestamo);

export default router;