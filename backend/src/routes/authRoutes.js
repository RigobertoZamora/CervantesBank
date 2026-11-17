import { Router } from 'express';
import {
  loginUsuario,
  getPerfilAutenticado,
  logoutUsuario,
} from '../controllers/authController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/login', loginUsuario);
router.get('/me', verificarSesion, getPerfilAutenticado);
router.post('/logout', verificarSesion, logoutUsuario);

export default router;