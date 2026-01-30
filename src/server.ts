import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import incidentRoutes from './interfaces/http/routes/incidentRoutes';
import authRoutes from './interfaces/http/routes/authRoutes';
import siteRoutes from './interfaces/http/routes/siteRoutes';
import siteTypeRoutes from './interfaces/http/routes/siteTypeRoutes';
import userRoutes from './interfaces/http/routes/userRoutes';
import taskRoutes from './interfaces/http/routes/taskRoutes';
import processRoutes from './interfaces/http/routes/processRoutes';
import categoryRoutes from './interfaces/http/routes/categoryRoutes';
import subCategoryRoutes from './interfaces/http/routes/subCategoryRoutes';
import subProcessRoutes from './interfaces/http/routes/subProcessRoutes';
import { errorHandler } from './interfaces/http/middlewares/errorHandler';
import { correlationMiddleware } from './interfaces/http/middlewares/correlationMiddleware';
import { requestLogger, auditLogger } from './interfaces/http/middlewares/loggingMiddleware';
import { globalLimiter } from './interfaces/http/middlewares/securityMiddleware';
import { HealthController } from './interfaces/http/controllers/HealthController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Security Headers (Helmet) - Always first
app.use(helmet() as any);

// 2. CORS - Configurable via ENV (Best Practice)
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
};
app.use(cors(corsOptions) as any);

// 3. Global Rate Limiter (Prevent DoS)
app.use(globalLimiter);

// 4. Infrastructure Middlewares
app.use(correlationMiddleware); // Must be before logger to attach ID
app.use(express.json() as any); // Body parser
app.use(requestLogger); // Log incoming requests

// 5. Public Routes (Health/Ready)
app.get('/health', HealthController.health);
app.get('/ready', HealthController.ready);

// 6. API Routes
// Audit Logger is applied here to capture modifications on authenticated routes
app.use('/api/v1', auditLogger); 

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/sites', siteRoutes);
app.use('/api/v1/site-types', siteTypeRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/processes', processRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/sub-categories', subCategoryRoutes);
app.use('/api/v1/sub-processes', subProcessRoutes);

// 404 Handler - Forward to error handler
app.use((req, res, next) => {
    const error: any = new Error('Endpoint not found');
    error.statusCode = 404;
    error.code = 'RESOURCE_NOT_FOUND';
    next(error);
});

// Global Error Handler (Must be last)
app.use(errorHandler as any);

app.listen(PORT, () => {
  // Use console.log directly here as Logger might not be initialized with context yet
  console.log(`Server running on port ${PORT}`);
});