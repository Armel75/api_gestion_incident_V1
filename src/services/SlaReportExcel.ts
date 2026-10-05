import ExcelJS from 'exceljs';
import type { SlaReportData } from './SlaReportService';

/* Charte graphique (vert SOREPCO) cohérente avec les autres exports Excel */
const C = {
  greenDark: 'FF14532D',
  green: 'FF166534',
  greenMedium: 'FF16A34A',
  greenLight: 'FFDCFCE7',
  bgSoft: 'FFF0FDF4',
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

type Cell = ExcelJS.Cell;

const setFill = (c: Cell, argb: string) => {
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

const setBox = (c: Cell, color: string = C.border) => {
  const style = 'thin' as const;
  c.border = {
    top: { style, color: { argb: color } },
    bottom: { style, color: { argb: color } },
    left: { style, color: { argb: color } },
    right: { style, color: { argb: color } },
  } as any;
};

const fmtDateFr = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export async function buildSlaWorkbook(data: SlaReportData, periodLabel: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SOREPCO — Gestion des Incidents';
  wb.created = new Date();

  const ws = wb.addWorksheet('Respect des délais');
  ws.properties.tabColor = { argb: '16A34A' };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };

  ws.columns = [
    { width: 6 },  // A
    { width: 34 }, // B : libellé principal
    { width: 16 }, // C
    { width: 16 }, // D
    { width: 18 }, // E
    { width: 18 }, // F
    { width: 22 }, // G
    { width: 22 }, // H
  ];
  const COLS = 8; // A..H

  // ── Bandeau titre ──
  ws.mergeCells(1, 1, 1, COLS);
  const t = ws.getCell('A1');
  t.value = 'RAPPORT SLA — RESPECT DES DÉLAIS';
  t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: C.white } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  setFill(t, C.greenDark);
  ws.getRow(1).height = 34;

  ws.mergeCells(2, 1, 2, COLS);
  const p = ws.getCell('A2');
  p.value = `${periodLabel} — du ${fmtDateFr(data.period.startDate)} au ${fmtDateFr(data.period.endDate)}`;
  p.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C.white } };
  p.alignment = { horizontal: 'center', vertical: 'middle' };
  setFill(p, C.greenMedium);
  ws.getRow(2).height = 22;

  ws.mergeCells(3, 1, 3, COLS);
  const e = ws.getCell('A3');
  e.value = `Exporté le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  e.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C.muted } };
  e.alignment = { horizontal: 'center' };

  let row = 5;
  const kpi = data.kpi;

  // ── Section Indicateurs clés ──
  const kpiCards: { label: string; value: string; note?: string; bg: string; fg: string }[] = [
    { label: 'Résolus (période)', value: String(kpi.resolved), bg: C.blueBg, fg: C.blue },
    { label: 'Respectés (délais)', value: String(kpi.respected), bg: C.bgSoft, fg: C.greenText },
    { label: 'En retard', value: String(kpi.breached), bg: C.redBg, fg: C.red },
    { label: 'Taux de respect', value: kpi.slaRate !== null ? `${kpi.slaRate.toFixed(1)}%` : 'N/A', bg: C.amberBg, fg: C.amber },
    { label: 'Backlog actif en retard', value: String(kpi.overdueActive), bg: C.bgSoft2, fg: C.red },
    { label: 'Tps moy résolution', value: kpi.avgResolutionHours !== null ? `${kpi.avgResolutionHours.toFixed(1)} h` : '—', bg: C.bgSoft2, fg: C.slateText },
    { label: 'Tps moy prise en charge', value: kpi.avgTakeInChargeHours !== null ? `${kpi.avgTakeInChargeHours.toFixed(1)} h` : '—', bg: C.bgSoft2, fg: C.slateText },
  ];

  const colGroups: [number, number][] = [
    [2, 3], [4, 5], [6, 7], [8, 9],
  ];
  // Ajuste le nombre de colonnes de travail : on utilise B..I (col 2..9)
  // La colonne I n'existe pas encore → on ajoute une largeur.
  ws.getColumn(9).width = 22;

  for (let i = 0; i < kpiCards.length; i += 4) {
    const lineCards = kpiCards.slice(i, i + 4);
    for (let j = 0; j < lineCards.length; j++) {
      const card = lineCards[j];
      const [c1, c2] = colGroups[j];
      writeKpiCard(ws, row, c1, c2, card);
    }
    row += 2;
  }
  row += 1;

  // ── Section Par priorité ──
  row = writeSectionTitle(ws, row, 'Respect des délais par priorité');
  row = writeTableHeader(ws, row, ['Priorité', 'Résolus', 'Respectés', 'En retard', 'Taux de respect'], 5);
  row = writeRows(ws, row, data.byPriority.map((r) => [r.name, r.resolved, r.respected, r.breached, r.rate]));
  row += 1;

  // ── Section Par service ──
  row = writeSectionTitle(ws, row, 'Respect des délais par service');
  row = writeTableHeader(ws, row, ['Service', 'Résolus', 'Respectés', 'En retard', 'Taux de respect'], 5);
  row = writeRows(ws, row, data.byService.map((r) => [r.name, r.resolved, r.respected, r.breached, r.rate]));
  row += 1;

  // ── Section Incidents en retard ──
  row = writeSectionTitle(ws, row, 'Détail des incidents en retard');
  if (data.delayed.length === 0) {
    row = writeEmpty(ws, row, 'Aucun retard sur la période', 7);
  } else {
    row = writeTableHeader(ws, row, ['Référence', 'Description', 'Statut', 'Priorité', 'Service', 'Échéance', 'Résolu le', 'Jours de retard'], 8);
    data.delayed.forEach((d) => {
      const r = ws.getRow(row);
      r.values = [
        undefined,
        d.reference,
        d.description,
        d.status,
        d.priority,
        d.serviceEmetteur,
        d.dueDate,
        d.resolvedAt ?? 'En cours',
        d.daysLate,
      ];
      r.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
        if (col < 2 || col > 9) return;
        c.font = { name: 'Calibri', size: 9, color: { argb: C.slateText } };
        if (col === 9) c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.red } };
        setBox(c);
        if ((row - 1) % 2 === 0) setFill(c, C.bgSoft);
      });
      row += 1;
    });
  }

  // ── Pied de page ──
  ws.mergeCells(row, 1, row, COLS);
  const foot = ws.getCell(row, 1);
  foot.value = 'Respect du délai : incident résolu avant sa date d’échéance (dueDate) — Document généré automatiquement par SOREPCO';
  foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: C.faint } };
  foot.alignment = { horizontal: 'center' };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function writeSectionTitle(ws: ExcelJS.Worksheet, row: number, label: string): number {
  ws.getRow(row).values = [undefined, label];
  const cell = ws.getRow(row).getCell(2);
  cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: C.green } };
  for (let c = 2; c <= 9; c++) {
    ws.getRow(row).getCell(c).border = { bottom: { style: 'medium', color: { argb: C.greenLight } } } as any;
  }
  ws.getRow(row).height = 20;
  return row + 1;
}

function writeTableHeader(ws: ExcelJS.Worksheet, row: number, labels: string[], cols: number): number {
  const r = ws.getRow(row);
  for (let i = 0; i < cols; i++) {
    const c = r.getCell(2 + i);
    c.value = labels[i];
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } };
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    setFill(c, C.green);
    setBox(c, C.green);
  }
  ws.getRow(row).height = 20;
  return row + 1;
}

function writeRows(
  ws: ExcelJS.Worksheet,
  row: number,
  items: [string, number, number, number, number | null][]
): number {
  items.forEach(([name, resolved, respected, breached, rate], idx) => {
    const r = ws.getRow(row);
    r.values = [
      undefined,
      name,
      resolved,
      respected,
      breached,
      rate !== null ? Number(rate.toFixed(1)) : 'N/A',
    ];
    r.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      if (col < 2 || col > 6) return;
      c.font = { name: 'Calibri', size: 10, color: { argb: C.slateText } };
      if (col === 2) c.alignment = { horizontal: 'left' };
      else c.alignment = { horizontal: 'center' };
      if (col === 6 && rate !== null) {
        if (rate >= 90) c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.greenText } };
        else if (rate >= 60) c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.amber } };
        else c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
        c.numFmt = '0.0"%"';
      }
      setBox(c);
      if ((row - 1) % 2 === 0) setFill(c, C.bgSoft);
    });
    row += 1;
  });
  return row;
}

function writeKpiCard(
  ws: ExcelJS.Worksheet,
  row: number,
  col1: number,
  col2: number,
  card: { label: string; value: string; note?: string; bg: string; fg: string }
) {
  ws.mergeCells(row, col1, row, col2);
  const lc = ws.getCell(row, col1);
  lc.value = card.label;
  lc.font = { name: 'Calibri', size: 8, bold: true, color: { argb: C.muted } };
  lc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  setFill(lc, card.bg);
  setBox(lc, card.bg);
  ws.getRow(row).height = 15;

  ws.mergeCells(row + 1, col1, row + 1, col2);
  const vc = ws.getCell(row + 1, col1);
  vc.value = card.value;
  vc.font = { name: 'Calibri', size: card.value.length > 8 ? 12 : 16, bold: true, color: { argb: card.fg } };
  vc.alignment = { horizontal: 'center', vertical: 'middle' };
  setFill(vc, card.bg);
  setBox(vc, card.bg);
  ws.getRow(row + 1).height = 30;
}

function writeEmpty(ws: ExcelJS.Worksheet, row: number, message: string, cols: number): number {
  const r = ws.getRow(row);
  ws.mergeCells(row, 2, row, 1 + cols);
  const c = r.getCell(2);
  c.value = message;
  c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: C.faint } };
  return row + 1;
}
