import ExcelJS from 'exceljs';

/* ------------------------------------------------------------------ */
/*  Types génériques partagés par les rapports (hebdo / mensuel /      */
/*  trimestriel). Toutes les données sont normalisées avant d'appeler  */
/*  ce service.                                                        */
/* ------------------------------------------------------------------ */

export interface ReportRow {
  name: string;
  created: number;
  resolved: number;
  rate: number | null;
}

export interface ReportTrendRow {
  label: string;
  created: number;
  resolved: number;
}

export interface ReportIncidentDetail {
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

export interface ReportKpi {
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

export interface ReportComparison {
  previousLabel: string; // "S-1", "M-1" ou "T-1"
  currentKpi: ReportKpi;
  previousKpi: ReportKpi;
  resolutionRateChange: number | null; // points
  createdChange: number | null; // %
  resolvedChange: number | null; // %
  backlogEndChange: number | null; // % (inversé)
  avgResolutionChange: number | null; // % (inversé)
}

export interface ReportExcelOptions {
  sheetTitle: string; // "Rapport Hebdomadaire" …
  reportTitle: string; // "RAPPORT HEBDOMADAIRE"
  periodLabel: string; // "Semaine 30 — 2026"
  periodStart: string;
  periodEnd: string;
  kpi: ReportKpi;
  byService: ReportRow[];
  byPriority: ReportRow[];
  trendTitle: string; // "Tendance journalière" / "Tendance hebdomadaire" / "Tendance mensuelle"
  trend: ReportTrendRow[];
  /** Optionnel : ventilation par trimestre (utilisé par le rapport annuel). */
  quarterly?: ReportRow[];
  comparison: ReportComparison | null;
  incidents: ReportIncidentDetail[];
  /** Si true, n'ajoute pas de feuille « Incidents » (rapport annuel = stats seules). */
  skipIncidentsSheet?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Charte graphique (vert SOREPCO, cohérent avec les templates PDF)   */
/* ------------------------------------------------------------------ */

const C = {
  greenDark: 'FF14532D', // bandeau principal
  green: 'FF166534', // titres de sections + en-têtes
  greenMedium: 'FF16A34A', // accents
  greenLight: 'FFDCFCE7', // bordures section
  bgSoft: 'FFF0FDF4', // alternance / fond doux
  bgSoft2: 'FFFAFFFB',
  white: 'FFFFFFFF',
  slateText: 'FF334155',
  muted: 'FF64748B',
  faint: 'FF94A3B8',
  border: 'FFCBD5E1',
  amber: 'FFF59E0B',
  amberBg: 'FFFFF4E5',
  blue: 'FF2563EB',
  blueBg: 'FFEFF6FF',
  red: 'FFDC2626',
  redBg: 'FFFEE2E2',
  greenText: 'FF16A34A',
};

/* ------------------------------------------------------------------ */
/*  Petits helpers d'écriture                                          */
/* ------------------------------------------------------------------ */

type Cell = ExcelJS.Cell;

const setFill = (c: Cell, argb: string) => {
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

const setBorder = (
  c: Cell,
  opts: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean; color?: string } = {}
) => {
  const color = opts.color ?? C.border;
  const style = 'thin' as const;
  c.border = {
    top: opts.top ? { style, color: { argb: color } } : undefined,
    bottom: opts.bottom ? { style, color: { argb: color } } : undefined,
    left: opts.left ? { style, color: { argb: color } } : undefined,
    right: opts.right ? { style, color: { argb: color } } : undefined,
  } as any;
};

const setThinBox = (c: Cell, color: string = C.border) =>
  setBorder(c, { top: true, bottom: true, left: true, right: true, color });

const fmtDateFr = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtHours = (v: number | null): string => (v === null || v === undefined ? '—' : `${v.toFixed(1)} h`);

const fmtRate = (v: number | null): string => (v === null || v === undefined ? 'N/A' : `${v.toFixed(1)}%`);

/* ------------------------------------------------------------------ */
/*  Construction du classeur                                           */
/* ------------------------------------------------------------------ */

export async function buildReportWorkbook(opts: ReportExcelOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SOREPCO — Gestion des Incidents';
  wb.created = new Date();

  const ws = wb.addWorksheet('Rapport');
  ws.properties.tabColor = { argb: '16A34A' };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };

  // Largeurs de colonnes partagées par les sections
  ws.columns = [
    { width: 6 }, // A : marge / épaule
    { width: 40 }, // B : libellé principal
    { width: 16 }, // C
    { width: 16 }, // D
    { width: 18 }, // E
    { width: 16 }, // F
    { width: 18 }, // G
    { width: 16 }, // H
    { width: 22 }, // I : notes
  ];

  const COLS = 9; // A..I

  /* ── Ligne 1 : bandeau titre ── */
  ws.mergeCells(1, 1, 1, COLS);
  const t = ws.getCell('A1');
  t.value = opts.reportTitle;
  t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: C.white } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  setFill(t, C.greenDark);
  ws.getRow(1).height = 34;

  /* ── Ligne 2 : période ── */
  ws.mergeCells(2, 1, 2, COLS);
  const p = ws.getCell('A2');
  p.value = `${opts.periodLabel} — du ${fmtDateFr(opts.periodStart)} au ${fmtDateFr(opts.periodEnd)}`;
  p.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C.white } };
  p.alignment = { horizontal: 'center', vertical: 'middle' };
  setFill(p, C.greenMedium);
  ws.getRow(2).height = 22;

  /* ── Ligne 3 : date d'export ── */
  ws.mergeCells(3, 1, 3, COLS);
  const e = ws.getCell('A3');
  e.value = `Exporté le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  e.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C.muted } };
  e.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 16;

  let row = 5; // prochaine ligne libre

  /* ════════ SECTION : Indicateurs clés ════════ */
  row = writeSectionTitle(ws, row, 'Indicateurs clés');
  const kpi = opts.kpi;

  const kpiCards: { label: string; value: string; note?: string; bg: string; fg: string }[] = [
    { label: 'Créés', value: String(kpi.created), bg: C.blueBg, fg: C.blue },
    { label: 'Résolus', value: String(kpi.resolved), bg: C.bgSoft, fg: C.greenText },
    {
      label: 'Taux de résolution',
      value: fmtRate(kpi.resolutionRate),
      note: kpi.extraResolvedFromStock > 0 ? `Dont ${kpi.extraResolvedFromStock} d’anciens stocks` : undefined,
      bg: C.amberBg,
      fg: C.amber,
    },
    { label: 'Backlog début', value: String(kpi.backlogStart), bg: C.bgSoft2, fg: C.slateText },
    { label: 'Backlog fin', value: String(kpi.backlogEnd), bg: C.bgSoft2, fg: C.slateText },
    { label: 'Tps moyen résolution', value: fmtHours(kpi.avgResolutionHours), bg: C.bgSoft2, fg: C.slateText },
    { label: 'Tps moyen prise en charge', value: fmtHours(kpi.avgTakeInChargeHours), bg: C.bgSoft2, fg: C.slateText },
  ];

  // 4 cartes par ligne : chaque carte occupe 2 colonnes (B-C, D-E, F-G, H-I)
  const colGroups: [number, number][] = [
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
  ];
  for (let i = 0; i < kpiCards.length; i += 4) {
    const lineCards = kpiCards.slice(i, i + 4);
    for (let j = 0; j < lineCards.length; j++) {
      const card = lineCards[j];
      const [c1, c2] = colGroups[j];
      writeKpiCard(ws, row, c1, c2, card);
    }
    row += 2;
  }

  row += 1; // espace après KPI

  /* ════════ SECTION : Comparaison ════════ */
  if (opts.comparison) {
    row = writeSectionTitle(ws, row, `Comparaison ${opts.comparison.previousLabel}`);
    const cmp = opts.comparison;
    row = writeTableHeader(ws, row, ['Indicateur', 'Période courante', `Période précédente`, 'Variation'], 4);
    row = writeComparisonRow(
      ws, row, 'Créés',
      String(cmp.currentKpi.created),
      String(cmp.previousKpi.created),
      cmp.createdChange, '%', false
    );
    row = writeComparisonRow(
      ws, row, 'Résolus',
      String(cmp.currentKpi.resolved),
      String(cmp.previousKpi.resolved),
      cmp.resolvedChange, '%', false
    );
    row = writeComparisonRow(
      ws, row, 'Taux de résolution',
      fmtRate(cmp.currentKpi.resolutionRate),
      fmtRate(cmp.previousKpi.resolutionRate),
      cmp.resolutionRateChange, 'pts', false
    );
    row = writeComparisonRow(
      ws, row, 'Backlog fin',
      String(cmp.currentKpi.backlogEnd),
      String(cmp.previousKpi.backlogEnd),
      cmp.backlogEndChange, '%', true
    );
    row = writeComparisonRow(
      ws, row, 'Tps moyen résolution',
      fmtHours(cmp.currentKpi.avgResolutionHours),
      fmtHours(cmp.previousKpi.avgResolutionHours),
      cmp.avgResolutionChange, '%', true
    );
    row += 1;
  }

  /* ════════ SECTION : Par trimestre (rapport annuel) ════════ */
  if (opts.quarterly && opts.quarterly.length > 0) {
    row = writeSectionTitle(ws, row, 'Répartition par trimestre');
    row = writeTableHeader(ws, row, ['Trimestre', 'Créés', 'Résolus', 'Taux'], 4);
    row = writeDistributionRows(ws, row, opts.quarterly, 'Aucune donnée pour cette période');
    row += 1;
  }

  /* ════════ SECTION : Par service ════════ */
  row = writeSectionTitle(ws, row, 'Répartition par service');
  row = writeTableHeader(ws, row, ['Service', 'Créés', 'Résolus', 'Taux'], 4);
  row = writeDistributionRows(ws, row, opts.byService, 'Aucune donnée pour cette période');
  row += 1;

  /* ════════ SECTION : Par priorité ════════ */
  row = writeSectionTitle(ws, row, 'Répartition par priorité');
  row = writeTableHeader(ws, row, ['Priorité', 'Créés', 'Résolus', 'Taux'], 4);
  row = writeDistributionRows(ws, row, opts.byPriority, 'Aucune donnée pour cette période');
  row += 1;

  /* ════════ SECTION : Tendance ════════ */
  row = writeSectionTitle(ws, row, opts.trendTitle);
  row = writeTableHeader(ws, row, ['Période', 'Créés', 'Résolus'], 3);
  if (opts.trend.length === 0) {
    row = writeEmptyRow(ws, row, 'Aucune donnée pour cette période', 3);
  } else {
    opts.trend.forEach((tr) => {
      const r = ws.getRow(row);
      r.values = [undefined, tr.label, tr.created, tr.resolved];
      r.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
        if (col < 2 || col > 4) return;
        c.font = { name: 'Calibri', size: 10, color: { argb: C.slateText } };
        if (col > 2) c.alignment = { horizontal: 'center' };
        setThinBox(c);
        if ((row - 1) % 2 === 0) setFill(c, C.bgSoft);
      });
      row += 1;
    });
  }
  row += 1;

  /* ════════ Pied de page ════════ */
  ws.mergeCells(row, 1, row, COLS);
  const foot = ws.getCell(row, 1);
  foot.value = 'Document généré automatiquement par SOREPCO — Gestion des Incidents';
  foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: C.faint } };
  foot.alignment = { horizontal: 'center' };
  ws.getRow(row).height = 16;

  /* ── Feuille : Incidents (sauf pour le rapport annuel) ── */
  if (!opts.skipIncidentsSheet) {
    writeIncidentsSheet(wb, opts);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/* ------------------------------------------------------------------ */
/*  Helpers d'écriture par section                                     */
/* ------------------------------------------------------------------ */

/** Écrit un titre de section vert et retourne la ligne suivante. */
function writeSectionTitle(ws: ExcelJS.Worksheet, row: number, label: string): number {
  const r = ws.getRow(row);
  r.values = [undefined, label];
  const cell = r.getCell(2);
  cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: C.green } };
  // fine ligne soulignée sur la largeur utile
  for (let c = 2; c <= 9; c++) {
    const b = ws.getRow(row).getCell(c);
    b.border = { bottom: { style: 'medium', color: { argb: C.greenLight } } } as any;
  }
  ws.getRow(row).height = 20;
  return row + 1;
}

/** Écrit une ligne d'en-tête de tableau (fond vert, texte blanc). */
function writeTableHeader(ws: ExcelJS.Worksheet, row: number, labels: string[], cols: number): number {
  const r = ws.getRow(row);
  for (let i = 0; i < cols; i++) {
    const c = r.getCell(2 + i);
    c.value = labels[i];
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } };
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    setFill(c, C.green);
    setThinBox(c, C.green);
  }
  ws.getRow(row).height = 20;
  return row + 1;
}

/** Une carte KPI : ligne du haut = libellé (fusionnée), ligne du bas = valeur. */
function writeKpiCard(
  ws: ExcelJS.Worksheet,
  row: number,
  col1: number,
  col2: number,
  card: { label: string; value: string; note?: string; bg: string; fg: string }
) {
  // Ligne libellé
  ws.mergeCells(row, col1, row, col2);
  const lc = ws.getCell(row, col1);
  lc.value = card.label;
  lc.font = { name: 'Calibri', size: 8, bold: true, color: { argb: C.muted } };
  lc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  setFill(lc, card.bg);
  setThinBox(lc, card.bg);
  ws.getRow(row).height = 15;

  // Ligne valeur
  ws.mergeCells(row + 1, col1, row + 1, col2);
  const vc = ws.getCell(row + 1, col1);
  vc.value = card.note ? `${card.value}\n${card.note}` : card.value;
  vc.font = {
    name: 'Calibri',
    size: card.value.length > 8 ? 12 : 16,
    bold: true,
    color: { argb: card.fg },
  };
  vc.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: Boolean(card.note),
  };
  setFill(vc, card.bg);
  setThinBox(vc, card.bg);

  ws.getRow(row + 1).height = card.note ? 38 : 30;
}

function writeDistributionRows(
  ws: ExcelJS.Worksheet,
  row: number,
  items: ReportRow[],
  emptyMessage: string
): number {
  if (!items.length) return writeEmptyRow(ws, row, emptyMessage, 4);

  items.forEach((s) => {
    const r = ws.getRow(row);
    r.values = [undefined, s.name, s.created, s.resolved, s.rate !== null ? Number(s.rate.toFixed(1)) : 'N/A'];
    r.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      if (col < 2 || col > 5) return;
      c.font = { name: 'Calibri', size: 10, color: { argb: C.slateText } };
      if (col === 2) c.alignment = { horizontal: 'left' };
      else {
        c.alignment = { horizontal: 'center' };
        if (col === 5) {
          // formatage conditionnel du taux
          const val = s.rate;
          if (val !== null) {
            if (val >= 90) {
              c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.greenText } };
            } else if (val >= 60) {
              c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.amber } };
            } else {
              c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
            }
            c.numFmt = '0.0"%"';
          } else {
            c.value = 'N/A';
          }
        }
      }
      setThinBox(c);
      if ((row - 1) % 2 === 0) setFill(c, C.bgSoft);
    });
    row += 1;
  });
  return row;
}

function writeComparisonRow(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  current: string,
  previous: string,
  change: number | null,
  unit: 'pts' | '%',
  inverse: boolean
): number {
  const r = ws.getRow(row);
  r.values = [undefined, label, current, previous, formatChange(change, unit)];
  const changeCell = r.getCell(5);
  if (change !== null) {
    const abs = Math.abs(change);
    const isGood = inverse ? change < 0 : change > 0;
    changeCell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: Math.abs(change) < 0.01 ? C.muted : isGood ? C.greenText : C.red },
    };
    const arrow = Math.abs(change) < 0.01 ? '→' : isGood ? '▲' : '▼';
    changeCell.value = `${arrow} ${abs.toFixed(1)} ${unit === 'pts' ? 'pts' : '%'}`;
  } else {
    changeCell.value = '—';
    changeCell.font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
  }
  r.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
    if (col < 2 || col > 5) return;
    if (col === 2) c.alignment = { horizontal: 'left' };
    else c.alignment = { horizontal: 'center' };
    if (col < 5) c.font = { name: 'Calibri', size: 10, color: { argb: C.slateText } };
    setThinBox(c);
    if ((row - 1) % 2 === 0) setFill(c, C.bgSoft);
  });
  return row + 1;
}

function formatChange(change: number | null, unit: 'pts' | '%'): string {
  if (change === null) return '—';
  return `${change.toFixed(1)}${unit === 'pts' ? ' pts' : '%'}`;
}

function writeEmptyRow(ws: ExcelJS.Worksheet, row: number, message: string, cols: number): number {
  const r = ws.getRow(row);
  ws.mergeCells(row, 2, row, 1 + cols);
  const c = r.getCell(2);
  c.value = message;
  c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: C.faint } };
  c.alignment = { horizontal: 'left' };
  return row + 1;
}

/* ------------------------------------------------------------------ */
/*  Feuille Incidents                                                  */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Clôturé',
  CANCELLED: 'Annulé',
};

const STATUS_BG: Record<string, string> = {
  OPEN: 'FFDBEAFE',
  IN_PROGRESS: 'FFFEF3C7',
  RESOLVED: 'FFDCFCE7',
  CLOSED: 'FFE2E8F0',
  CANCELLED: 'FFFEE2E2',
};

function writeIncidentsSheet(wb: ExcelJS.Workbook, opts: ReportExcelOptions) {
  const ws = wb.addWorksheet('Incidents');
  ws.properties.tabColor = { argb: '2563EB' };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.columns = [
    { width: 5 },
    { width: 16 }, // Référence
    { width: 42 }, // Description
    { width: 14 }, // Statut
    { width: 12 }, // Priorité
    { width: 24 }, // Service émetteur
    { width: 24 }, // Service récepteur
    { width: 14 }, // Créé le
    { width: 34 }, // Cause racine
    { width: 34 }, // Solution proposée
  ];

  // Bandeau titre
  ws.mergeCells(1, 1, 1, 10);
  const t = ws.getCell('A1');
  t.value = `${opts.reportTitle} — Détail des incidents`;
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C.white } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  setFill(t, C.greenDark);
  ws.getRow(1).height = 28;

  // En-têtes
  const headers = [
    'Référence',
    'Description',
    'Statut',
    'Priorité',
    'Service émetteur',
    'Service récepteur',
    'Créé le',
    'Cause racine',
    'Solution proposée',
  ];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(2 + i);
    c.value = h;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    setFill(c, C.blue);
    setThinBox(c, C.blue);
  });
  headerRow.height = 22;

  let r = 4;
  if (opts.incidents.length === 0) {
    ws.mergeCells(r, 2, r, 10);
    const c = ws.getCell(r, 2);
    c.value = 'Aucun incident créé sur cette période';
    c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: C.faint } };
    return;
  }

  opts.incidents.forEach((inc) => {
    const row = ws.getRow(r);
    const statusLbl = STATUS_LABELS[inc.status] || inc.status;
    row.values = [
      undefined,
      inc.reference,
      inc.description,
      statusLbl,
      inc.priority,
      inc.serviceEmetteur,
      inc.serviceRecepteur,
      inc.createdAt,
      inc.rootCause || '—',
      inc.proposedSolution || '—',
    ];
    row.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      if (col < 2 || col > 10) return;
      c.font = { name: 'Calibri', size: 9, color: { argb: C.slateText } };
      if (col === 2) c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.green } };
      c.alignment = { vertical: 'top', wrapText: col === 3 || col === 8 || col === 9 || col === 10 };
      if (col >= 3 && col !== 4 && col !== 6 && col !== 7 && col !== 5) {
        c.alignment = { vertical: 'top', horizontal: 'center' };
      }
      setThinBox(c);
      if ((r - 1) % 2 === 0) setFill(c, C.bgSoft);
    });
    // Coloration du statut
    const st = row.getCell(4);
    const bg = STATUS_BG[inc.status];
    if (bg) setFill(st, bg);

    // Priorité colorée
    const pr = row.getCell(5);
    if (inc.priority === 'Critique') pr.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.red } };
    else if (inc.priority === 'Haute') pr.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.amber } };
    else if (inc.priority === 'Basse') pr.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.muted } };

    row.height = Math.max(18, Math.ceil((inc.description.length + (inc.rootCause?.length ?? 0)) / 90) * 14);
    r += 1;
  });
}
