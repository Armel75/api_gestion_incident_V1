import { Router } from 'express';
import { TaskController } from '../controllers/TaskController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('TASK_CREATE'), TaskController.create);
router.get('/', requirePermission('TASK_READ'), TaskController.getAll);
router.get('/:id', requirePermission('TASK_READ'), TaskController.getById);
router.patch('/:id', requirePermission('TASK_UPDATE'), TaskController.update);
router.delete('/:id', requirePermission('TASK_DELETE'), TaskController.delete);

export default router;