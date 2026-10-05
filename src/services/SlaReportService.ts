import prisma from '../infrastructure/database/prisma';

/* ------------------------------------------------------------------ */
/*  Types du rapport SLA (respect des délais)                          */
/* ------------------------------------------------------------------ */

export interface SlaReportKpi {
  resolved: number;          // incidents résolus sur la période
  respected: number;         // résolus avant dueDate (resolvedAt <= dueDate)
  breached: number;          // résolus après dueDate
  slaRate: number | null;    // respected / resolved * 100
  avgResolutionHours: number | null;
  avgTakeInChargeHours: number | null;
  overdueActive: number;     // incidents encore actifs (OPEN/IN_PROGRESS) en retard
}

export interface SlaRow {
  name: string;
  resolved: number;
  respected: number;
  breached: number;
  rate: number | null;
}

export interface SlaDelayedIncident {
  reference: string;
  description: string;
  status: string;
  priority: string;
  serviceEmetteur: string;
  createdAt: string;
  dueDate: string;
  resolvedAt: string | null;
  daysLate: number;          // jours de dépassement (>=1)
}

export interface SlaReportData {
  period: { label: string; startDate: string; endDate: string };
  kpi: SlaReportKpi;
  byPriority: SlaRow[];
  byService: SlaRow[];
  delayed: SlaDelayedIncident[];
}

/* ------------------------------------------------------------------ */
/*  Helpers accès (mêmes règles que les autres rapports)               */
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

function mapCriticality(c: string | null | undefined): string {
  switch (c) {
    case 'Critique': return 'Critique';
    case 'Haute': return 'Haute';
    case 'Moyenne': return 'Moyenne';
    case 'Faible': return 'Basse';
    default: return c || 'Non défini';
  }
}

const PRIORITY_ORDER = ['Critique', 'Haute', 'Moyenne', 'Basse'];

/* ------------------------------------------------------------------ */
/*  SlaReportService                                                   */
/* ------------------------------------------------------------------ */

export class SlaReportService {
  /**
   * Rapport de respect des délais sur une période bornée [start, end].
   * Périmètre : incidents résolus pendant la période (défini par resolvedAt).
   */
  async getReport(
    start: Date,
    end: Date,
    user: { id: number; roles: string[]; siteId?: number },
  ): Promise<SlaReportData> {
    const userFilter = buildUserFilter(user);
    const baseWhere: any = { deletedAt: null, ...userFilter };

    // ── 1. Incidents résolus pendant la période ──
    const resolvedIncidents = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        resolvedAt: { gte: start, lte: end },
      },
      select: {
        reference: true,
        description: true,
        status: true,
        criticality: true,
        createdAt: true,
        dueDate: true,
        resolvedAt: true,
        takenInChargeAt: true,
        reporter: { select: { site: { select: { name: true } } } },
      },
    });

    const resolved = resolvedIncidents.length;
    const respected = resolvedIncidents.filter(
      (inc) => inc.dueDate && inc.resolvedAt && inc.resolvedAt.getTime() <= inc.dueDate.getTime()
    ).length;
    const breached = resolved - respected;
    const slaRate = resolved > 0 ? Math.round((respected / resolved) * 10000) / 100 : null;

    // ── 2. Temps moyens (résolution / prise en charge) ──
    const avgHours = (milestone: 'takenInChargeAt' | 'resolvedAt'): number | null => {
      const deltas = resolvedIncidents
        .filter((r) => r[milestone] != null)
        .map((r) => Math.max(0, (r[milestone]!.getTime() - r.createdAt.getTime()) / 3600000));
      if (deltas.length === 0) return null;
      return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100;
    };

    // ── 3. Backlog actif en retard aujourd'hui ──
    const now = new Date();
    const overdueActive = await prisma.incident.count({
      where: {
        ...baseWhere,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueDate: { lt: now },
      },
    });

    // ── 4. Par priorité (parmi les résolus de la période) ──
    const prioMap = new Map<string, { resolved: number; respected: number }>();
    for (const inc of resolvedIncidents) {
      const label = mapCriticality(inc.criticality);
      const entry = prioMap.get(label) ?? { resolved: 0, respected: 0 };
      entry.resolved++;
      if (inc.dueDate && inc.resolvedAt && inc.resolvedAt.getTime() <= inc.dueDate.getTime()) {
        entry.respected++;
      }
      prioMap.set(label, entry);
    }

    const byPriority: SlaRow[] = PRIORITY_ORDER.map((name) => {
      const entry = prioMap.get(name) ?? { resolved: 0, respected: 0 };
      return {
        name,
        resolved: entry.resolved,
        respected: entry.respected,
        breached: entry.resolved - entry.respected,
        rate: entry.resolved > 0 ? Math.round((entry.respected / entry.resolved) * 10000) / 100 : null,
      };
    }).filter((r) => r.resolved > 0);

    // ── 5. Par service (parmi les résolus de la période) ──
    const serviceMap = new Map<string, { resolved: number; respected: number }>();
    for (const inc of resolvedIncidents) {
      const siteName = (inc.reporter as any)?.site?.name ?? 'Non défini';
      const entry = serviceMap.get(siteName) ?? { resolved: 0, respected: 0 };
      entry.resolved++;
      if (inc.dueDate && inc.resolvedAt && inc.resolvedAt.getTime() <= inc.dueDate.getTime()) {
        entry.respected++;
      }
      serviceMap.set(siteName, entry);
    }

    const byService: SlaRow[] = Array.from(serviceMap.entries())
      .map(([name, v]) => ({
        name,
        resolved: v.resolved,
        respected: v.respected,
        breached: v.resolved - v.respected,
        rate: v.resolved > 0 ? Math.round((v.respected / v.resolved) * 10000) / 100 : null,
      }))
      .sort((a, b) => b.resolved - a.resolved);

    // ── 6. Détail des retards (résolus en retard sur la période + actifs en retard) ──
    // Prisma ne permet pas de comparer deux colonnes dans un WHERE : on récupère les
    // candidats (résolus de la période OU actifs en retard) puis on filtre en JS.
    const DELAY_LIMIT = 100;
    const delayedRaw = await prisma.incident.findMany({
      where: {
        ...baseWhere,
        OR: [
          // résolus pendant la période (on vérifiera le dépassement en JS)
          { resolvedAt: { gte: start, lte: end } },
          // encore actifs en retard aujourd'hui
          { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: now } },
        ],
      },
      select: {
        reference: true,
        description: true,
        status: true,
        criticality: true,
        createdAt: true,
        dueDate: true,
        resolvedAt: true,
        reporter: { select: { site: { select: { name: true } } } },
      },
      orderBy: { dueDate: 'asc' },
      take: DELAY_LIMIT * 4, // marge pour couvrir les cas résolus en retard après filtrage JS
    });

    const delayed: SlaDelayedIncident[] = delayedRaw
      .filter((inc) => {
        // Vrai retard : la résolution (si présente) dépasse dueDate, sinon dueDate est déjà
        // dépassée à aujourd'hui pour un incident encore actif.
        if (inc.resolvedAt) return inc.dueDate.getTime() < inc.resolvedAt.getTime();
        return inc.dueDate.getTime() < now.getTime();
      })
      .slice(0, DELAY_LIMIT)
      .map((inc) => {
        const refDate = inc.resolvedAt ?? now;
        const daysLate = Math.max(
          1,
          Math.floor((refDate.getTime() - inc.dueDate.getTime()) / 86400000)
        );
        return {
          reference: inc.reference,
          description: inc.description.length > 90 ? inc.description.slice(0, 90) + '…' : inc.description,
          status: inc.status,
          priority: mapCriticality(inc.criticality),
          serviceEmetteur: (inc.reporter as any)?.site?.name ?? 'Non défini',
          createdAt: inc.createdAt.toISOString().slice(0, 10),
          dueDate: inc.dueDate.toISOString().slice(0, 10),
          resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString().slice(0, 10) : null,
          daysLate,
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate);

    return {
      period: {
        label: '',
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      },
      kpi: {
        resolved,
        respected,
        breached,
        slaRate,
        avgResolutionHours: avgHours('resolvedAt'),
        avgTakeInChargeHours: avgHours('takenInChargeAt'),
        overdueActive,
      },
      byPriority,
      byService,
      delayed,
    };
  }
}
