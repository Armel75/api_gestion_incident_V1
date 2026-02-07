import { Router } from 'express';
import { RolePermissionController } from '../controllers/RolePermissionController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Authentication required for all operations
router.use(authenticate);

// Assign permission to a role
// POST /api/v1/role-permissions
// Body: { roleId, permissionId }
// Permission required: 'ROLE_UPDATE' (since modifying a role's capability is an update to the role)
router.post('/', requirePermission('ROLE_UPDATE'), RolePermissionController.assign);

// Revoke permission from a role
// DELETE /api/v1/role-permissions
// Body or Query: { roleId, permissionId }
router.delete('/', requirePermission('ROLE_UPDATE'), RolePermissionController.revoke);

// List permissions of a specific role
// GET /api/v1/role-permissions/roles/:roleId
router.get('/roles/:roleId', requirePermission('ROLE_READ'), RolePermissionController.getPermissionsByRole);

// List roles associated with a specific permission
// GET /api/v1/role-permissions/permissions/:permissionId
router.get('/permissions/:permissionId', requirePermission('ROLE_READ'), RolePermissionController.getRolesByPermission);

export default router;
