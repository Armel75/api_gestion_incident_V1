import { Router } from 'express';
import { SiteTypeController } from '../controllers/SiteTypeController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('SITETYPE_CREATE'), SiteTypeController.create);
router.get('/', requirePermission('SITETYPE_READ'), SiteTypeController.getAll);
router.get('/:id', requirePermission('SITETYPE_READ'), SiteTypeController.getById);
router.put('/:id', requirePermission('SITETYPE_UPDATE'), SiteTypeController.update);
router.delete('/:id', requirePermission('SITETYPE_DELETE'), SiteTypeController.delete);

export default router;