import rateLimit from 'express-rate-limit';
import { Logger } from '../../../infrastructure/logging/Logger';

// Limiteur global pour l'API
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.'
  },
  handler: (req, res, next, options) => {
    Logger.warn(`Rate limit exceeded for IP ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});

// Limiteur strict pour le login (Brute-force protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  message: {
    status: 429,
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  handler: (req, res, next, options) => {
    const correlationId = (req as any).headers['x-correlation-id'];
    Logger.log({
      level: 'security',
      message: `Brute-force attempt blocked for IP ${req.ip}`,
      correlationId
    });
    res.status(options.statusCode).send(options.message);
  }
});
