import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('USER_READ'), UserController.getAll);
router.get('/:id', requirePermission('USER_READ'), UserController.getById);
router.patch('/:id', requirePermission('USER_UPDATE'), UserController.update);
router.delete('/:id', requirePermission('USER_DELETE'), UserController.delete);

export default router;