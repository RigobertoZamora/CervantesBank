import { Router } from 'express';
import {
  getResumenCuenta,
  getCuentas,
  createCuenta,
  updateCuenta,
  deleteCuenta,
} from '../controllers/cuentasController.js';
import { verificarSesion } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verificarSesion);

router.get('/resumen', getResumenCuenta);
router.get('/', getCuentas);
router.post('/', createCuenta);
router.patch('/:idCuenta', updateCuenta);
router.delete('/:idCuenta', deleteCuenta);

export default router;