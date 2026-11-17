import { Router } from 'express';
import { consultarBeneficiario, realizarTransferencia } from '../controllers/transferenciasController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();
router.get('/beneficiario', verificarSesion, consultarBeneficiario);
router.post('/', verificarSesion, realizarTransferencia);
export default router;
