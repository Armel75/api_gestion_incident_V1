import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';

import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { 
  GetAllUsersUseCase, 
  GetUserUseCase,
  UpdateUserUseCase, 
  DeleteUserUseCase 
} from '../../../application/usecases/UserUseCases';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors/AppError';

const updateSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  matricule: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.number().int()).optional(),
  siteId: z.number().int().nullable().optional() // ✅ AJOUT
});

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  matricule: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.number().int()).optional(),
  siteId: z.number().int().nullable().optional() // ✅ AJOUT
});

export class UserController {

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaUserRepository();
      const useCase = new GetAllUsersUseCase(repo);

      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      // En recherche : on retourne tous les résultats (pas de limite de page),
      // pour que le champ couvre bien toute la table.
      const skip = search ? undefined : (Number(req.query.skip) || 0);
      const take = search ? undefined : (Number(req.query.take) || 20);

      const users = await useCase.execute(skip, take, search || undefined);

      const safeUsers = users.map(({ password, ...rest }) => rest);

      return res.json(safeUsers);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid user id'
        });
      }

      const repo = new PrismaUserRepository();
      const useCase = new GetUserUseCase(repo);

      const user = await useCase.execute(id);
      if (!user) throw new NotFoundError('User not found');

      const { password, ...rest } = user;
      return res.json(rest);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);

      const data = updateSchema.parse(req.body);

      const repo = new PrismaUserRepository();
      const useCase = new UpdateUserUseCase(repo);

      const user = await useCase.execute(id, data);

      return res.json(user);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid user id'
        });
      }

      const repo = new PrismaUserRepository();
      const useCase = new DeleteUserUseCase(repo);

      await useCase.execute(id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createUserSchema.parse(req.body);

      const repo = new PrismaUserRepository();
      const user = await repo.create(data);

      return res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Champs manquants.' });
      }

      // Vérifie que l'utilisateur connecté correspond à l'id demandé
      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ message: 'Accès refusé.' });
      }

      const repo = new PrismaUserRepository();
      const user = await repo.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé.' });
      }

      // Vérification du mot de passe actuel
      const userAuth = await repo.findAuthUserByUsername(user.username);
      const bcrypt = require('bcrypt');
      if (!userAuth || !(await bcrypt.compare(currentPassword, userAuth.passwordHash))) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });
      }

      // Mise à jour du mot de passe
      await repo.update(id, { password: newPassword });
      return res.status(200).json({ message: 'Mot de passe changé avec succès.' });
    } catch (error) {
      next(error);
    }
  }

  // Changement de mot de passe par un admin (sans ancien mot de passe)
  static async adminSetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: 'Nouveau mot de passe requis (min 6 caractères).' });
      }
      const repo = new PrismaUserRepository();
      const user = await repo.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé.' });
      }
      await repo.update(id, { password: newPassword });
      return res.status(200).json({ message: 'Mot de passe changé avec succès.' });
    } catch (error) {
      next(error);
    }
  }

}
