import { Router } from 'express';
import { RoleController } from '../controllers/RoleController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Secure all routes
router.use(authenticate);

// CRUD Roles
router.post('/', RoleController.create);
router.get('/', RoleController.getAll);
router.get('/:id', RoleController.getById);
router.put('/:id', RoleController.update);
router.delete('/:id', RoleController.delete);

// Role Permission Management
// POST /roles/:id/permissions { permissionId }
router.post('/:id/permissions', RoleController.assignPermission);
// DELETE /roles/:id/permissions/:permissionId
router.delete('/:id/permissions/:permissionId', RoleController.revokePermission);
// GET /roles/:id/permissions
router.get('/:id/permissions', RoleController.getPermissions);

export default router;
