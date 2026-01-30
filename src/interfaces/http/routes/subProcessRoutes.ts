import { Router } from 'express';
import { SubProcessController } from '../controllers/SubProcessController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('SUBPROCESS_CREATE'), SubProcessController.create);
router.get('/', requirePermission('SUBPROCESS_READ'), SubProcessController.getAll);
router.get('/:id', requirePermission('SUBPROCESS_READ'), SubProcessController.getById);
router.patch('/:id', requirePermission('SUBPROCESS_UPDATE'), SubProcessController.update);
router.delete('/:id', requirePermission('SUBPROCESS_DELETE'), SubProcessController.delete);

export default router;