import { Router } from 'express';
import { verificarSesion } from '../middlewares/authMiddleware.js';
import {
  getAntifraudeTodos,
  getAntifraudeByUsuario,
  createAntifraude,
  updateAntifraude,
  deleteAntifraude,
} from '../controllers/antifraudeController.js';

const router = Router();

router.use(verificarSesion);

router.get('/', getAntifraudeTodos);
router.get('/:usuarioId', getAntifraudeByUsuario);
router.post('/:usuarioId', createAntifraude);
router.patch('/:usuarioId', updateAntifraude);
router.delete('/:usuarioId', deleteAntifraude);

export default router;