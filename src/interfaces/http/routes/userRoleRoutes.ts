import { Router } from 'express';
import { UserRoleController } from '../controllers/UserRoleController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Toutes les routes nécessitent d'être authentifié
router.use(authenticate);

// Assigner un rôle à un utilisateur
// POST /api/v1/user-roles { userId, roleId }
router.post('/', requirePermission('USER_ROLE_ASSIGN'), UserRoleController.assign);

// Retirer un rôle d'un utilisateur
// DELETE /api/v1/user-roles { userId, roleId }
router.delete('/', requirePermission('USER_ROLE_ASSIGN'), UserRoleController.revoke);

// Lister les rôles d'un utilisateur spécifique
// GET /api/v1/user-roles/users/:userId/roles
router.get('/users/:userId/roles', requirePermission('USER_ROLE_READ'), UserRoleController.getUserRoles);

// Lister les utilisateurs possédant un rôle spécifique
// GET /api/v1/user-roles/roles/:roleId/users
router.get('/roles/:roleId/users', requirePermission('USER_ROLE_READ'), UserRoleController.getRoleUsers);

export default router;
