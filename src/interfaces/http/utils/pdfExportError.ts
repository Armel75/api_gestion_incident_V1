import { Response } from "express";
import { AppError } from "../../../domain/errors/AppError";

/**
 * Helper pour les contrôleurs d'export PDF.
 * - Si l'erreur est une AppError métier (ex: PdfUnavailableError), on renvoie
 *   sa réponse structurée avec son code/statut (message clair pour l'utilisateur).
 * - Sinon, on renvoie le message d'erreur générique du contexte (fallback).
 */
export function respondPdfError(
  res: Response,
  error: unknown,
  fallbackMessage: string
): Response {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}
