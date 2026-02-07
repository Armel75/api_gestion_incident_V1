import { Router } from 'express';
import { PermissionController } from '../controllers/PermissionController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Secure all routes
router.use(authenticate);

// CRUD Permissions
router.post('/', PermissionController.create);
router.get('/', PermissionController.getAll);
router.get('/:id', PermissionController.getById);
router.put('/:id', PermissionController.update);
router.delete('/:id', PermissionController.delete);

export default router;
