import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authMiddleware";
import { GLPITicketController } from "../controllers/GLPITicketController";
import { GlpiTicketExportController } from "../controllers/GlpiTicketExportController";

const router = Router();

router.use(authenticate);

router.post(
  "/query",
  requireRole("ADMIN", "MANAGER", "EMPLOYE", "CONTROLEUR"),
  GLPITicketController.query
);

router.post(
  "/export/pdf",
  requireRole("ADMIN", "MANAGER", "EMPLOYE", "CONTROLEUR"),
  GlpiTicketExportController.exportPdf
);

router.post(
  "/export/excel",
  requireRole("ADMIN", "MANAGER", "EMPLOYE", "CONTROLEUR"),
  GlpiTicketExportController.exportExcel
);

export default router;
