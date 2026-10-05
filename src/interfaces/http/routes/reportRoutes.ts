import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Tous les utilisateurs connectés peuvent voir les rapports
// (chacun voit selon ses droits — le service filtre)
const REPORT_ROLES = ['ADMIN', 'EMPLOYE', 'MANAGER', 'CONTROLEUR'] as const;

router.get(
  '/weekly/available-weeks',
  requireRole(...REPORT_ROLES),
  ReportController.getAvailableWeeks,
);

router.get(
  '/weekly/current',
  requireRole(...REPORT_ROLES),
  ReportController.getWeeklyReport,
);

router.get(
  '/weekly',
  requireRole(...REPORT_ROLES),
  ReportController.getWeeklyReport,
);

router.post(
  '/weekly/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportPdf,
);

router.post(
  '/weekly/export/excel',
  requireRole(...REPORT_ROLES),
  ReportController.exportExcel,
);

router.post(
  '/statistics/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportStatisticsPdf,
);

router.post(
  '/pilotage/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportPilotagePdf,
);

// ── Monthly reports ──────────────────────────────────────────────────

router.get(
  '/monthly/available-months',
  requireRole(...REPORT_ROLES),
  ReportController.getAvailableMonths,
);

router.get(
  '/monthly/current',
  requireRole(...REPORT_ROLES),
  ReportController.getMonthlyReport,
);

router.get(
  '/monthly',
  requireRole(...REPORT_ROLES),
  ReportController.getMonthlyReport,
);

router.post(
  '/monthly/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportMonthlyPdf,
);

router.post(
  '/monthly/export/excel',
  requireRole(...REPORT_ROLES),
  ReportController.exportMonthlyExcel,
);

// ── Quarterly reports ──────────────────────────────────────────────────

router.get(
  '/quarterly/available-quarters',
  requireRole(...REPORT_ROLES),
  ReportController.getAvailableQuarters,
);

router.get(
  '/quarterly/current',
  requireRole(...REPORT_ROLES),
  ReportController.getQuarterlyReport,
);

router.get(
  '/quarterly',
  requireRole(...REPORT_ROLES),
  ReportController.getQuarterlyReport,
);

router.post(
  '/quarterly/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportQuarterlyPdf,
);

router.post(
  '/quarterly/export/excel',
  requireRole(...REPORT_ROLES),
  ReportController.exportQuarterlyExcel,
);

// ── Annual reports ──────────────────────────────────────────────────

router.get(
  '/annual/available-years',
  requireRole(...REPORT_ROLES),
  ReportController.getAvailableYears,
);

router.get(
  '/annual/current',
  requireRole(...REPORT_ROLES),
  ReportController.getAnnualReport,
);

router.get(
  '/annual',
  requireRole(...REPORT_ROLES),
  ReportController.getAnnualReport,
);

router.post(
  '/annual/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportAnnualPdf,
);

router.post(
  '/annual/export/excel',
  requireRole(...REPORT_ROLES),
  ReportController.exportAnnualExcel,
);

// ── SLA report (respect des délais) ───────────────────────────────

router.get(
  '/sla',
  requireRole(...REPORT_ROLES),
  ReportController.getSlaReport,
);

router.post(
  '/sla/export/pdf',
  requireRole(...REPORT_ROLES),
  ReportController.exportSlaPdf,
);

router.post(
  '/sla/export/excel',
  requireRole(...REPORT_ROLES),
  ReportController.exportSlaExcel,
);

export default router;
