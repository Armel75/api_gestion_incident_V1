import { Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { buildGLPITicketWhere } from "../../../presentation/http/mappers/glpiTicketFilterMapper";
import { IncidentPdfService } from "../../../domain/services/IncidentPdfService";
import { respondPdfError } from "../utils/pdfExportError";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

/* ─── Libellés GLPI ─── */
const STATUS_LABELS: Record<string, string> = {
  "1": "Nouveau",
  "2": "En cours",
  "3": "En attente",
  "4": "Résolu",
  "5": "Clôturé",
  "6": "Annulé",
};

const LEVEL_LABELS: Record<string, string> = {
  "1": "Très basse",
  "2": "Basse",
  "3": "Moyenne",
  "4": "Haute",
  "5": "Très haute",
};

const TYPE_LABELS: Record<string, string> = {
  INCIDENT: "Incident",
  DEMANDE: "Demande",
};

const SYNC_LABELS: Record<string, string> = {
  SYNCED: "Synchronisé",
  PENDING: "En attente",
  ERROR: "Erreur",
  NOT_FOUND: "Non trouvé",
};

/* ─── Helpers ─── */
const formatDate = (d: Date | null | undefined): string => {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

/* ══════════════════════════════════════════════════════════════════
   GLPI TICKET EXPORT CONTROLLER
   ══════════════════════════════════════════════════════════════════ */
export class GlpiTicketExportController {
  /* ─── PDF ─── */
  static async exportPdf(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      const payload = req.body ?? {};
      // Même format que POST /glpi-tickets/query : { logic, filters }
      const filters = Array.isArray(payload.filters) ? payload.filters : [];
      const logic = payload.logic === "OR" ? "OR" : "AND";

      // Build same Prisma filter as the query endpoint
      const where = buildGLPITicketWhere(filters, logic);

      const tickets = await prisma.gLPITicket.findMany({
        where,
        orderBy: { openedAt: "desc" },
        take: 10000, // cap for performance
      });

      const rows = tickets.map((t) => {
        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const priorityLabel = t.priority ? LEVEL_LABELS[t.priority] ?? t.priority : "—";
        const urgencyLabel = t.urgency ? LEVEL_LABELS[t.urgency] ?? t.urgency : "—";
        const typeLabel = t.ticketType ? TYPE_LABELS[t.ticketType] ?? t.ticketType : "—";
        const syncLabel = SYNC_LABELS[t.syncStatus] ?? t.syncStatus;

        return {
          ...t,
          statusLabel,
          priorityLabel,
          urgencyLabel,
          typeLabel,
          syncLabel,
          openedAtFormatted: formatDate(t.openedAt),
          dueAtFormatted: formatDate(t.dueAt),
          resolvedAtFormatted: formatDate(t.resolvedAt),
          closedAtFormatted: formatDate(t.closedAt),
          lastSyncedAtFormatted: formatDate(t.lastSyncedAt),
          descriptionShort: stripHtml(t.description).slice(0, 200),
        };
      });

      const total = tickets.length;
      const generatedAt = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const html = await fs.promises.readFile(
        path.join(process.cwd(), "templates", "glpi-tickets-export.html"),
        "utf8"
      );

      // Inject data into template
      const tableRows = rows
        .map(
          (t) => `<tr>
          <td>${t.glpiId}</td>
          <td>${t.ticketNumber ?? "—"}</td>
          <td>${t.title}</td>
          <td>${t.statusLabel}</td>
          <td>${t.priorityLabel}</td>
          <td>${t.urgencyLabel}</td>
          <td>${t.categoryName ?? "—"}</td>
          <td>${t.requesterName ?? "—"}</td>
          <td>${t.assigneeName ?? "—"}</td>
          <td>${t.openedAtFormatted}</td>
          <td>${t.dueAtFormatted}</td>
        </tr>`
        )
        .join("");

      const filledHtml = html
        .replace("{{ROWS}}", tableRows)
        .replace("{{TOTAL}}", String(total))
        .replace("{{GENERATED_AT}}", generatedAt);

      const pdfBuffer = await IncidentPdfService.generateBuffer(filledHtml);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="glpi-tickets-export-${Date.now()}.pdf"`
      );
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return respondPdfError(res, error, "Erreur génération PDF");
    }
  }

  /* ─── EXCEL (.xlsx via ExcelJS) ─── */
  static async exportExcel(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      const payload = req.body ?? {};
      // Même format que POST /glpi-tickets/query : { logic, filters }
      const filters = Array.isArray(payload.filters) ? payload.filters : [];
      const logic = payload.logic === "OR" ? "OR" : "AND";

      const where = buildGLPITicketWhere(filters, logic);

      const tickets = await prisma.gLPITicket.findMany({
        where,
        orderBy: { openedAt: "desc" },
        take: 10000,
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "API Gestion Incident";
      workbook.created = new Date();

      /* ── Feuille tickets ── */
      const sheet = workbook.addWorksheet("Tickets GLPI");
      sheet.properties.tabColor = { argb: "1B4FD8" };

      // ── En-tête principal (row 1) ──
      sheet.mergeCells("A1:M1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `Export Tickets GLPI — ${tickets.length} ticket(s)`;
      titleCell.font = { size: 14, bold: true, color: { argb: "FFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1B4FD8" },
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 28;

      // ── En-tête colonnes (row 3) ──
      const headers = [
        "ID GLPI",
        "N° Ticket",
        "Titre",
        "Description",
        "Type",
        "Statut",
        "Priorité",
        "Urgence",
        "Catégorie",
        "Entité",
        "Lieu",
        "Demandeur",
        "Technicien",
        "Ouvert le",
        "Échéance",
        "Résolu le",
        "Clôturé le",
        "Dernière synchro",
        "Statut synchro",
      ];

      const headerRow = sheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "2D5BE3" },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFFFFF" } },
          bottom: { style: "thin", color: { argb: "FFFFFF" } },
          left: { style: "thin", color: { argb: "BDD7EE" } },
          right: { style: "thin", color: { argb: "BDD7EE" } },
        };
      });
      headerRow.height = 36;

      // ── Données ──
      const statusColors: Record<string, string> = {
        "1": "FFEB9C", // Nouveau – jaune
        "2": "9CDCFE", // En cours – bleu clair
        "3": "D9D9D9", // En attente – gris
        "4": "C6EFCE", // Résolu – vert clair
        "5": "B4C6E7", // Clôturé – bleu-gris
        "6": "FFC7CE", // Annulé – rouge clair
      };

      for (const t of tickets) {
        const statusLabel = STATUS_LABELS[t.status] ?? t.status;
        const priorityLabel = t.priority ? LEVEL_LABELS[t.priority] ?? t.priority : "";
        const urgencyLabel = t.urgency ? LEVEL_LABELS[t.urgency] ?? t.urgency : "";
        const typeLabel = t.ticketType ? TYPE_LABELS[t.ticketType] ?? t.ticketType : "";
        const syncLabel = SYNC_LABELS[t.syncStatus] ?? t.syncStatus;
        const statusBg = statusColors[t.status] ?? "FFFFFF";

        const row = sheet.addRow([
          t.glpiId,
          t.ticketNumber ?? "",
          t.title,
          stripHtml(t.description ?? ""),
          typeLabel,
          statusLabel,
          priorityLabel,
          urgencyLabel,
          t.categoryName ?? "",
          t.entityName ?? "",
          t.locationName ?? "",
          t.requesterName ?? "",
          t.assigneeName ?? "",
          t.openedAt ?? "",
          t.dueAt ?? "",
          t.resolvedAt ?? "",
          t.closedAt ?? "",
          t.lastSyncedAt ?? "",
          syncLabel,
        ]);

        // Colorier la cellule Statut
        const statusCell = row.getCell(6);
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: statusBg.replace("#", "") },
        };
        statusCell.font = { size: 10 };

        // Format dates
        [14, 15, 16, 17, 18].forEach((colIdx) => {
          const c = row.getCell(colIdx);
          if (c.value instanceof Date) {
            c.numFmt = "dd/mm/yyyy hh:mm";
          }
        });

        row.height = 20;
        row.eachCell((cell) => {
          cell.font = { size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "D9D9D9" } },
            bottom: { style: "thin", color: { argb: "D9D9D9" } },
            left: { style: "thin", color: { argb: "D9D9D9" } },
            right: { style: "thin", color: { argb: "D9D9D9" } },
          };
          cell.alignment = { vertical: "middle", wrapText: false };
        });
      }

      // ── Auto-width colonnes ──
      sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3, activeCell: "A4" }];
      sheet.autoFilter = { from: "A3", to: `M${tickets.length + 3}` };

      const colWidths: Record<string, number> = {
        A: 10,  // ID GLPI
        B: 14,  // N° Ticket
        C: 35,  // Titre
        D: 50,  // Description
        E: 12,  // Type
        F: 14,  // Statut
        G: 12,  // Priorité
        H: 12,  // Urgence
        I: 22,  // Catégorie
        J: 20,  // Entité
        K: 20,  // Lieu
        L: 22,  // Demandeur
        M: 22,  // Technicien
        N: 18,  // Ouvert le
        O: 18,  // Échéance
        P: 18,  // Résolu le
        Q: 18,  // Clôturé le
        R: 20,  // Dernière synchro
        S: 16,  // Statut synchro
      };
      Object.entries(colWidths).forEach(([col, width]) => {
        sheet.getColumn(col).width = width ?? 15;
      });

      /* ── Feuille résumé (si > 0 tickets) ── */
      if (tickets.length > 0) {
        const sumSheet = workbook.addWorksheet("Résumé");
        sumSheet.properties.tabColor = { argb: "70AD47" };

        const rTitle = sumSheet.getCell("A1");
        rTitle.value = "Résumé de l'export";
        rTitle.font = { size: 13, bold: true };
        sumSheet.getRow(1).height = 24;

        // Statuts
        const statusCounts: Record<string, number> = {};
        for (const t of tickets) {
          const lbl = STATUS_LABELS[t.status] ?? t.status;
          statusCounts[lbl] = (statusCounts[lbl] ?? 0) + 1;
        }
        const priorityCounts: Record<string, number> = {};
        for (const t of tickets) {
          if (t.priority) {
            const lbl = LEVEL_LABELS[t.priority] ?? t.priority;
            priorityCounts[lbl] = (priorityCounts[lbl] ?? 0) + 1;
          }
        }

        sumSheet.getRow(3).values = ["Par statut", "", "Par priorité", ""];
        sumSheet.getRow(3).eachCell((c) => {
          c.font = { bold: true, size: 11, color: { argb: "FFFFFF" } };
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "2D5BE3" },
          };
        });

        const maxRows = Math.max(Object.keys(statusCounts).length, Object.keys(priorityCounts).length);
        for (let i = 0; i < maxRows; i++) {
          const r = sumSheet.getRow(4 + i);
          const statusEntry = Object.entries(statusCounts)[i];
          const priorityEntry = Object.entries(priorityCounts)[i];
          r.values = [
            statusEntry ? statusEntry[0] : "",
            statusEntry ? statusEntry[1] : "",
            priorityEntry ? priorityEntry[0] : "",
            priorityEntry ? priorityEntry[1] : "",
          ];
          r.eachCell((c) => {
            c.font = { size: 10 };
            c.border = {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }

        sumSheet.getColumn("A").width = 20;
        sumSheet.getColumn("B").width = 12;
        sumSheet.getColumn("C").width = 20;
        sumSheet.getColumn("D").width = 12;
      }

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="glpi-tickets-export-${Date.now()}.xlsx"`
      );
      return res.status(200).send(Buffer.from(buffer));
    } catch (error) {
      console.error("[GLPI EXPORT] exportExcel error:", error);
      return res.status(500).json({ message: "Erreur génération Excel" });
    }
  }
}
