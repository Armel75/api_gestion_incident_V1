import { Request, Response } from 'express';
import { WeeklyReportService } from '../../../services/WeeklyReportService';
import { MonthlyReportService } from '../../../services/MonthlyReportService';
import { QuarterlyReportService } from '../../../services/QuarterlyReportService';
import { AnnualReportService } from '../../../services/AnnualReportService';
import { SlaReportService } from '../../../services/SlaReportService';
import { IncidentService } from '../../../services/IncidentService';
import { IncidentPdfService } from '../../../domain/services/IncidentPdfService';
import { buildReportWorkbook, ReportExcelOptions } from '../../../services/ReportExcelService';
import { buildSlaWorkbook } from '../../../services/SlaReportExcel';
import { respondPdfError } from '../utils/pdfExportError';
import prisma from '../../../infrastructure/database/prisma';
import path from 'path';
import fs from 'fs/promises';

const monthlyReportService = new MonthlyReportService();
const quarterlyReportService = new QuarterlyReportService();
const annualReportService = new AnnualReportService();
const slaReportService = new SlaReportService();

/* ------------------------------------------------------------------ */
/*  Helpers rôles (copie depuis IncidentController)                    */
/* ------------------------------------------------------------------ */

function hasAdminLikeAccess(user: any): boolean {
  return (
    user?.roles?.some((r: any) =>
      typeof r === 'string'
        ? r === 'ADMIN' || r === 'MANAGER' || r === 'CONTROLEUR'
        : r?.name === 'ADMIN' ||
          r?.role?.name === 'ADMIN' ||
          r?.name === 'MANAGER' ||
          r?.role?.name === 'MANAGER' ||
          r?.name === 'CONTROLEUR' ||
          r?.role?.name === 'CONTROLEUR'
    ) ?? false
  );
}

function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Résout une période { from, to, label } en bornes Date (fermeture fin de journée). */
function resolveSlaRange(body: any): { start: Date; end: Date; label: string } | null {
  const from = body?.from as string | undefined;
  const to = body?.to as string | undefined;
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: (body?.label as string | undefined) || `${formatDateFr(from)} → ${formatDateFr(to)}`,
  };
}

const reportService = new WeeklyReportService();

export class ReportController {
  /**
   * GET /api/v1/reports/weekly/available-weeks
   * Renvoie la liste des semaines disponibles dans l'historique.
   */
  static async getAvailableWeeks(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const weeks = await reportService.getAvailableWeeks({
        id: dbUser.id,
        roles,
        siteId: dbUser.siteId ?? undefined,
      });

      return res.json(weeks);
    } catch (error) {
      console.error('[REPORT] getAvailableWeeks error:', error);
      return res.status(500).json({ message: 'Erreur récupération semaines' });
    }
  }

  /**
   * GET /api/v1/reports/weekly?week=2026-W30
   * GET /api/v1/reports/weekly/current
   * Renvoie les données JSON du rapport pour visualisation.
   */
  static async getWeeklyReport(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      // Si le paramètre week est présent, extraire semaine/année
      const weekParam = req.query.week as string | undefined;
      let result;

      if (weekParam) {
        // Format: "2026-W30"
        const match = weekParam.match(/^(\d{4})-W(\d{1,2})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de semaine invalide. Utiliser YYYY-Www (ex: 2026-W30)' });
        }
        const year = parseInt(match[1], 10);
        const week = parseInt(match[2], 10);
        result = await reportService.getWeeklyReport(week, year, user);
      } else {
        // Semaine courante par défaut
        result = await reportService.getCurrentWeekReport(user);
      }

      return res.json(result);
    } catch (error) {
      console.error('[REPORT] getWeeklyReport error:', error);
      return res.status(500).json({ message: 'Erreur récupération rapport' });
    }
  }

  /**
   * POST /api/v1/reports/weekly/export/pdf
   * Body: { week?: "2026-W30" } — si omis, semaine courante
   */
  static async exportPdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const weekParam = req.body?.week as string | undefined;
      let data;

      if (weekParam) {
        const match = weekParam.match(/^(\d{4})-W(\d{1,2})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de semaine invalide' });
        }
        data = await reportService.getWeeklyReport(parseInt(match[2], 10), parseInt(match[1], 10), user);
      } else {
        data = await reportService.getCurrentWeekReport(user);
      }

      // ── Génération HTML depuis le template ──
      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      const templatePath = path.join(TEMPLATE_DIR, 'weekly-report.html');
      const logoPath = path.join(ASSETS_DIR, 'logo.png');

      let template: string;
      try {
        template = await fs.readFile(templatePath, 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de rapport introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      // ── Helper pour les barres de progression ──
      const barWidth = (rate: number | null): string => {
        if (rate === null) return '0';
        return String(Math.min(rate, 100));
      };

      // ── Builder le contenu ──
      const kpi = data.kpi;
      const comparison = data.comparison;

      const renderChange = (value: number | null, unit: string, inverse = false): string => {
        if (value === null) return '<span class="neutral">—</span>';
        const abs = Math.abs(value);
        const formatted = unit === 'pts'
          ? `${abs.toFixed(1)} pts`
          : `${abs.toFixed(1)}%`;
        if (Math.abs(value) < 0.01) return `<span class="neutral">→ ${formatted}</span>`;
        const isPositive = inverse ? value < 0 : value > 0;
        if (isPositive) {
          return `<span class="good">▲ ${formatted}</span>`;
        }
        return `<span class="bad">▼ ${formatted}</span>`;
      };

      // Taux de résolution affiché
      const displayRate = kpi.resolutionRate !== null ? `${kpi.cappedRate.toFixed(1)}%` : 'N/A';
      const extraNote = kpi.extraResolvedFromStock > 0
        ? `<p class="note">Dont ${kpi.extraResolvedFromStock} résolu(s) d'anciens stocks</p>`
        : '';

      // Services rows
      const serviceRows = data.byService.length
        ? data.byService.map((s) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.created}</td>
            <td class="num">${s.resolved}</td>
            <td class="num">${s.rate !== null ? `${s.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(s.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée cette semaine</td></tr>';

      // Priority rows
      const priorityRows = data.byPriority.length
        ? data.byPriority.map((p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.created}</td>
            <td class="num">${p.resolved}</td>
            <td class="num">${p.rate !== null ? `${p.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(p.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée cette semaine</td></tr>';

      // Trend rows
      const trendRows = data.dailyTrend.map((d) => `
        <tr>
          <td>${escapeHtml(d.dayLabel)}</td>
          <td class="num">${d.created}</td>
          <td class="num">${d.resolved}</td>
          <td class="num">
            <div class="mini-bar">
              <div class="bar-created" style="width:${d.created > 0 ? Math.max(2, (d.created / Math.max(...data.dailyTrend.map((x) => x.created), 1)) * 100) : 0}%"></div>
              <div class="bar-resolved" style="width:${d.resolved > 0 ? Math.max(2, (d.resolved / Math.max(...data.dailyTrend.map((x) => x.resolved), 1)) * 100) : 0}%"></div>
            </div>
          </td>
        </tr>`).join('');

      // Comparison rows
      const comparisonRows = comparison
        ? `
        <tr>
          <td>Créés</td>
          <td class="num">${kpi.created}</td>
          <td class="num">${comparison.previousWeek.created}</td>
          <td class="num">${renderChange(comparison.createdChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Résolus</td>
          <td class="num">${kpi.resolved}</td>
          <td class="num">${comparison.previousWeek.resolved}</td>
          <td class="num">${renderChange(comparison.resolvedChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Taux de résolution</td>
          <td class="num">${displayRate}</td>
          <td class="num">${comparison.previousWeek.resolutionRate !== null ? `${comparison.previousWeek.cappedRate.toFixed(1)}%` : 'N/A'}</td>
          <td class="num">${renderChange(comparison.resolutionRateChange, 'pts')}</td>
        </tr>
        <tr>
          <td>Incidents en cours (fin)</td>
          <td class="num">${kpi.backlogEnd}</td>
          <td class="num">${comparison.previousWeek.backlogEnd}</td>
          <td class="num">${renderChange(comparison.backlogEndChange, 'pct', true)}</td>
        </tr>
        <tr>
          <td>Tps moy. résolution</td>
          <td class="num">${kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${comparison.previousWeek.avgResolutionHours !== null ? `${comparison.previousWeek.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${renderChange(comparison.avgResolutionChange, 'pct', true)}</td>
        </tr>`
        : '<tr><td colspan="4" class="empty">Semaine précédente non disponible</td></tr>';

      let html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(data.period.label))
        .replace(/{{PERIOD_START}}/g, formatDateFr(data.period.startDate))
        .replace(/{{PERIOD_END}}/g, formatDateFr(data.period.endDate))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_CREATED}}', String(kpi.created))
        .replace('{{KPI_RESOLVED}}', String(kpi.resolved))
        .replace('{{KPI_RATE}}', displayRate)
        .replace('{{KPI_EXTRA_NOTE}}', extraNote)
        .replace('{{KPI_BACKLOG_START}}', String(kpi.backlogStart))
        .replace('{{KPI_BACKLOG_END}}', String(kpi.backlogEnd))
        .replace('{{KPI_AVG_RES}}', kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—')
        .replace('{{KPI_AVG_TIC}}', kpi.avgTakeInChargeHours !== null ? `${kpi.avgTakeInChargeHours.toFixed(1)} h` : '—')
        .replace('{{SERVICE_ROWS}}', serviceRows)
        .replace('{{PRIORITY_ROWS}}', priorityRows)
        .replace('{{TREND_ROWS}}', trendRows)
        .replace('{{COMPARISON_ROWS}}', comparisonRows);

      // ── Incident rows ──
      const statusLabels: Record<string, string> = {
        OPEN: 'Ouvert', IN_PROGRESS: 'En cours', RESOLVED: 'Résolu',
        CLOSED: 'Clôturé', CANCELLED: 'Annulé',
      };
      const incidentRows = Array.isArray(data.incidents) && data.incidents.length
        ? data.incidents.map((inc: any) => {
            const statusLabel = statusLabels[inc.status] || inc.status;
            return `
            <tr>
              <td><strong>${escapeHtml(inc.reference)}</strong></td>
              <td class="desc-cell">${escapeHtml(inc.description)}</td>
              <td><span class="status-badge status-${inc.status}">${escapeHtml(statusLabel)}</span></td>
              <td class="num ${`prio-${inc.priority}`}">${escapeHtml(inc.priority)}</td>
              <td>${escapeHtml(inc.serviceEmetteur)}</td>
              <td>${escapeHtml(inc.serviceRecepteur)}</td>
              <td class="num">${escapeHtml(inc.createdAt)}</td>
              <td class="desc-cell">${inc.rootCause ? escapeHtml(inc.rootCause) : '<span class="text-muted">—</span>'}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="8" class="empty">Aucun incident créé cette semaine</td></tr>';

      html = html.replace('{{INCIDENT_ROWS}}', incidentRows);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `rapport_hebdo_${data.period.startDate}_${data.period.endDate}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF');
    }
  }

  /**
   * POST /api/v1/reports/weekly/export/excel
   * Body: { week?: "2026-W30" } — si omis, semaine courante
   */
  static async exportExcel(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const weekParam = req.body?.week as string | undefined;
      let data;

      if (weekParam) {
        const match = weekParam.match(/^(\d{4})-W(\d{1,2})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de semaine invalide' });
        }
        data = await reportService.getWeeklyReport(parseInt(match[2], 10), parseInt(match[1], 10), user);
      } else {
        data = await reportService.getCurrentWeekReport(user);
      }

      const options: ReportExcelOptions = {
        sheetTitle: 'Rapport Hebdomadaire',
        reportTitle: 'RAPPORT HEBDOMADAIRE',
        periodLabel: data.period.label,
        periodStart: data.period.startDate,
        periodEnd: data.period.endDate,
        kpi: data.kpi,
        byService: data.byService,
        byPriority: data.byPriority,
        trendTitle: 'Tendance journalière',
        trend: data.dailyTrend.map((d) => ({
          label: d.dayLabel,
          created: d.created,
          resolved: d.resolved,
        })),
        comparison: data.comparison
          ? {
              previousLabel: 'S-1',
              currentKpi: data.kpi,
              previousKpi: data.comparison.previousWeek,
              resolutionRateChange: data.comparison.resolutionRateChange,
              createdChange: data.comparison.createdChange,
              resolvedChange: data.comparison.resolvedChange,
              backlogEndChange: data.comparison.backlogEndChange,
              avgResolutionChange: data.comparison.avgResolutionChange,
            }
          : null,
        incidents: data.incidents,
      };

      const buffer = await buildReportWorkbook(options);

      const filename = `rapport_hebdo_${data.period.startDate}_${data.period.endDate}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('[REPORT] exportExcel error:', error);
      return res.status(500).json({ message: 'Erreur génération Excel' });
    }
  }

  /**
   * POST /api/v1/reports/statistics/export/pdf
   * Body: { dateFrom?: string; periodLabel?: string }
   * Génère un PDF du tableau statistique avec l'en-tête SOREPCO (comme les autres exports).
   */
  static async exportStatisticsPdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const dateFromParam = req.body?.dateFrom as string | undefined;
      const periodLabel = (req.body?.periodLabel as string | undefined) || 'Tout';
      const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;

      const incidentService = new IncidentService();
      const [catProc, byService, priority] = await Promise.all([
        incidentService.getByCategoryProcess({ ...user, dateFrom }),
        incidentService.getByService(user),
        incidentService.getByPriority(user),
      ]);

      // Totaux cohérents avec la période (chaque incident est compté, y compris "Non catégorisé")
      const catList = Array.isArray(catProc?.categories) ? catProc.categories : [];
      const totals = catList.reduce(
        (acc, c) => ({
          total: acc.total + (c.total || 0),
          open: acc.open + (c.open || 0),
          inProgress: acc.inProgress + (c.inProgress || 0),
          closed: acc.closed + (c.closed || 0),
          cancelled: acc.cancelled + (c.cancelled || 0),
        }),
        { total: 0, open: 0, inProgress: 0, closed: 0, cancelled: 0 }
      );
      const enCours = totals.open + totals.inProgress;
      const resolutionRate = totals.total > 0 ? Math.round((totals.closed / totals.total) * 100) : 0;
      const backlogCritical = priority?.backlogCritical ?? 0;

      // ── KPI ──
      const kpis: { label: string; value: string }[] = [
        { label: 'Total incidents', value: String(totals.total) },
        { label: 'En cours', value: String(enCours) },
        { label: 'Résolus', value: String(totals.closed) },
        { label: 'Annulés', value: String(totals.cancelled) },
        { label: 'Taux de résolution', value: `${resolutionRate}%` },
        { label: 'Backlog critique', value: String(backlogCritical) },
      ];
      const kpiRowsHtml = kpis
        .map((k) => `<div class="kpi"><span class="kpi-label">${escapeHtml(k.label)}</span><span class="kpi-value">${escapeHtml(k.value)}</span></div>`)
        .join('');

      // ── Catégories ──
      const categoryRowsHtml = catList.length
        ? catList
            .map((c: any) => {
              const rate = c.total > 0 ? Math.round((c.closed / c.total) * 100) : 0;
              return `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td class="num">${c.total}</td>
            <td class="num">${(c.inProgress || 0) + (c.open || 0)}</td>
            <td class="num">${c.closed}</td>
            <td class="num">${c.cancelled}</td>
            <td class="num">${rate}%</td>
          </tr>`;
            })
            .join('')
        : '<tr><td colspan="6" class="empty">Aucune donnée pour la période sélectionnée</td></tr>';

      const categoryTotalsHtml = catList.length
        ? `<tr class="total-row">
          <td>Total</td>
          <td class="num">${totals.total}</td>
          <td class="num">${enCours}</td>
          <td class="num">${totals.closed}</td>
          <td class="num">${totals.cancelled}</td>
          <td class="num">${resolutionRate}%</td>
        </tr>`
        : '';

      // ── Services ──
      const serviceRowsHtml =
        Array.isArray(byService) && byService.length
          ? byService
              .map((s: any) => {
                const share = totals.total > 0 ? Math.round((s.value / totals.total) * 100) : 0;
                return `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.value}</td>
            <td class="num">${share}%</td>
          </tr>`;
              })
              .join('')
          : '<tr><td colspan="3" class="empty">Aucune donnée</td></tr>';

      // ── Priorités ──
      const PRIORITY_ORDER = ['Critique', 'Haute', 'Moyenne', 'Basse'];
      const priorityRows = PRIORITY_ORDER.map((name) => ({
        name,
        value: (priority?.byPriority || []).find((p: any) => p.name === name)?.value || 0,
      })).filter((p) => p.value > 0);
      const priorityRowsHtml = priorityRows.length
        ? priorityRows
            .map((p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.value}</td>
          </tr>`)
            .join('')
        : '<tr><td colspan="2" class="empty">Aucune donnée</td></tr>';

      // ── Sous-catégories / Sous-processus ──
      const subCatRowsHtml =
        Array.isArray(catProc?.subCategories) && catProc.subCategories.length
          ? catProc.subCategories
              .slice(0, 8)
              .map((s: any) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.categoryName)}</td>
            <td class="num">${s.total}</td>
          </tr>`)
              .join('')
          : '<tr><td colspan="3" class="empty">Aucune donnée</td></tr>';

      const subProcRowsHtml =
        Array.isArray(catProc?.subProcesses) && catProc.subProcesses.length
          ? catProc.subProcesses
              .slice(0, 8)
              .map((s: any) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.processName)}</td>
            <td class="num">${s.total}</td>
          </tr>`)
              .join('')
          : '<tr><td colspan="3" class="empty">Aucune donnée</td></tr>';

      // ── Template + logo ──
      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      let template: string;
      try {
        template = await fs.readFile(path.join(TEMPLATE_DIR, 'statistics-report.html'), 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de statistiques introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(path.join(ASSETS_DIR, 'logo.png'));
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      const html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(periodLabel))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_ROWS}}', kpiRowsHtml)
        .replace('{{CATEGORY_ROWS}}', categoryRowsHtml)
        .replace('{{CATEGORY_TOTALS}}', categoryTotalsHtml)
        .replace('{{SERVICE_ROWS}}', serviceRowsHtml)
        .replace('{{PRIORITY_ROWS}}', priorityRowsHtml)
        .replace('{{SUBCAT_ROWS}}', subCatRowsHtml)
        .replace('{{SUBPROC_ROWS}}', subProcRowsHtml);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `tableau_statistique_${new Date().toISOString().slice(0, 10)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF statistiques');
    }
  }

  /**
   * POST /api/v1/reports/pilotage/export/pdf
   * Body: { dateFrom?: string; periodLabel?: string }
   * Génère un PDF du pilotage (catégories/processus) avec l'en-tête SOREPCO.
   */
  static async exportPilotagePdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const dateFromParam = req.body?.dateFrom as string | undefined;
      const periodLabel = (req.body?.periodLabel as string | undefined) || 'Tout';
      const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;

      const incidentService = new IncidentService();
      const catProc = await incidentService.getByCategoryProcess({ ...user, dateFrom });

      const catList = Array.isArray(catProc?.categories) ? catProc.categories : [];
      const totals = catList.reduce(
        (acc, c) => ({
          total: acc.total + (c.total || 0),
          open: acc.open + (c.open || 0),
          inProgress: acc.inProgress + (c.inProgress || 0),
          closed: acc.closed + (c.closed || 0),
          cancelled: acc.cancelled + (c.cancelled || 0),
        }),
        { total: 0, open: 0, inProgress: 0, closed: 0, cancelled: 0 }
      );
      const enCours = totals.open + totals.inProgress;
      const resolutionRate = totals.total > 0 ? Math.round((totals.closed / totals.total) * 100) : 0;

      const kpis: { label: string; value: string }[] = [
        { label: 'Total incidents', value: String(totals.total) },
        { label: 'Catégories concernées', value: String(catList.length) },
        { label: 'Processus concernés', value: String(Array.isArray(catProc?.processes) ? catProc.processes.length : 0) },
        { label: 'Taux de résolution', value: `${resolutionRate}%` },
      ];
      const kpiRowsHtml = kpis
        .map((k) => `<div class="kpi"><span class="kpi-label">${escapeHtml(k.label)}</span><span class="kpi-value">${escapeHtml(k.value)}</span></div>`)
        .join('');

      const categoryRowsHtml = catList.length
        ? catList
            .map((c: any) => {
              const rate = c.total > 0 ? Math.round((c.closed / c.total) * 100) : 0;
              return `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td class="num">${c.total}</td>
            <td class="num">${(c.inProgress || 0) + (c.open || 0)}</td>
            <td class="num">${c.closed}</td>
            <td class="num">${c.cancelled}</td>
            <td class="num">${rate}%</td>
          </tr>`;
            })
            .join('')
        : '<tr><td colspan="6" class="empty">Aucune donnée pour la période sélectionnée</td></tr>';

      const categoryTotalsHtml = catList.length
        ? `<tr class="total-row">
          <td>Total</td>
          <td class="num">${totals.total}</td>
          <td class="num">${enCours}</td>
          <td class="num">${totals.closed}</td>
          <td class="num">${totals.cancelled}</td>
          <td class="num">${resolutionRate}%</td>
        </tr>`
        : '';

      const processRowsHtml =
        Array.isArray(catProc?.processes) && catProc.processes.length
          ? catProc.processes
              .map((p: any) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.total}</td>
          </tr>`)
              .join('')
          : '<tr><td colspan="2" class="empty">Aucune donnée</td></tr>';

      const subCatRowsHtml =
        Array.isArray(catProc?.subCategories) && catProc.subCategories.length
          ? catProc.subCategories
              .slice(0, 8)
              .map((s: any) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.categoryName)}</td>
            <td class="num">${s.total}</td>
          </tr>`)
              .join('')
          : '<tr><td colspan="3" class="empty">Aucune donnée</td></tr>';

      const subProcRowsHtml =
        Array.isArray(catProc?.subProcesses) && catProc.subProcesses.length
          ? catProc.subProcesses
              .slice(0, 8)
              .map((s: any) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.processName)}</td>
            <td class="num">${s.total}</td>
          </tr>`)
              .join('')
          : '<tr><td colspan="3" class="empty">Aucune donnée</td></tr>';

      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      let template: string;
      try {
        template = await fs.readFile(path.join(TEMPLATE_DIR, 'pilotage-report.html'), 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de pilotage introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(path.join(ASSETS_DIR, 'logo.png'));
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      const html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(periodLabel))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_ROWS}}', kpiRowsHtml)
        .replace('{{CATEGORY_ROWS}}', categoryRowsHtml)
        .replace('{{CATEGORY_TOTALS}}', categoryTotalsHtml)
        .replace('{{PROCESS_ROWS}}', processRowsHtml)
        .replace('{{SUBCAT_ROWS}}', subCatRowsHtml)
        .replace('{{SUBPROC_ROWS}}', subProcRowsHtml);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `pilotage_${new Date().toISOString().slice(0, 10)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF pilotage');
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     MONTHLY REPORT METHODS
  ───────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/v1/reports/monthly/available-months
   */
  static async getAvailableMonths(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const months = await monthlyReportService.getAvailableMonths({
        id: dbUser.id,
        roles,
        siteId: dbUser.siteId ?? undefined,
      });

      return res.json(months);
    } catch (error) {
      console.error('[REPORT] getAvailableMonths error:', error);
      return res.status(500).json({ message: 'Erreur récupération mois' });
    }
  }

  /**
   * GET /api/v1/reports/monthly?month=2026-09
   * GET /api/v1/reports/monthly/current
   */
  static async getMonthlyReport(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const monthParam = req.query.month as string | undefined;
      let result;

      if (monthParam) {
        // Format: "2026-09"
        const match = monthParam.match(/^(\d{4})-(\d{1,2})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de mois invalide. Utiliser YYYY-MM (ex: 2026-09)' });
        }
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        if (month < 1 || month > 12) {
          return res.status(400).json({ message: 'Mois invalide (1-12)' });
        }
        result = await monthlyReportService.getMonthlyReport(month, year, user);
      } else {
        result = await monthlyReportService.getCurrentMonthReport(user);
      }

      return res.json(result);
    } catch (error) {
      console.error('[REPORT] getMonthlyReport error:', error);
      return res.status(500).json({ message: 'Erreur récupération rapport mensuel' });
    }
  }

  /**
   * POST /api/v1/reports/monthly/export/pdf
   * Body: { month?: "2026-09" }
   */
  static async exportMonthlyPdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const monthParam = req.body?.month as string | undefined;
      let data;

      if (monthParam) {
        const match = monthParam.match(/^(\d{4})-(\d{1,2})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de mois invalide' });
        }
        data = await monthlyReportService.getMonthlyReport(parseInt(match[2], 10), parseInt(match[1], 10), user);
      } else {
        data = await monthlyReportService.getCurrentMonthReport(user);
      }

      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      const templatePath = path.join(TEMPLATE_DIR, 'monthly-report.html');

      let template: string;
      try {
        template = await fs.readFile(templatePath, 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de rapport mensuel introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(path.join(ASSETS_DIR, 'logo.png'));
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      const barWidth = (rate: number | null): string => {
        if (rate === null) return '0';
        return String(Math.min(rate, 100));
      };

      const kpi = data.kpi;
      const comparison = data.comparison;

      const renderChange = (value: number | null, unit: string, inverse = false): string => {
        if (value === null) return '<span class="neutral">—</span>';
        const abs = Math.abs(value);
        const formatted = unit === 'pts'
          ? `${abs.toFixed(1)} pts`
          : `${abs.toFixed(1)}%`;
        if (Math.abs(value) < 0.01) return `<span class="neutral">→ ${formatted}</span>`;
        const isPositive = inverse ? value < 0 : value > 0;
        if (isPositive) {
          return `<span class="good">▲ ${formatted}</span>`;
        }
        return `<span class="bad">▼ ${formatted}</span>`;
      };

      const displayRate = kpi.resolutionRate !== null ? `${kpi.cappedRate.toFixed(1)}%` : 'N/A';
      const extraNote = kpi.extraResolvedFromStock > 0
        ? `<p class="note">Dont ${kpi.extraResolvedFromStock} résolu(s) d'anciens stocks</p>`
        : '';

      const serviceRows = data.byService.length
        ? data.byService.map((s) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.created}</td>
            <td class="num">${s.resolved}</td>
            <td class="num">${s.rate !== null ? `${s.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(s.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée ce mois</td></tr>';

      const priorityRows = data.byPriority.length
        ? data.byPriority.map((p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.created}</td>
            <td class="num">${p.resolved}</td>
            <td class="num">${p.rate !== null ? `${p.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(p.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée ce mois</td></tr>';

      const weeklyTrendRows = data.weeklyTrend.map((w) => `
        <tr>
          <td>${escapeHtml(w.weekLabel)}</td>
          <td class="num">${w.created}</td>
          <td class="num">${w.resolved}</td>
          <td class="num">
            <div class="mini-bar">
              <div class="bar-created" style="width:${w.created > 0 ? Math.max(2, (w.created / Math.max(...data.weeklyTrend.map((x) => x.created), 1)) * 100) : 0}%"></div>
              <div class="bar-resolved" style="width:${w.resolved > 0 ? Math.max(2, (w.resolved / Math.max(...data.weeklyTrend.map((x) => x.resolved), 1)) * 100) : 0}%"></div>
            </div>
          </td>
        </tr>`).join('');

      const comparisonRows = comparison
        ? `
        <tr>
          <td>Créés</td>
          <td class="num">${kpi.created}</td>
          <td class="num">${comparison.previousMonth.created}</td>
          <td class="num">${renderChange(comparison.createdChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Résolus</td>
          <td class="num">${kpi.resolved}</td>
          <td class="num">${comparison.previousMonth.resolved}</td>
          <td class="num">${renderChange(comparison.resolvedChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Taux de résolution</td>
          <td class="num">${displayRate}</td>
          <td class="num">${comparison.previousMonth.resolutionRate !== null ? `${comparison.previousMonth.cappedRate.toFixed(1)}%` : 'N/A'}</td>
          <td class="num">${renderChange(comparison.resolutionRateChange, 'pts')}</td>
        </tr>
        <tr>
          <td>Incidents en cours (fin)</td>
          <td class="num">${kpi.backlogEnd}</td>
          <td class="num">${comparison.previousMonth.backlogEnd}</td>
          <td class="num">${renderChange(comparison.backlogEndChange, 'pct', true)}</td>
        </tr>
        <tr>
          <td>Tps moy. résolution</td>
          <td class="num">${kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${comparison.previousMonth.avgResolutionHours !== null ? `${comparison.previousMonth.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${renderChange(comparison.avgResolutionChange, 'pct', true)}</td>
        </tr>`
        : '<tr><td colspan="4" class="empty">Mois précédent non disponible</td></tr>';

      let html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(data.period.label))
        .replace(/{{PERIOD_START}}/g, formatDateFr(data.period.startDate))
        .replace(/{{PERIOD_END}}/g, formatDateFr(data.period.endDate))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_CREATED}}', String(kpi.created))
        .replace('{{KPI_RESOLVED}}', String(kpi.resolved))
        .replace('{{KPI_RATE}}', displayRate)
        .replace('{{KPI_EXTRA_NOTE}}', extraNote)
        .replace('{{KPI_BACKLOG_START}}', String(kpi.backlogStart))
        .replace('{{KPI_BACKLOG_END}}', String(kpi.backlogEnd))
        .replace('{{KPI_AVG_RES}}', kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—')
        .replace('{{KPI_AVG_TIC}}', kpi.avgTakeInChargeHours !== null ? `${kpi.avgTakeInChargeHours.toFixed(1)} h` : '—')
        .replace('{{SERVICE_ROWS}}', serviceRows)
        .replace('{{PRIORITY_ROWS}}', priorityRows)
        .replace('{{WEEKLY_TREND_ROWS}}', weeklyTrendRows)
        .replace('{{COMPARISON_ROWS}}', comparisonRows);

      const statusLabels: Record<string, string> = {
        OPEN: 'Ouvert', IN_PROGRESS: 'En cours', RESOLVED: 'Résolu',
        CLOSED: 'Clôturé', CANCELLED: 'Annulé',
      };
      const incidentRows = Array.isArray(data.incidents) && data.incidents.length
        ? data.incidents.map((inc: any) => {
            const statusLabel = statusLabels[inc.status] || inc.status;
            return `
            <tr>
              <td><strong>${escapeHtml(inc.reference)}</strong></td>
              <td class="desc-cell">${escapeHtml(inc.description)}</td>
              <td><span class="status-badge status-${inc.status}">${escapeHtml(statusLabel)}</span></td>
              <td class="num ${`prio-${inc.priority}`}">${escapeHtml(inc.priority)}</td>
              <td>${escapeHtml(inc.serviceEmetteur)}</td>
              <td>${escapeHtml(inc.serviceRecepteur)}</td>
              <td class="num">${escapeHtml(inc.createdAt)}</td>
              <td class="desc-cell">${inc.rootCause ? escapeHtml(inc.rootCause) : '<span class="text-muted">—</span>'}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="8" class="empty">Aucun incident créé ce mois</td></tr>';

      html = html.replace('{{INCIDENT_ROWS}}', incidentRows);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `rapport_mensuel_${data.period.startDate}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF mensuel');
    }
  }

  /**
   * POST /api/v1/reports/monthly/export/excel
   * Body: { month?: "2026-09" }
   */
  static async exportMonthlyExcel(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const monthParam = req.body?.month as string | undefined;
      let data;

      if (monthParam) {
        const match = monthParam.match(/^(\d{4})-(\d{1,2})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de mois invalide' });
        }
        data = await monthlyReportService.getMonthlyReport(parseInt(match[2], 10), parseInt(match[1], 10), user);
      } else {
        data = await monthlyReportService.getCurrentMonthReport(user);
      }

      const options: ReportExcelOptions = {
        sheetTitle: 'Rapport Mensuel',
        reportTitle: 'RAPPORT MENSUEL',
        periodLabel: data.period.label,
        periodStart: data.period.startDate,
        periodEnd: data.period.endDate,
        kpi: data.kpi,
        byService: data.byService,
        byPriority: data.byPriority,
        trendTitle: 'Tendance hebdomadaire',
        trend: data.weeklyTrend.map((w) => ({
          label: w.weekLabel,
          created: w.created,
          resolved: w.resolved,
        })),
        comparison: data.comparison
          ? {
              previousLabel: 'M-1',
              currentKpi: data.kpi,
              previousKpi: data.comparison.previousMonth,
              resolutionRateChange: data.comparison.resolutionRateChange,
              createdChange: data.comparison.createdChange,
              resolvedChange: data.comparison.resolvedChange,
              backlogEndChange: data.comparison.backlogEndChange,
              avgResolutionChange: data.comparison.avgResolutionChange,
            }
          : null,
        incidents: data.incidents,
      };

      const buffer = await buildReportWorkbook(options);

      const filename = `rapport_mensuel_${data.period.startDate}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('[REPORT] exportMonthlyExcel error:', error);
      return res.status(500).json({ message: 'Erreur génération Excel mensuel' });
    }
  }

  /* ------------------------------------------------------ */
  /*  Quarterly reports                                      */
  /* ------------------------------------------------------ */

  /**
   * GET /api/v1/reports/quarterly/available-quarters
   */
  static async getAvailableQuarters(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const periods = await quarterlyReportService.getAvailableQuarters(user);
      return res.status(200).json(periods);
    } catch (error) {
      console.error('[REPORT] getAvailableQuarters error:', error);
      return res.status(500).json({ message: 'Erreur récupération trimestres disponibles' });
    }
  }

  /**
   * GET /api/v1/reports/quarterly?quarter=2026-Q3
   * GET /api/v1/reports/quarterly/current
   */
  static async getQuarterlyReport(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { quarter } = req.query as { quarter?: string };

      if (quarter) {
        const match = quarter.match(/^(\d{4})-Q(\d)$/);
        if (!match) {
          return res.status(400).json({ message: 'Format attendu : YYYY-Q (ex: 2026-Q3)' });
        }
        const year = parseInt(match[1], 10);
        const q = parseInt(match[2], 10);
        if (q < 1 || q > 4) {
          return res.status(400).json({ message: 'Le trimestre doit être entre 1 et 4' });
        }
        const data = await quarterlyReportService.getQuarterlyReport(q, year, user);
        return res.status(200).json(data);
      }

      const data = await quarterlyReportService.getCurrentQuarterReport(user);
      return res.status(200).json(data);
    } catch (error) {
      console.error('[REPORT] getQuarterlyReport error:', error);
      return res.status(500).json({ message: 'Erreur récupération rapport trimestriel' });
    }
  }

  /**
   * POST /api/v1/reports/quarterly/export/pdf
   * Body: { quarter?: "2026-Q3" }
   */
  static async exportQuarterlyPdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const quarterParam = req.body?.quarter as string | undefined;
      let data;

      if (quarterParam) {
        const match = quarterParam.match(/^(\d{4})-Q(\d)$/);
        if (!match) {
          return res.status(400).json({ message: 'Format de trimestre invalide' });
        }
        data = await quarterlyReportService.getQuarterlyReport(parseInt(match[2], 10), parseInt(match[1], 10), user);
      } else {
        data = await quarterlyReportService.getCurrentQuarterReport(user);
      }

      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      const templatePath = path.join(TEMPLATE_DIR, 'quarterly-report.html');

      let template: string;
      try {
        template = await fs.readFile(templatePath, 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de rapport trimestriel introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(path.join(ASSETS_DIR, 'logo.png'));
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      const barWidth = (rate: number | null): string => {
        if (rate === null) return '0';
        return String(Math.min(rate, 100));
      };

      const kpi = data.kpi;
      const comparison = data.comparison;

      const renderChange = (value: number | null, unit: string, inverse = false): string => {
        if (value === null) return '<span class="neutral">—</span>';
        const abs = Math.abs(value);
        const formatted = unit === 'pts'
          ? `${abs.toFixed(1)} pts`
          : `${abs.toFixed(1)}%`;
        if (Math.abs(value) < 0.01) return `<span class="neutral">→ ${formatted}</span>`;
        const isPositive = inverse ? value < 0 : value > 0;
        if (isPositive) {
          return `<span class="good">▲ ${formatted}</span>`;
        }
        return `<span class="bad">▼ ${formatted}</span>`;
      };

      const displayRate = kpi.resolutionRate !== null ? `${kpi.cappedRate.toFixed(1)}%` : 'N/A';
      const extraNote = kpi.extraResolvedFromStock > 0
        ? `<p class="note">Dont ${kpi.extraResolvedFromStock} résolu(s) d'anciens stocks</p>`
        : '';

      const serviceRows = data.byService.length
        ? data.byService.map((s) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.created}</td>
            <td class="num">${s.resolved}</td>
            <td class="num">${s.rate !== null ? `${s.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(s.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée ce trimestre</td></tr>';

      const priorityRows = data.byPriority.length
        ? data.byPriority.map((p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.created}</td>
            <td class="num">${p.resolved}</td>
            <td class="num">${p.rate !== null ? `${p.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(p.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée ce trimestre</td></tr>';

      const weeklyTrendRows = data.weeklyTrend.map((w) => `
        <tr>
          <td>${escapeHtml(w.weekLabel)}</td>
          <td class="num">${w.created}</td>
          <td class="num">${w.resolved}</td>
          <td class="num">
            <div class="mini-bar">
              <div class="bar-created" style="width:${w.created > 0 ? Math.max(2, (w.created / Math.max(...data.weeklyTrend.map((x) => x.created), 1)) * 100) : 0}%"></div>
              <div class="bar-resolved" style="width:${w.resolved > 0 ? Math.max(2, (w.resolved / Math.max(...data.weeklyTrend.map((x) => x.resolved), 1)) * 100) : 0}%"></div>
            </div>
          </td>
        </tr>`).join('');

      const comparisonRows = comparison
        ? `
        <tr>
          <td>Créés</td>
          <td class="num">${kpi.created}</td>
          <td class="num">${comparison.previousQuarter.created}</td>
          <td class="num">${renderChange(comparison.createdChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Résolus</td>
          <td class="num">${kpi.resolved}</td>
          <td class="num">${comparison.previousQuarter.resolved}</td>
          <td class="num">${renderChange(comparison.resolvedChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Taux de résolution</td>
          <td class="num">${displayRate}</td>
          <td class="num">${comparison.previousQuarter.resolutionRate !== null ? `${comparison.previousQuarter.cappedRate.toFixed(1)}%` : 'N/A'}</td>
          <td class="num">${renderChange(comparison.resolutionRateChange, 'pts')}</td>
        </tr>
        <tr>
          <td>Incidents en cours (fin)</td>
          <td class="num">${kpi.backlogEnd}</td>
          <td class="num">${comparison.previousQuarter.backlogEnd}</td>
          <td class="num">${renderChange(comparison.backlogEndChange, 'pct', true)}</td>
        </tr>
        <tr>
          <td>Tps moy. résolution</td>
          <td class="num">${kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${comparison.previousQuarter.avgResolutionHours !== null ? `${comparison.previousQuarter.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${renderChange(comparison.avgResolutionChange, 'pct', true)}</td>
        </tr>`
        : '<tr><td colspan="4" class="empty">Trimestre précédent non disponible</td></tr>';

      let html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(data.period.label))
        .replace(/{{PERIOD_START}}/g, formatDateFr(data.period.startDate))
        .replace(/{{PERIOD_END}}/g, formatDateFr(data.period.endDate))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_CREATED}}', String(kpi.created))
        .replace('{{KPI_RESOLVED}}', String(kpi.resolved))
        .replace('{{KPI_RATE}}', displayRate)
        .replace('{{KPI_EXTRA_NOTE}}', extraNote)
        .replace('{{KPI_BACKLOG_START}}', String(kpi.backlogStart))
        .replace('{{KPI_BACKLOG_END}}', String(kpi.backlogEnd))
        .replace('{{KPI_AVG_RES}}', kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—')
        .replace('{{KPI_AVG_TIC}}', kpi.avgTakeInChargeHours !== null ? `${kpi.avgTakeInChargeHours.toFixed(1)} h` : '—')
        .replace('{{SERVICE_ROWS}}', serviceRows)
        .replace('{{PRIORITY_ROWS}}', priorityRows)
        .replace('{{WEEKLY_TREND_ROWS}}', weeklyTrendRows)
        .replace('{{COMPARISON_ROWS}}', comparisonRows);

      const statusLabels: Record<string, string> = {
        OPEN: 'Ouvert', IN_PROGRESS: 'En cours', RESOLVED: 'Résolu',
        CLOSED: 'Clôturé', CANCELLED: 'Annulé',
      };
      const incidentRows = Array.isArray(data.incidents) && data.incidents.length
        ? data.incidents.map((inc: any) => {
            const statusLabel = statusLabels[inc.status] || inc.status;
            return `
            <tr>
              <td><strong>${escapeHtml(inc.reference)}</strong></td>
              <td class="desc-cell">${escapeHtml(inc.description)}</td>
              <td><span class="status-badge status-${inc.status}">${escapeHtml(statusLabel)}</span></td>
              <td class="num ${`prio-${inc.priority}`}">${escapeHtml(inc.priority)}</td>
              <td>${escapeHtml(inc.serviceEmetteur)}</td>
              <td>${escapeHtml(inc.serviceRecepteur)}</td>
              <td class="num">${escapeHtml(inc.createdAt)}</td>
              <td class="desc-cell">${inc.rootCause ? escapeHtml(inc.rootCause) : '<span class="text-muted">—</span>'}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="8" class="empty">Aucun incident créé ce trimestre</td></tr>';

      html = html.replace('{{INCIDENT_ROWS}}', incidentRows);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `rapport_trimestriel_${data.period.startDate}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF trimestriel');
    }
  }

  /**
   * POST /api/v1/reports/quarterly/export/excel
   */
  static async exportQuarterlyExcel(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const quarterParam = req.body?.quarter as string | undefined;
      let data;

      if (quarterParam) {
        const match = quarterParam.match(/^(\d{4})-Q(\d)$/);
        if (!match) return res.status(400).json({ message: 'Format de trimestre invalide' });
        data = await quarterlyReportService.getQuarterlyReport(parseInt(match[2], 10), parseInt(match[1], 10), user);
      } else {
        data = await quarterlyReportService.getCurrentQuarterReport(user);
      }

      const options: ReportExcelOptions = {
        sheetTitle: 'Rapport Trimestriel',
        reportTitle: 'RAPPORT TRIMESTRIEL',
        periodLabel: data.period.label,
        periodStart: data.period.startDate,
        periodEnd: data.period.endDate,
        kpi: data.kpi,
        byService: data.byService,
        byPriority: data.byPriority,
        trendTitle: 'Tendance hebdomadaire',
        trend: data.weeklyTrend.map((w: any) => ({
          label: w.weekLabel,
          created: w.created,
          resolved: w.resolved,
        })),
        comparison: data.comparison
          ? {
              previousLabel: 'T-1',
              currentKpi: data.kpi,
              previousKpi: data.comparison.previousQuarter,
              resolutionRateChange: data.comparison.resolutionRateChange,
              createdChange: data.comparison.createdChange,
              resolvedChange: data.comparison.resolvedChange,
              backlogEndChange: data.comparison.backlogEndChange,
              avgResolutionChange: data.comparison.avgResolutionChange,
            }
          : null,
        incidents: data.incidents,
      };

      const buffer = await buildReportWorkbook(options);

      const filename = `rapport_trimestriel_${data.period.startDate}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('[REPORT] exportQuarterlyExcel error:', error);
      return res.status(500).json({ message: 'Erreur génération Excel trimestriel' });
    }
  }

  /* ------------------------------------------------------ */
  /*  Annual reports (bilan annuel)                          */
  /* ------------------------------------------------------ */

  /**
   * GET /api/v1/reports/annual/available-years
   */
  static async getAvailableYears(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };
      const years = await annualReportService.getAvailableYears(user);
      return res.status(200).json(years);
    } catch (error) {
      console.error('[REPORT] getAvailableYears error:', error);
      return res.status(500).json({ message: 'Erreur récupération années disponibles' });
    }
  }

  /**
   * GET /api/v1/reports/annual?year=2026
   * GET /api/v1/reports/annual/current
   */
  static async getAnnualReport(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const yearParam = req.query.year as string | undefined;
      let data;

      if (yearParam) {
        const match = yearParam.match(/^(\d{4})$/);
        if (!match) {
          return res.status(400).json({ message: 'Format attendu : YYYY (ex: 2026)' });
        }
        data = await annualReportService.getAnnualReport(parseInt(match[1], 10), user);
      } else {
        data = await annualReportService.getCurrentYearReport(user);
      }
      return res.status(200).json(data);
    } catch (error) {
      console.error('[REPORT] getAnnualReport error:', error);
      return res.status(500).json({ message: 'Erreur récupération rapport annuel' });
    }
  }

  /**
   * POST /api/v1/reports/annual/export/pdf
   * Body: { year?: "2026" } — si omis, année courante
   */
  static async exportAnnualPdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const yearParam = req.body?.year as string | undefined;
      let data;

      if (yearParam) {
        const match = yearParam.match(/^(\d{4})$/);
        if (!match) return res.status(400).json({ message: 'Format d’année invalide' });
        data = await annualReportService.getAnnualReport(parseInt(match[1], 10), user);
      } else {
        data = await annualReportService.getCurrentYearReport(user);
      }

      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      const templatePath = path.join(TEMPLATE_DIR, 'annual-report.html');

      let template: string;
      try {
        template = await fs.readFile(templatePath, 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de rapport annuel introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(path.join(ASSETS_DIR, 'logo.png'));
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      const barWidth = (rate: number | null): string => {
        if (rate === null) return '0';
        return String(Math.min(rate, 100));
      };

      const kpi = data.kpi;
      const comparison = data.comparison;

      const renderChange = (value: number | null, unit: string, inverse = false): string => {
        if (value === null) return '<span class="neutral">—</span>';
        const abs = Math.abs(value);
        const formatted = unit === 'pts'
          ? `${abs.toFixed(1)} pts`
          : `${abs.toFixed(1)}%`;
        if (Math.abs(value) < 0.01) return `<span class="neutral">→ ${formatted}</span>`;
        const isPositive = inverse ? value < 0 : value > 0;
        if (isPositive) {
          return `<span class="good">▲ ${formatted}</span>`;
        }
        return `<span class="bad">▼ ${formatted}</span>`;
      };

      const displayRate = kpi.resolutionRate !== null ? `${kpi.cappedRate.toFixed(1)}%` : 'N/A';
      const extraNote = kpi.extraResolvedFromStock > 0
        ? `<p class="note">Dont ${kpi.extraResolvedFromStock} résolu(s) d'anciens stocks</p>`
        : '';

      const serviceRows = data.byService.length
        ? data.byService.map((s: any) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.created}</td>
            <td class="num">${s.resolved}</td>
            <td class="num">${s.rate !== null ? `${s.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(s.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée cette année</td></tr>';

      const priorityRows = data.byPriority.length
        ? data.byPriority.map((p: any) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.created}</td>
            <td class="num">${p.resolved}</td>
            <td class="num">${p.rate !== null ? `${p.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${barWidth(p.rate)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Aucune donnée cette année</td></tr>';

      // ── Répartition par trimestre ──
      const quarterRows = data.byQuarter.map((q: any) => `
        <tr>
          <td>${escapeHtml(q.label)}</td>
          <td class="num">${q.created}</td>
          <td class="num">${q.resolved}</td>
          <td class="num">${q.rate !== null ? `${q.rate.toFixed(1)}%` : 'N/A'}</td>
        </tr>`).join('');

      // ── Tendance mensuelle ──
      const monthlyTrendRows = data.monthlyTrend.map((m: any) => `
        <tr>
          <td>${escapeHtml(m.label)}</td>
          <td class="num">${m.created}</td>
          <td class="num">${m.resolved}</td>
          <td class="num">
            <div class="mini-bar">
              <div class="bar-created" style="width:${m.created > 0 ? Math.max(2, (m.created / Math.max(...data.monthlyTrend.map((x: any) => x.created), 1)) * 100) : 0}%"></div>
              <div class="bar-resolved" style="width:${m.resolved > 0 ? Math.max(2, (m.resolved / Math.max(...data.monthlyTrend.map((x: any) => x.resolved), 1)) * 100) : 0}%"></div>
            </div>
          </td>
        </tr>`).join('');

      const comparisonRows = comparison
        ? `
        <tr>
          <td>Créés</td>
          <td class="num">${kpi.created}</td>
          <td class="num">${comparison.previousYear.created}</td>
          <td class="num">${renderChange(comparison.createdChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Résolus</td>
          <td class="num">${kpi.resolved}</td>
          <td class="num">${comparison.previousYear.resolved}</td>
          <td class="num">${renderChange(comparison.resolvedChange, 'pct')}</td>
        </tr>
        <tr>
          <td>Taux de résolution</td>
          <td class="num">${displayRate}</td>
          <td class="num">${comparison.previousYear.resolutionRate !== null ? `${comparison.previousYear.cappedRate.toFixed(1)}%` : 'N/A'}</td>
          <td class="num">${renderChange(comparison.resolutionRateChange, 'pts')}</td>
        </tr>
        <tr>
          <td>Incidents en cours (fin)</td>
          <td class="num">${kpi.backlogEnd}</td>
          <td class="num">${comparison.previousYear.backlogEnd}</td>
          <td class="num">${renderChange(comparison.backlogEndChange, 'pct', true)}</td>
        </tr>
        <tr>
          <td>Tps moy. résolution</td>
          <td class="num">${kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${comparison.previousYear.avgResolutionHours !== null ? `${comparison.previousYear.avgResolutionHours.toFixed(1)} h` : '—'}</td>
          <td class="num">${renderChange(comparison.avgResolutionChange, 'pct', true)}</td>
        </tr>`
        : '<tr><td colspan="4" class="empty">Année précédente non disponible</td></tr>';

      const html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(data.period.label))
        .replace(/{{PERIOD_START}}/g, formatDateFr(data.period.startDate))
        .replace(/{{PERIOD_END}}/g, formatDateFr(data.period.endDate))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_CREATED}}', String(kpi.created))
        .replace('{{KPI_RESOLVED}}', String(kpi.resolved))
        .replace('{{KPI_RATE}}', displayRate)
        .replace('{{KPI_EXTRA_NOTE}}', extraNote)
        .replace('{{KPI_BACKLOG_START}}', String(kpi.backlogStart))
        .replace('{{KPI_BACKLOG_END}}', String(kpi.backlogEnd))
        .replace('{{KPI_AVG_RES}}', kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—')
        .replace('{{KPI_AVG_TIC}}', kpi.avgTakeInChargeHours !== null ? `${kpi.avgTakeInChargeHours.toFixed(1)} h` : '—')
        .replace('{{SERVICE_ROWS}}', serviceRows)
        .replace('{{PRIORITY_ROWS}}', priorityRows)
        .replace('{{QUARTER_ROWS}}', quarterRows)
        .replace('{{MONTHLY_TREND_ROWS}}', monthlyTrendRows)
        .replace('{{COMPARISON_ROWS}}', comparisonRows);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `rapport_annuel_${data.period.year}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF annuel');
    }
  }

  /**
   * POST /api/v1/reports/annual/export/excel
   */
  static async exportAnnualExcel(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: 'Unauthorized' });

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: { roles: { include: { role: true } } },
      });
      if (!dbUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

      const roles = dbUser.roles
        .map((r) => r.role?.name)
        .filter(Boolean)
        .map((n: string) => n.toUpperCase());

      const user = { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined };

      const yearParam = req.body?.year as string | undefined;
      let data;

      if (yearParam) {
        const match = yearParam.match(/^(\d{4})$/);
        if (!match) return res.status(400).json({ message: 'Format d’année invalide' });
        data = await annualReportService.getAnnualReport(parseInt(match[1], 10), user);
      } else {
        data = await annualReportService.getCurrentYearReport(user);
      }

      const options: ReportExcelOptions = {
        sheetTitle: 'Rapport Annuel',
        reportTitle: 'RAPPORT ANNUEL (BILAN)',
        periodLabel: `Année ${data.period.year}`,
        periodStart: data.period.startDate,
        periodEnd: data.period.endDate,
        kpi: data.kpi,
        byService: data.byService,
        byPriority: data.byPriority,
        quarterly: data.byQuarter.map((q: any) => ({
          name: q.label,
          created: q.created,
          resolved: q.resolved,
          rate: q.rate,
        })),
        trendTitle: 'Tendance mensuelle',
        trend: data.monthlyTrend.map((m: any) => ({
          label: m.label,
          created: m.created,
          resolved: m.resolved,
        })),
        comparison: data.comparison
          ? {
              previousLabel: 'N-1',
              currentKpi: data.kpi,
              previousKpi: data.comparison.previousYear,
              resolutionRateChange: data.comparison.resolutionRateChange,
              createdChange: data.comparison.createdChange,
              resolvedChange: data.comparison.resolvedChange,
              backlogEndChange: data.comparison.backlogEndChange,
              avgResolutionChange: data.comparison.avgResolutionChange,
            }
          : null,
        incidents: [],
        skipIncidentsSheet: true,
      };

      const buffer = await buildReportWorkbook(options);

      const filename = `rapport_annuel_${data.period.year}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('[REPORT] exportAnnualExcel error:', error);
      return res.status(500).json({ message: 'Erreur génération Excel annuel' });
    }
  }

  /* ------------------------------------------------------ */
  /*  SLA report (respect des délais)                        */
  /* ------------------------------------------------------ */

  /** Helper commun : résout l'utilisateur DB + les rôles. */
  private static async resolveReportUser(req: Request) {
    const authUser = (req as any).user;
    if (!authUser?.id) return null;
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: { include: { role: true } } },
    });
    if (!dbUser) return null;
    const roles = dbUser.roles
      .map((r) => r.role?.name)
      .filter(Boolean)
      .map((n: string) => n.toUpperCase());
    return { user: { id: dbUser.id, roles, siteId: dbUser.siteId ?? undefined }, dbUser };
  }

  /**
   * GET /api/v1/reports/sla?from=YYYY-MM-DD&to=YYYY-MM-DD&label=...
   */
  static async getSlaReport(req: Request, res: Response) {
    try {
      const resolved = await ReportController.resolveReportUser(req);
      if (!resolved) return res.status(401).json({ message: 'Unauthorized' });
      const range = resolveSlaRange(req.query);
      if (!range) {
        return res.status(400).json({ message: 'Paramètres from/to requis (YYYY-MM-DD)' });
      }
      const data = await slaReportService.getReport(range.start, range.end, resolved.user);
      data.period.label = range.label;
      return res.status(200).json(data);
    } catch (error) {
      console.error('[REPORT] getSlaReport error:', error);
      return res.status(500).json({ message: 'Erreur récupération rapport SLA' });
    }
  }

  /**
   * POST /api/v1/reports/sla/export/pdf
   * Body: { from, to, label }
   */
  static async exportSlaPdf(req: Request, res: Response) {
    try {
      const resolved = await ReportController.resolveReportUser(req);
      if (!resolved) return res.status(401).json({ message: 'Unauthorized' });
      const range = resolveSlaRange(req.body);
      if (!range) {
        return res.status(400).json({ message: 'Paramètres from/to requis' });
      }
      const data = await slaReportService.getReport(range.start, range.end, resolved.user);
      data.period.label = range.label;

      const TEMPLATE_DIR = path.resolve(__dirname, '../../../../templates');
      const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

      let template: string;
      try {
        template = await fs.readFile(path.join(TEMPLATE_DIR, 'sla-report.html'), 'utf8');
      } catch {
        return res.status(500).json({ message: 'Template de rapport SLA introuvable' });
      }

      let logoBase64 = '';
      try {
        const logoBuffer = await fs.readFile(path.join(ASSETS_DIR, 'logo.png'));
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch {
        logoBase64 = '';
      }

      const kpi = data.kpi;
      const displayRate = kpi.slaRate !== null ? `${kpi.slaRate.toFixed(1)}%` : 'N/A';

      const priorityRows = data.byPriority.length
        ? data.byPriority.map((p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="num">${p.resolved}</td>
            <td class="num good">${p.respected}</td>
            <td class="num bad">${p.breached}</td>
            <td class="num">${p.rate !== null ? `${p.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${Math.min(p.rate ?? 0, 100)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="5" class="empty">Aucun incident résolu sur la période</td></tr>';

      const serviceRows = data.byService.length
        ? data.byService.map((s) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="num">${s.resolved}</td>
            <td class="num good">${s.respected}</td>
            <td class="num bad">${s.breached}</td>
            <td class="num">${s.rate !== null ? `${s.rate.toFixed(1)}%` : 'N/A'}
              <div class="bar-bg"><div class="bar-fill" style="width:${Math.min(s.rate ?? 0, 100)}%"></div></div>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="5" class="empty">Aucun incident résolu sur la période</td></tr>';

      const statusLabels: Record<string, string> = {
        OPEN: 'Ouvert', IN_PROGRESS: 'En cours', RESOLVED: 'Résolu',
        CLOSED: 'Clôturé', CANCELLED: 'Annulé',
      };
      const delayedRows = data.delayed.length
        ? data.delayed.map((d) => {
            const statusLabel = statusLabels[d.status] || d.status;
            return `
          <tr>
            <td><strong>${escapeHtml(d.reference)}</strong></td>
            <td class="desc-cell">${escapeHtml(d.description)}</td>
            <td>${escapeHtml(statusLabel)}</td>
            <td>${escapeHtml(d.priority)}</td>
            <td>${escapeHtml(d.serviceEmetteur)}</td>
            <td class="num">${escapeHtml(d.dueDate)}</td>
            <td class="num">${d.resolvedAt ? escapeHtml(d.resolvedAt) : '<span class="text-muted">En cours</span>'}</td>
            <td class="num bad">${d.daysLate} j</td>
          </tr>`;
          }).join('')
        : '<tr><td colspan="8" class="empty">Aucun retard sur la période</td></tr>';

      const html = template
        .replace(/{{LOGO_URL}}/g, logoBase64)
        .replace(/{{PERIOD_LABEL}}/g, escapeHtml(data.period.label))
        .replace(/{{PERIOD_START}}/g, formatDateFr(data.period.startDate))
        .replace(/{{PERIOD_END}}/g, formatDateFr(data.period.endDate))
        .replace(/{{EXPORT_DATE}}/g, new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
        .replace('{{KPI_RESOLVED}}', String(kpi.resolved))
        .replace('{{KPI_RESPECTED}}', String(kpi.respected))
        .replace('{{KPI_BREACHED}}', String(kpi.breached))
        .replace('{{KPI_SLA}}', displayRate)
        .replace('{{KPI_OVERDUE}}', String(kpi.overdueActive))
        .replace('{{KPI_AVG_RES}}', kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—')
        .replace('{{PRIORITY_ROWS}}', priorityRows)
        .replace('{{SERVICE_ROWS}}', serviceRows)
        .replace('{{DELAYED_ROWS}}', delayedRows);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      const filename = `rapport_sla_${data.period.startDate}_${data.period.endDate}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, 'Erreur génération PDF SLA');
    }
  }

  /**
   * POST /api/v1/reports/sla/export/excel
   * Body: { from, to, label }
   */
  static async exportSlaExcel(req: Request, res: Response) {
    try {
      const resolved = await ReportController.resolveReportUser(req);
      if (!resolved) return res.status(401).json({ message: 'Unauthorized' });
      const range = resolveSlaRange(req.body);
      if (!range) {
        return res.status(400).json({ message: 'Paramètres from/to requis' });
      }
      const data = await slaReportService.getReport(range.start, range.end, resolved.user);
      data.period.label = range.label;

      const buffer = await buildSlaWorkbook(data, range.label);

      const filename = `rapport_sla_${data.period.startDate}_${data.period.endDate}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('[REPORT] exportSlaExcel error:', error);
      return res.status(500).json({ message: 'Erreur génération Excel SLA' });
    }
  }
}
