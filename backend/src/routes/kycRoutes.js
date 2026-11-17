import { Router } from 'express';
import { verificarSesion } from '../middlewares/authMiddleware.js';
import {
  getExpedientesKYC,
  getExpedienteKYCByUsuario,
  createExpedienteKYC,
  updateExpedienteKYC,
  deleteExpedienteKYC,
} from '../controllers/kycController.js';

const router = Router();

router.use(verificarSesion);

router.get('/', getExpedientesKYC);
router.get('/:usuarioId', getExpedienteKYCByUsuario);
router.post('/', createExpedienteKYC);
router.patch('/:usuarioId', updateExpedienteKYC);
router.delete('/:usuarioId', deleteExpedienteKYC);

export default router;