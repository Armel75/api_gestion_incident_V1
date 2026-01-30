import { Router } from 'express';
import { SubCategoryController } from '../controllers/SubCategoryController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('SUBCATEGORY_CREATE'), SubCategoryController.create);
router.get('/', requirePermission('SUBCATEGORY_READ'), SubCategoryController.getAll);
router.get('/:id', requirePermission('SUBCATEGORY_READ'), SubCategoryController.getById);
router.patch('/:id', requirePermission('SUBCATEGORY_UPDATE'), SubCategoryController.update);
router.delete('/:id', requirePermission('SUBCATEGORY_DELETE'), SubCategoryController.delete);

export default router;