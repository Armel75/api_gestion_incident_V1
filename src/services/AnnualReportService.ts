import prisma from '../infrastructure/database/prisma';

/* ------------------------------------------------------------------ */
/*  Types du rapport annuel (bilan)                                    */
/* ------------------------------------------------------------------ */

export interface AnnualReportPeriod {
  year: number;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  label: string;     // "2026"
}

export interface AnnualReportKpi {
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

export interface AnnualReportComparison {
  previousYear: AnnualReportKpi;
  resolutionRateChange: number | null; // points
  createdChange: number | null; // %
  resolvedChange: number | null; // %
  backlogEndChange: number | null; // %
  avgResolutionChange: number | null; // %
}

export interface AnnualReportByPriority {
  name: string;
  created: number;
  resolved: number;
  rate: number | null;
}

export interface AnnualReportByService {
  name: string;
  created: number;
  resolved: number;
  rate: number | null;
}

export interface AnnualReportQuarter {
  quarter: number; // 1-4
  label: string;   // "T1 — 2026"
  created: number;
  resolved: number;
  rate: number | null;
}

export interface AnnualReportMonth {
  month: number; // 1-12
  label: string; // "Janvier"
  created: number;
  resolved: number;
}

export interface AnnualReportData {
  period: AnnualReportPeriod;
  kpi: AnnualReportKpi;
  byPriority: AnnualReportByPriority[];
  byService: AnnualReportByService[];
  byQuarter: AnnualReportQuarter[];
  monthlyTrend: AnnualReportMonth[];
  comparison: AnnualReportComparison | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers année                                                      */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const QUARTER_LABELS = ['T1', 'T2', 'T3', 'T4'];

function yearStartEnd(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

function formatPeriod(start: Date, end: Date): AnnualReportPeriod {
  return {
    year: start.getUTCFullYear(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: String(start.getUTCFullYear()),
  };
}

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
/*  AnnualReportService                                                */
/* ------------------------------------------------------------------ */

export class AnnualReportService {
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

  /** Vérifie si l'année donnée a au moins un incident (historique). */
  private async hasDataForYear(
    year: number,
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<boolean> {
    const { end } = yearStartEnd(year);
    const userFilter = buildUserFilter(user);
    const found = await prisma.incident.findFirst({
      where: { deletedAt: null, ...userFilter, createdAt: { lte: end } },
      select: { id: true },
    });
    return found !== null;
  }

  async getAnnualReport(
    year: number,
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<AnnualReportData> {
    const { start, end } = yearStartEnd(year);
    const period = formatPeriod(start, end);

    const userFilter = buildUserFilter(user);
    const baseWhere: any = { deletedAt: null, ...userFilter };

    // ── 1. Incidents créés et résolus durant l'année ──
    const [created, resolved, createdIncidents, resolvedIncidents] = await Promise.all([
      prisma.incident.count({
        where: { ...baseWhere, createdAt: { gte: start, lte: end } },
      }),
      prisma.incident.count({
        where: { ...baseWhere, resolvedAt: { gte: start, lte: end } },
      }),
      prisma.incident.findMany({
        where: { ...baseWhere, createdAt: { gte: start, lte: end } },
        select: { criticality: true, createdAt: true, reporter: { select: { site: { select: { name: true } } } } },
      }),
      prisma.incident.findMany({
        where: { ...baseWhere, resolvedAt: { gte: start, lte: end } },
        select: { criticality: true, resolvedAt: true, reporter: { select: { site: { select: { name: true } } } } },
      }),
    ]);

    // ── 2. Backlog début / fin d'année ──
    const yearStartMinus1ms = new Date(start.getTime() - 1);
    const [backlogStart, backlogEnd] = await Promise.all([
      this.backlogAt(yearStartMinus1ms, user),
      this.backlogAt(end, user),
    ]);

    // ── 3. Taux (cappé) ──
    const rawRate = created > 0 ? Math.round((resolved / created) * 10000) / 100 : null;
    const cappedRate = rawRate !== null ? Math.min(rawRate, 100) : 0;
    const extraResolvedFromStock = Math.max(0, resolved - created);

    // ── 4. Temps moyens (résolution / prise en charge) ──
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

    // ── 5. Par priorité (annuel) ──
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

    const byPriority: AnnualReportByPriority[] = priorityOrder
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

    // ── 6. Par service (annuel) ──
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

    const byService: AnnualReportByService[] = Array.from(serviceMap.entries())
      .map(([name, v]) => ({
        name,
        created: v.created,
        resolved: v.resolved,
        rate: v.created > 0
          ? Math.round((v.resolved / v.created) * 10000) / 100
          : null,
      }))
      .sort((a, b) => b.created - a.created);

    // ── 7. Tendance mensuelle (12 mois) ──
    const monthlyMap = new Map<number, { created: number; resolved: number }>();
    for (const inc of createdIncidents) {
      const m = inc.createdAt.getUTCMonth() + 1;
      const entry = monthlyMap.get(m) ?? { created: 0, resolved: 0 };
      entry.created++;
      monthlyMap.set(m, entry);
    }
    for (const inc of resolvedIncidents) {
      const m = inc.resolvedAt!.getUTCMonth() + 1;
      const entry = monthlyMap.get(m) ?? { created: 0, resolved: 0 };
      entry.resolved++;
      monthlyMap.set(m, entry);
    }

    const monthlyTrend: AnnualReportMonth[] = [];
    for (let m = 1; m <= 12; m++) {
      const data = monthlyMap.get(m) ?? { created: 0, resolved: 0 };
      monthlyTrend.push({
        month: m,
        label: MONTH_NAMES[m - 1],
        created: data.created,
        resolved: data.resolved,
      });
    }

    // ── 8. Répartition par trimestre (4) ──
    const byQuarter: AnnualReportQuarter[] = [];
    for (let q = 1; q <= 4; q++) {
      const qStartMonth = (q - 1) * 3;
      let qCreated = 0;
      let qResolved = 0;
      for (let m = qStartMonth + 1; m <= qStartMonth + 3; m++) {
        const data = monthlyMap.get(m);
        if (data) {
          qCreated += data.created;
          qResolved += data.resolved;
        }
      }
      byQuarter.push({
        quarter: q,
        label: `${QUARTER_LABELS[q - 1]} — ${year}`,
        created: qCreated,
        resolved: qResolved,
        rate: qCreated > 0 ? Math.round((qResolved / qCreated) * 10000) / 100 : null,
      });
    }

    // ── 9. Comparaison avec N-1 ──
    let comparison: AnnualReportComparison | null = null;
    const prevYear = year - 1;

    if (await this.hasDataForYear(prevYear, user)) {
      const prev = await this.getAnnualReport(prevYear, user);

      comparison = {
        previousYear: prev.kpi,
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
      byQuarter,
      monthlyTrend,
      comparison,
    };
  }

  /** Raccourci : bilan de l'année courante. */
  async getCurrentYearReport(
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<AnnualReportData> {
    const year = new Date().getUTCFullYear();
    return this.getAnnualReport(year, user);
  }

  /**
   * Liste des années disponibles depuis le premier incident,
   * triée du plus récent au plus ancien.
   */
  async getAvailableYears(
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<AnnualReportPeriod[]> {
    const userFilter = buildUserFilter(user);

    const firstIncident = await prisma.incident.findFirst({
      where: { deletedAt: null, ...userFilter },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const currentYear = new Date().getUTCFullYear();
    const minYear = firstIncident
      ? firstIncident.createdAt.getUTCFullYear()
      : currentYear;

    const years: AnnualReportPeriod[] = [];
    for (let y = minYear; y <= currentYear; y++) {
      const { start, end } = yearStartEnd(y);
      years.push(formatPeriod(start, end));
    }

    return years.sort((a, b) => b.year - a.year);
  }
}
