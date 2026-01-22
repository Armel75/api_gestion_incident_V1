import { Router } from 'express';
import { SiteController } from '../controllers/SiteController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('SITE_CREATE'), SiteController.create);
router.get('/', requirePermission('SITE_READ'), SiteController.getAll);
router.get('/:id', requirePermission('SITE_READ'), SiteController.getById);
router.patch('/:id', requirePermission('SITE_UPDATE'), SiteController.update);
router.delete('/:id', requirePermission('SITE_DELETE'), SiteController.delete);

export default router;