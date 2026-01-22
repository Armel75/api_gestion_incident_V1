import { Router } from 'express';
import { IncidentController } from '../controllers/IncidentController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('INCIDENT_CREATE'), IncidentController.create);
router.get('/', requirePermission('INCIDENT_READ'), IncidentController.getAll);
router.get('/:id', requirePermission('INCIDENT_READ'), IncidentController.getById);
router.put('/:id', requirePermission('INCIDENT_UPDATE'), IncidentController.update);
router.delete('/:id', requirePermission('INCIDENT_DELETE'), IncidentController.delete);

export default router;