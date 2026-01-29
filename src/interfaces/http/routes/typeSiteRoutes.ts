import { Router } from 'express';
import { TypeSiteController } from '../controllers/TypeSiteController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('TYPESITE_CREATE'), TypeSiteController.create);
router.get('/', requirePermission('TYPESITE_READ'), TypeSiteController.getAll);
router.get('/:id', requirePermission('TYPESITE_READ'), TypeSiteController.getById);
router.put('/:id', requirePermission('TYPESITE_UPDATE'), TypeSiteController.update);
router.delete('/:id', requirePermission('TYPESITE_DELETE'), TypeSiteController.delete);

export default router;
