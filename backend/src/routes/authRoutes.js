import { Router } from 'express';
import {
  loginUsuario,
  getPerfilAutenticado,
  logoutUsuario,
} from '../controllers/authController.js';

const router = Router();

router.post('/login', loginUsuario);
router.get('/me',  getPerfilAutenticado);
router.post('/logout', logoutUsuario);

export default router;