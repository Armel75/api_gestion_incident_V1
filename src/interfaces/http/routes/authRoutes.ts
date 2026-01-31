import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authLimiter } from '../middlewares/securityMiddleware';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', AuthController.register);
// Protection brute-force spécifiquement sur le login
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
// Session rehydration endpoint
router.get('/me', authenticate, AuthController.me);

export default router;