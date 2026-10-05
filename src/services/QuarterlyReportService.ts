import prisma from '../infrastructure/database/prisma';

/* ------------------------------------------------------------------ */
/*  Types du rapport trimestriel                                        */
/* ------------------------------------------------------------------ */

export interface QuarterlyReportPeriod {
  quarter: number;   // 1-4
  year: number;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  label: string;     // "T3 — 2026"
  months: string[];   // ["Juillet", "Août", "Septembre"]
}

export interface QuarterlyReportKpi {
  created: number;
  resolved: number;
  resolutionRate: number | null;
  cappedRate: number;
  extraResolvedFromStock: number;
  backlogStart: number;
  backlogEnd: number;
  avgResolutionHours: number | null;
  avgTakeInChargeHours: number | null;
}

export interface QuarterlyReportComparison {
  previousQuarter: QuarterlyReportKpi;
  resolutionRateChange: number | null;
  createdChange: number | null;
  resolvedChange: number | null;
  backlogEndChange: number | null;
  avgResolutionChange: number | null;
}

export interface QuarterlyReportByPriority {
  name: string;
  created: number;
  resolved: number;
  rate: number | null;
}

export interface QuarterlyReportByService {
  name: string;
  created: number;
  resolved: number;
  rate: number | null;
}

export interface QuarterlyReportTrendWeek {
  weekLabel: string;   // "Sem. 36 — 2026"
  date: string;        // ISO
  created: number;
  resolved: number;
}

export interface QuarterlyReportData {
  period: QuarterlyReportPeriod;
  kpi: QuarterlyReportKpi;
  byPriority: QuarterlyReportByPriority[];
  byService: QuarterlyReportByService[];
  weeklyTrend: QuarterlyReportTrendWeek[];
  comparison: QuarterlyReportComparison | null;
  incidents: QuarterlyReportIncidentDetail[];
}

export interface QuarterlyReportIncidentDetail {
  reference: string;
  description: string;
  status: string;
  priority: string;
  serviceEmetteur: string;
  serviceRecepteur: string;
  createdAt: string;
  rootCause: string | null;
  proposedSolution: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers trimestre                                                    */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function quarterStartEnd(quarter: number, year: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 2;       // 2, 5, 8, 11
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function formatPeriod(start: Date, end: Date, quarter: number): QuarterlyReportPeriod {
  const months: string[] = [];
  for (let m = start.getUTCMonth(); m <= end.getUTCMonth(); m++) {
    months.push(MONTH_NAMES[m]);
  }
  return {
    quarter,
    year: start.getUTCFullYear(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: `T${quarter} — ${start.getUTCFullYear()}`,
    months,
  };
}

function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

function weekStartEnd(week: number, year: number): { start: Date; end: Date } {
  const firstJan = new Date(Date.UTC(year, 0, 1));
  const dayNum = firstJan.getUTCDay() || 7;
  const daysToFirstMonday = (dayNum <= 4 ? 1 - dayNum : 8 - dayNum);
  const firstMonday = new Date(firstJan.getTime() + daysToFirstMonday * 86400000);
  const monday = new Date(firstMonday.getTime() + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return {
    start: new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0)),
    end: new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 23, 59, 59, 999)),
  };
}

/* ------------------------------------------------------------------ */
/*  Helper accès (copie de MonthlyReportService)                        */
/* ------------------------------------------------------------------ */

function isAdminLike(roles: string[]): boolean {
  const upper = roles.map((r) => r.toUpperCase());
  return upper.includes('ADMIN') || upper.includes('MANAGER') || upper.includes('CONTROLEUR');
}

function buildUserFilter(user: { id: number; roles: string[]; siteId?: number }) {
  if (isAdminLike(user.roles)) return {};
  return {
    OR: [
      { reporterId: user.id },
      ...(user.siteId !== undefined && user.siteId !== null
        ? [{ incidentSites: { some: { siteId: user.siteId } } }]
        : []),
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  QuarterlyReportService                                              */
/* ------------------------------------------------------------------ */

export class QuarterlyReportService {
  private async backlogAt(
    date: Date,
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<number> {
    const userFilter = buildUserFilter(user);
    return prisma.incident.count({
      where: {
        deletedAt: null,
        ...userFilter,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { lte: date },
        OR: [
          { resolvedAt: null },
          { resolvedAt: { gt: date } },
        ],
      },
    });
  }

  /**
   * Vérifie dynamiquement si un trimestre a au moins un incident dans l'historique.
   * Permet de déterminer si la comparaison T-1 est possible.
   */
  private async hasDataForQuarter(
    quarter: number,
    year: number,
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<boolean> {
    const { start, end } = quarterStartEnd(quarter, year);
    const userFilter = buildUserFilter(user);
    const found = await prisma.incident.findFirst({
      where: { deletedAt: null, ...userFilter, createdAt: { lte: end } },
      select: { id: true },
    });
    return found !== null;
  }

  async getQuarterlyReport(
    quarter: number,
    year: number,
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<QuarterlyReportData> {
    const { start, end } = quarterStartEnd(quarter, year);
    const period = formatPeriod(start, end, quarter);

    const userFilter = buildUserFilter(user);
    const baseWhere: any = { deletedAt: null, ...userFilter };

    // ── 1. Incidents créés et résolus durant le trimestre ──
    const [created, resolved, createdIncidents, resolvedIncidents] = await Promise.all([
      prisma.incident.count({
        where: { ...baseWhere, createdAt: { gte: start, lte: end } },
      }),
      prisma.incident.count({
        where: { ...baseWhere, resolvedAt: { gte: start, lte: end } },
      }),
      prisma.incident.findMany({
        where: { ...baseWhere, createdAt: { gte: start, lte: end } },
        select: { criticality: true, reporter: { select: { site: { select: { name: true } } } } },
      }),
      prisma.incident.findMany({
        where: { ...baseWhere, resolvedAt: { gte: start, lte: end } },
        select: { criticality: true, reporter: { select: { site: { select: { name: true } } } } },
      }),
    ]);

    // ── 2. Backlog début / fin de trimestre ──
    const quarterStartMinus1ms = new Date(start.getTime() - 1);
    const [backlogStart, backlogEnd] = await Promise.all([
      this.backlogAt(quarterStartMinus1ms, user),
      this.backlogAt(end, user),
    ]);

    // ── 3. Taux (cappé) ──
    const rawRate = created > 0 ? Math.round((resolved / created) * 10000) / 100 : null;
    const cappedRate = rawRate !== null ? Math.min(rawRate, 100) : 0;
    const extraResolvedFromStock = Math.max(0, resolved - created);

    // ── 4. Temps moyens ──
    const lifecycleRows = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        resolvedAt: { gte: start, lte: end },
        createdAt: { lte: end },
      },
      select: { createdAt: true, takenInChargeAt: true, resolvedAt: true },
    });

    const avgHours = (milestone: 'takenInChargeAt' | 'resolvedAt'): number | null => {
      const deltas = lifecycleRows
        .filter((r) => r[milestone] != null)
        .map((r) => Math.max(0, (r[milestone]!.getTime() - r.createdAt.getTime()) / 3600000));
      if (deltas.length === 0) return null;
      return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100;
    };

    // ── 5. Par priorité ──
    const priorityMap = new Map<string, { created: number; resolved: number }>();
    const priorityOrder = ['Critique', 'Haute', 'Moyenne', 'Basse'];

    const mapCriticality = (c: string): string => {
      switch (c) {
        case 'Critique': return 'Critique';
        case 'Haute': return 'Haute';
        case 'Moyenne': return 'Moyenne';
        case 'Faible': return 'Basse';
        default: return c;
      }
    };

    for (const inc of createdIncidents) {
      const label = mapCriticality(inc.criticality);
      const entry = priorityMap.get(label) ?? { created: 0, resolved: 0 };
      entry.created++;
      priorityMap.set(label, entry);
    }
    for (const inc of resolvedIncidents) {
      const label = mapCriticality(inc.criticality);
      const entry = priorityMap.get(label) ?? { created: 0, resolved: 0 };
      entry.resolved++;
      priorityMap.set(label, entry);
    }

    const byPriority: QuarterlyReportByPriority[] = priorityOrder
      .map((name) => {
        const entry = priorityMap.get(name) ?? { created: 0, resolved: 0 };
        return {
          name,
          created: entry.created,
          resolved: entry.resolved,
          rate: entry.created > 0
            ? Math.round((entry.resolved / entry.created) * 10000) / 100
            : null,
        };
      })
      .filter((p) => p.created > 0 || p.resolved > 0);

    // ── 6. Par service ──
    const serviceMap = new Map<string, { created: number; resolved: number }>();
    for (const inc of createdIncidents) {
      const siteName = (inc.reporter as any)?.site?.name ?? 'Non défini';
      const entry = serviceMap.get(siteName) ?? { created: 0, resolved: 0 };
      entry.created++;
      serviceMap.set(siteName, entry);
    }
    for (const inc of resolvedIncidents) {
      const siteName = (inc.reporter as any)?.site?.name ?? 'Non défini';
      const entry = serviceMap.get(siteName) ?? { created: 0, resolved: 0 };
      entry.resolved++;
      serviceMap.set(siteName, entry);
    }

    const byService: QuarterlyReportByService[] = Array.from(serviceMap.entries())
      .map(([name, v]) => ({
        name,
        created: v.created,
        resolved: v.resolved,
        rate: v.created > 0
          ? Math.round((v.resolved / v.created) * 10000) / 100
          : null,
      }))
      .sort((a, b) => b.created - a.created);

    // ── 7. Tendance hebdomadaire ──
    const weeklyTrend: QuarterlyReportTrendWeek[] = [];

    const quarterIncidents = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        OR: [
          { createdAt: { gte: start, lte: end } },
          { resolvedAt: { gte: start, lte: end } },
        ],
      },
      select: { createdAt: true, resolvedAt: true },
    });

    // Semaines qui intersectent avec le trimestre
    const weeksInQuarter = new Map<string, { created: number; resolved: number }>();

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const { week, year: wYear } = getWeekNumber(new Date(d));
      const key = `${wYear}-W${String(week).padStart(2, '0')}`;
      if (!weeksInQuarter.has(key)) {
        weeksInQuarter.set(key, { created: 0, resolved: 0 });
      }
    }

    for (const inc of quarterIncidents) {
      const { week, year: wYear } = getWeekNumber(inc.createdAt);
      const key = `${wYear}-W${String(week).padStart(2, '0')}`;
      const entry = weeksInQuarter.get(key) ?? { created: 0, resolved: 0 };
      entry.created++;
      weeksInQuarter.set(key, entry);
    }

    for (const inc of quarterIncidents) {
      if (inc.resolvedAt !== null) {
        const { week, year: wYear } = getWeekNumber(inc.resolvedAt);
        const key = `${wYear}-W${String(week).padStart(2, '0')}`;
        const entry = weeksInQuarter.get(key) ?? { created: 0, resolved: 0 };
        entry.resolved++;
        weeksInQuarter.set(key, entry);
      }
    }

    for (const [key, data] of weeksInQuarter.entries()) {
      const [yStr, wStr] = key.split('-W');
      const w = parseInt(wStr, 10);
      const y = parseInt(yStr, 10);
      const { start: wStart } = weekStartEnd(w, y);
      weeklyTrend.push({
        weekLabel: `Sem. ${w} — ${y}`,
        date: wStart.toISOString().slice(0, 10),
        created: data.created,
        resolved: data.resolved,
      });
    }

    weeklyTrend.sort((a, b) => a.date.localeCompare(b.date));

    // ── 8. Comparaison avec T-1 ──
    let comparison: QuarterlyReportComparison | null = null;
    const prevQuarter = quarter > 1 ? quarter - 1 : 4;
    const prevYear = quarter > 1 ? year : year - 1;

    if (await this.hasDataForQuarter(prevQuarter, prevYear, user)) {
      const prev = await this.getQuarterlyReport(prevQuarter, prevYear, user);

      comparison = {
        previousQuarter: prev.kpi,
        resolutionRateChange:
          rawRate !== null && prev.kpi.resolutionRate !== null
            ? Math.round((rawRate - prev.kpi.resolutionRate) * 100) / 100
            : null,
        createdChange:
          prev.kpi.created > 0
            ? Math.round(((created - prev.kpi.created) / prev.kpi.created) * 10000) / 100
            : null,
        resolvedChange:
          prev.kpi.resolved > 0
            ? Math.round(((resolved - prev.kpi.resolved) / prev.kpi.resolved) * 10000) / 100
            : null,
        backlogEndChange:
          prev.kpi.backlogEnd > 0
            ? Math.round(((backlogEnd - prev.kpi.backlogEnd) / prev.kpi.backlogEnd) * 10000) / 100
            : null,
        avgResolutionChange:
          avgHours('resolvedAt') !== null && prev.kpi.avgResolutionHours !== null
            ? Math.round(((avgHours('resolvedAt')! - prev.kpi.avgResolutionHours!) / prev.kpi.avgResolutionHours) * 10000) / 100
            : null,
      };
    }

    // ── 9. Incidents détaillés (max 50) ──
    const INCIDENT_LIMIT = 50;
    const rawIncidents = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        createdAt: { gte: start, lte: end },
      },
      select: {
        reference: true,
        description: true,
        status: true,
        criticality: true,
        createdAt: true,
        rootCause: true,
        proposedSolution: true,
        reporter: { select: { site: { select: { name: true } } } },
        incidentSites: { include: { site: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: INCIDENT_LIMIT + 1,
    });

    const limitedIncidents = rawIncidents.slice(0, INCIDENT_LIMIT);

    const incidents: QuarterlyReportIncidentDetail[] = limitedIncidents.map((inc) => {
      const mapPriority = (c: string) => {
        switch (c) { case 'Critique': return 'Critique'; case 'Haute': return 'Haute'; case 'Moyenne': return 'Moyenne'; case 'Faible': return 'Basse'; default: return c; }
      };
      const sites = (inc as any).incidentSites ?? [];
      const recepteur = Array.isArray(sites)
        ? sites.map((s: any) => s?.site?.name).filter(Boolean).join(', ')
        : '';
      return {
        reference: inc.reference,
        description: inc.description.length > 100 ? inc.description.slice(0, 100) + '…' : inc.description,
        status: inc.status,
        priority: mapPriority(inc.criticality),
        serviceEmetteur: (inc.reporter as any)?.site?.name ?? 'Non défini',
        serviceRecepteur: recepteur || '—',
        createdAt: inc.createdAt.toISOString().slice(0, 10),
        rootCause: inc.rootCause,
        proposedSolution: inc.proposedSolution,
      };
    });

    return {
      period,
      kpi: {
        created,
        resolved,
        resolutionRate: rawRate,
        cappedRate,
        extraResolvedFromStock,
        backlogStart,
        backlogEnd,
        avgResolutionHours: avgHours('resolvedAt'),
        avgTakeInChargeHours: avgHours('takenInChargeAt'),
      },
      byPriority,
      byService,
      weeklyTrend,
      comparison,
      incidents,
    };
  }

  /** Raccourci : rapport du trimestre courant */
  async getCurrentQuarterReport(
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<QuarterlyReportData> {
    const now = new Date();
    const month = now.getUTCMonth(); // 0-11
    const year = now.getUTCFullYear();
    const quarter = Math.floor(month / 3) + 1;
    return this.getQuarterlyReport(quarter, year, user);
  }

  /**
   * Génère une liste de tous les trimestres disponibles depuis le premier incident.
   */
  async getAvailableQuarters(
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<QuarterlyReportPeriod[]> {
    const userFilter = buildUserFilter(user);

    const firstIncident = await prisma.incident.findFirst({
      where: { deletedAt: null, ...userFilter },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    const minQuarter = firstIncident
      ? { quarter: Math.floor(firstIncident.createdAt.getUTCMonth() / 3) + 1, year: firstIncident.createdAt.getUTCFullYear() }
      : { quarter: currentQuarter, year: currentYear };

    const quarters: QuarterlyReportPeriod[] = [];
    let q = minQuarter.quarter;
    let y = minQuarter.year;

    while (true) {
      const { start, end } = quarterStartEnd(q, y);
      quarters.push(formatPeriod(start, end, q));

      if (y === currentYear && q >= currentQuarter) break;
      if (y > currentYear) break;

      q++;
      if (q > 4) {
        q = 1;
        y++;
      }
    }

    // Tri décroissant (le plus récent en premier)
    return quarters.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });
  }
}
