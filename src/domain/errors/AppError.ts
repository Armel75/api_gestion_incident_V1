export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'RESOURCE_NOT_FOUND');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', code: string = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  public readonly details: any;

  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * Erreur métier : le moteur de génération PDF (Chromium/Playwright)
 * est indisponible sur le serveur (non installé, corrompu, échec au
 * lancement). Permet aux contrôleurs d'exports PDF de renvoyer un
 * message clair au lieu d'un 500 générique.
 */
export class PdfUnavailableError extends AppError {
  constructor(message: string = 'Export PDF indisponible : le moteur de génération (Chromium) est absent ou ne peut pas démarrer sur le serveur. Contactez l’administrateur.') {
    super(message, 503, 'PDF_ENGINE_UNAVAILABLE');
  }
}
