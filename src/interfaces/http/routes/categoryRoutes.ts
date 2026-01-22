import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('CATEGORY_CREATE'), CategoryController.create);
router.get('/', requirePermission('CATEGORY_READ'), CategoryController.getAll);
router.get('/:id', requirePermission('CATEGORY_READ'), CategoryController.getById);
router.patch('/:id', requirePermission('CATEGORY_UPDATE'), CategoryController.update);
router.delete('/:id', requirePermission('CATEGORY_DELETE'), CategoryController.delete);

export default router;