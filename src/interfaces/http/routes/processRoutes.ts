import { Router } from 'express';
import { ProcessController } from '../controllers/ProcessController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('PROCESS_CREATE'), ProcessController.create);
router.get('/', requirePermission('PROCESS_READ'), ProcessController.getAll);
router.get('/:id', requirePermission('PROCESS_READ'), ProcessController.getById);
router.patch('/:id', requirePermission('PROCESS_UPDATE'), ProcessController.update);
router.delete('/:id', requirePermission('PROCESS_DELETE'), ProcessController.delete);

export default router;