import nodemailer from "nodemailer";
import { WeeklyReportService } from "./WeeklyReportService";
import { MonthlyReportService } from "./MonthlyReportService";
import { SlaReportService } from "./SlaReportService";

/* ------------------------------------------------------------------ */
/*  Types / config                                                     */
/* ------------------------------------------------------------------ */

const transporter = nodemailer.createTransport({
  host: "192.168.0.247",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/** User "admin" : les rapports envoyés contiennent toutes les données. */
const ADMIN_USER = { id: 1, roles: ["ADMIN"], siteId: undefined as number | undefined };

const parseEmails = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

const isEnabled = (): boolean =>
  (process.env.REPORT_EMAIL_ENABLED ?? "false").toLowerCase() === "true";

const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Base path de l'app React (BrowserRouter basename + base Vite = /incident). */
const FRONTEND_BASE_PATH = "/incident";

/* ------------------------------------------------------------------ */
/*  Helpers HTML                                                       */
/* ------------------------------------------------------------------ */

const esc = (s: any): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const fmtRate = (rate: number | null): string =>
  rate === null || rate === undefined ? "N/A" : `${rate.toFixed(1)}%`;

const fmtHours = (h: number | null): string => {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins > 0 ? `${hours}h ${mins}` : `${hours}h`;
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Flèche de variation colorée (▲ vert si positif selon inverse). */
const renderChange = (value: number | null, unit: "pct" | "pts", inverse = false): string => {
  if (value === null) return `<span style="color:#94a3b8">—</span>`;
  const abs = Math.abs(value);
  const formatted = unit === "pts" ? `${abs.toFixed(1)} pts` : `${abs.toFixed(1)}%`;
  if (Math.abs(value) < 0.01) return `<span style="color:#94a3b8">→ ${formatted}</span>`;
  const isGood = inverse ? value < 0 : value > 0;
  const color = isGood ? "#16a34a" : "#dc2626";
  const arrow = isGood ? "▲" : "▼";
  return `<span style="color:${color};font-weight:600">${arrow} ${formatted}</span>`;
};

const kpiCard = (label: string, value: string, color: string): string => `
  <td style="background:${color};border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;text-align:center;width:25%">
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${esc(label)}</div>
    <div style="font-size:22px;font-weight:700;color:#1e293b">${esc(value)}</div>
  </td>`;

/** Construit le squelette HTML commun (en-tête + pied de page). */
const layout = (title: string, subtitle: string, body: string, linkUrl: string, linkLabel: string): string => `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
        <!-- Bandeau -->
        <tr>
          <td style="background:#166534;padding:22px 28px">
            <div style="color:#ffffff;font-size:20px;font-weight:700">SOREPCO — Gestion des Incidents</div>
            <div style="color:#bbf7d0;font-size:13px;margin-top:4px">${esc(subtitle)}</div>
          </td>
        </tr>
        <!-- Contenu -->
        <tr>
          <td style="padding:28px">
            <div style="font-size:16px;font-weight:700;color:#166534;margin-bottom:18px">${esc(title)}</div>
            ${body}
            <!-- CTA -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px">
              <tr>
                <td align="center">
                  <a href="${esc(linkUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">${esc(linkLabel)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Pied -->
        <tr>
          <td style="background:#f8fafc;padding:14px 28px;text-align:center;color:#94a3b8;font-size:11px">
            Rapport généré automatiquement par le système de gestion des incidents SOREPCO SA.<br/>
            Merci de ne pas répondre à ce message.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ------------------------------------------------------------------ */
/*  Envoi                                                              */
/* ------------------------------------------------------------------ */

const send = async (
  to: string[],
  subject: string,
  html: string
): Promise<void> => {
  if (to.length === 0) return;
  await transporter.sendMail({
    from: '"SOREPCO — Gestion Incidents" <support@groupesorepco.com>',
    to: to.join(", "),
    subject,
    html,
  });
};

/* ------------------------------------------------------------------ */
/*  Bloc SLA (respect des délais)                                      */
/* ------------------------------------------------------------------ */

/** Construit la section « Respect des délais » pour le mail. */
async function buildSlaSection(startIso: string, endIso: string): Promise<string> {
  try {
    const slaService = new SlaReportService();
    // ✅ Fermeture de la période en fin de journée (UTC, comme weekStartEnd des
    //    rapports). `period.endDate` ne porte que la date : sans ça, tout ce qui
    //    est résolu le dernier jour de la période était exclu du bloc SLA, ce qui
    //    désalignait ses chiffres avec ceux des KPI du même mail.
    const start = new Date(startIso);
    const end = new Date(endIso);
    end.setUTCHours(23, 59, 59, 999);

    const sla = await slaService.getReport(start, end, ADMIN_USER);

    const overdue = sla.kpi.overdueActive;
    const slaRate = sla.kpi.slaRate;

    // Top incidents les plus en retard (max 3)
    const topLate = [...sla.delayed].sort((a, b) => b.daysLate - a.daysLate).slice(0, 3);

    const rowsHtml = topLate.length
      ? topLate
          .map(
            (d) => `
            <tr>
              <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#166534">${esc(d.reference)}</td>
              <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${esc(d.serviceEmetteur)}</td>
              <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:700;color:#dc2626">+${d.daysLate} j</td>
            </tr>`
          )
          .join("")
      : "";

    const color = slaRate === null ? "#94a3b8" : slaRate >= 80 ? "#16a34a" : slaRate >= 60 ? "#d97706" : "#dc2626";

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
        <tr>
          <td style="font-size:14px;font-weight:700;color:#334155;border-bottom:2px solid #166534;padding-bottom:6px">⏰ Respect des délais (SLA)</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin-top:10px">
        <tr>
          ${kpiCard("Taux de respect", slaRate !== null ? `${slaRate.toFixed(1)}%` : "N/A", "#fffbeb")}
          ${kpiCard("En retard (période)", String(sla.kpi.breached), "#fef2f2")}
          ${kpiCard("Backlog en retard (à ce jour)", String(overdue), "#fef2f2")}
          ${kpiCard("Résolus période", String(sla.kpi.resolved), "#f0fdf4")}
        </tr>
      </table>
      ${topLate.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tr style="background:#f8fafc">
          <td style="padding:7px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Référence</td>
          <td style="padding:7px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Service</td>
          <td style="padding:7px 12px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:right">Retard</td>
        </tr>
        ${rowsHtml}
      </table>` : ""}
      <p style="color:${color};font-size:12px;margin-top:10px;font-weight:600">
        ${slaRate !== null && slaRate < 80 ? `⚠️ Taux de respect sous l'objectif (${slaRate.toFixed(1)}%).` : overdue > 0 ? `⚠️ ${overdue} incident(s) encore en retard à ce jour.` : "✓ Aucun retard majeur."}
      </p>
    `;
  } catch (error) {
    console.error("[REPORT MAIL] Bloc SLA non généré:", error);
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Rapport hebdomadaire                                               */
/* ------------------------------------------------------------------ */

export async function sendWeeklyReportEmail(): Promise<{ sent: boolean; reason?: string; to?: string[] }> {
  if (!isEnabled()) return { sent: false, reason: "REPORT_EMAIL_ENABLED=false" };

  const to = parseEmails(process.env.REPORT_EMAILS_HEBDO);
  if (to.length === 0) return { sent: false, reason: "Aucun destinataire hebdo configuré" };

  try {
    const service = new WeeklyReportService();
    // ✅ S-1 : la semaine courante vient de commencer (cron du lundi 07:00)
    const data = await service.getPreviousWeekReport(ADMIN_USER);

    const kpi = data.kpi;
    const cmp = data.comparison;
    const displayRate = kpi.resolutionRate !== null ? `${kpi.cappedRate.toFixed(1)}%` : "N/A";

    // Top services les plus faibles (taux le plus bas), 3 max
    const worstServices = [...data.byService]
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))
      .slice(0, 3);

    const servicesHtml = worstServices.length
      ? worstServices
          .map(
            (s) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px">${esc(s.name)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center">${s.resolved}/${s.created}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;color:${(s.rate ?? 0) < 60 ? "#dc2626" : "#d97706"}">${fmtRate(s.rate)}</td>
            </tr>`
          )
          .join("")
      : '<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-size:13px" colspan="3">Aucun incident sur cette période</td></tr>';

    const bodyMain = `
      <!-- Période -->
      <p style="color:#64748b;font-size:13px;margin:0 0 18px">
        Période : <strong>${esc(data.period.label)}</strong> — du ${fmtDate(data.period.startDate)} au ${fmtDate(data.period.endDate)}
      </p>
      <!-- KPIs -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="6">
        <tr>
          ${kpiCard("Créés", String(kpi.created), "#eff6ff")}
          ${kpiCard("Résolus", String(kpi.resolved), "#f0fdf4")}
          ${kpiCard("Taux", displayRate, "#fffbeb")}
          ${kpiCard("Backlog fin période", String(kpi.backlogEnd), "#f8fafc")}
        </tr>
      </table>
      <!-- Variations -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">
        <tr>
          <td style="font-size:13px;color:#64748b;padding:6px 0">Variation vs période précédente :</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#334155;padding:4px 0">
            Créés <strong>${kpi.created}</strong> ${renderChange(cmp?.createdChange ?? null, "pct")}
            &nbsp;·&nbsp; Résolus <strong>${kpi.resolved}</strong> ${renderChange(cmp?.resolvedChange ?? null, "pct")}
            &nbsp;·&nbsp; Taux ${renderChange(cmp?.resolutionRateChange ?? null, "pts")}
          </td>
        </tr>
      </table>
      <!-- Services faibles -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
        <tr>
          <td style="font-size:14px;font-weight:700;color:#334155;border-bottom:2px solid #166534;padding-bottom:6px">Services à surveiller</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tr style="background:#f8fafc">
          <td style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Service</td>
          <td style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:center">Résolus/Créés</td>
          <td style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:right">Taux</td>
        </tr>
        ${servicesHtml}
      </table>
      <!-- Temps moyens -->
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">
        Tps moyen résolution : <strong style="color:#334155">${fmtHours(kpi.avgResolutionHours)}</strong>
        &nbsp;·&nbsp; Tps moyen prise en charge : <strong style="color:#334155">${fmtHours(kpi.avgTakeInChargeHours)}</strong>
      </p>
    `;

    const slaSection = await buildSlaSection(data.period.startDate, data.period.endDate);
    const body = bodyMain + slaSection;

    const html = layout(
      "Rapport Hebdomadaire — Synthèse",
      data.period.label,
      body,
      `${FRONTEND_URL}${FRONTEND_BASE_PATH}/reports`,
      "Voir le rapport complet"
    );

    await send(to, `📊 Rapport hebdomadaire — ${data.period.label}`, html);
    return { sent: true, to };
  } catch (error) {
    console.error("[REPORT MAIL] Échec envoi hebdo:", error);
    return { sent: false, reason: error instanceof Error ? error.message : "Erreur inconnue", to };
  }
}

/* ------------------------------------------------------------------ */
/*  Rapport mensuel                                                    */
/* ------------------------------------------------------------------ */

export async function sendMonthlyReportEmail(): Promise<{ sent: boolean; reason?: string; to?: string[] }> {
  if (!isEnabled()) return { sent: false, reason: "REPORT_EMAIL_ENABLED=false" };

  const to = parseEmails(process.env.REPORT_EMAILS_MENSUEL);
  if (to.length === 0) return { sent: false, reason: "Aucun destinataire mensuel configuré" };

  try {
    const service = new MonthlyReportService();
    // ✅ M-1 : le mois courant vient de commencer (cron du 1er à 07:00)
    const data = await service.getPreviousMonthReport(ADMIN_USER);

    const kpi = data.kpi;
    const cmp = data.comparison;
    const displayRate = kpi.resolutionRate !== null ? `${kpi.cappedRate.toFixed(1)}%` : "N/A";

    // Top services les plus faibles (taux le plus bas), 3 max
    const worstServices = [...data.byService]
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))
      .slice(0, 3);

    const servicesHtml = worstServices.length
      ? worstServices
          .map(
            (s) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px">${esc(s.name)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center">${s.resolved}/${s.created}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;color:${(s.rate ?? 0) < 60 ? "#dc2626" : "#d97706"}">${fmtRate(s.rate)}</td>
            </tr>`
          )
          .join("")
      : '<tr><td style="padding:12px;text-align:center;color:#94a3b8;font-size:13px" colspan="3">Aucun incident sur cette période</td></tr>';

    const bodyMain = `
      <p style="color:#64748b;font-size:13px;margin:0 0 18px">
        Période : <strong>${esc(data.period.label)}</strong> — du ${fmtDate(data.period.startDate)} au ${fmtDate(data.period.endDate)}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="6">
        <tr>
          ${kpiCard("Créés", String(kpi.created), "#eff6ff")}
          ${kpiCard("Résolus", String(kpi.resolved), "#f0fdf4")}
          ${kpiCard("Taux", displayRate, "#fffbeb")}
          ${kpiCard("Backlog fin période", String(kpi.backlogEnd), "#f8fafc")}
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">
        <tr><td style="font-size:13px;color:#64748b;padding:6px 0">Variation vs période précédente :</td></tr>
        <tr>
          <td style="font-size:13px;color:#334155;padding:4px 0">
            Créés <strong>${kpi.created}</strong> ${renderChange(cmp?.createdChange ?? null, "pct")}
            &nbsp;·&nbsp; Résolus <strong>${kpi.resolved}</strong> ${renderChange(cmp?.resolvedChange ?? null, "pct")}
            &nbsp;·&nbsp; Taux ${renderChange(cmp?.resolutionRateChange ?? null, "pts")}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
        <tr>
          <td style="font-size:14px;font-weight:700;color:#334155;border-bottom:2px solid #166534;padding-bottom:6px">Services à surveiller</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tr style="background:#f8fafc">
          <td style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Service</td>
          <td style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:center">Résolus/Créés</td>
          <td style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:right">Taux</td>
        </tr>
        ${servicesHtml}
      </table>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">
        Tps moyen résolution : <strong style="color:#334155">${fmtHours(kpi.avgResolutionHours)}</strong>
        &nbsp;·&nbsp; Tps moyen prise en charge : <strong style="color:#334155">${fmtHours(kpi.avgTakeInChargeHours)}</strong>
      </p>
    `;

    const slaSection = await buildSlaSection(data.period.startDate, data.period.endDate);
    const body = bodyMain + slaSection;

    const html = layout(
      "Rapport Mensuel — Synthèse",
      data.period.label,
      body,
      `${FRONTEND_URL}${FRONTEND_BASE_PATH}/monthly-reports`,
      "Voir le rapport complet"
    );

    await send(to, `📅 Rapport mensuel — ${data.period.label}`, html);
    return { sent: true, to };
  } catch (error) {
    console.error("[REPORT MAIL] Échec envoi mensuel:", error);
    return { sent: false, reason: error instanceof Error ? error.message : "Erreur inconnue", to };
  }
}
