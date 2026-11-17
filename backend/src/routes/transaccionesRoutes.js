import { Router } from 'express';
import {
  getDetalleTransaccion,
  getTransacciones,
  createTransaccionAuditoria,
  updateTransaccionAuditoria,
  deleteTransaccionAuditoria,
} from '../controllers/transaccionesController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verificarSesion);

router.get('/', getTransacciones);
router.get('/:id', getDetalleTransaccion);
router.post('/', createTransaccionAuditoria);
router.patch('/:id', updateTransaccionAuditoria);
router.delete('/:id', deleteTransaccionAuditoria);

export default router;