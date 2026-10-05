import cron from 'node-cron';
import {
  sendWeeklyReportEmail,
  sendMonthlyReportEmail,
} from '../services/reportMail.service';

/**
 * Planification de l'envoi automatique des rapports par email.
 *  - Hebdomadaire : chaque lundi à 07:00
 *  - Mensuel      : le 1er du mois à 07:00
 *
 * La génération des données est réutilisée depuis WeeklyReportService /
 * MonthlyReportService (aucune logique métier dupliquée). Un échec SMTP ne
 * fait jamais échouer le serveur (chaque envoi est isolé + journalisé).
 */
export function startReportEmailCron() {
  const enabled = (process.env.REPORT_EMAIL_ENABLED ?? 'false').toLowerCase() === 'true';

  console.log(
    `[CRON] Rapport email: ${enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ (REPORT_EMAIL_ENABLED=false)'}`
  );
  if (!enabled) return;

  let weeklyRunning = false;
  let monthlyRunning = false;

  // ── Hebdo : lundi 07:00 ──
  cron.schedule('0 7 * * 1', async () => {
    if (weeklyRunning) {
      console.log('[CRON] Rapport hebdo sauté : envoi précédent encore en cours');
      return;
    }
    weeklyRunning = true;
    console.log('[CRON] Envoi rapport hebdomadaire démarré à', new Date().toISOString());
    try {
      const result = await sendWeeklyReportEmail();
      console.log('[CRON] Rapport hebdo:', result);
    } catch (error) {
      console.error('[CRON] Rapport hebdo échoué:', error);
    } finally {
      weeklyRunning = false;
    }
  });

  // ── Mensuel : 1er du mois 07:00 ──
  cron.schedule('0 7 1 * *', async () => {
    if (monthlyRunning) {
      console.log('[CRON] Rapport mensuel sauté : envoi précédent encore en cours');
      return;
    }
    monthlyRunning = true;
    console.log('[CRON] Envoi rapport mensuel démarré à', new Date().toISOString());
    try {
      const result = await sendMonthlyReportEmail();
      console.log('[CRON] Rapport mensuel:', result);
    } catch (error) {
      console.error('[CRON] Rapport mensuel échoué:', error);
    } finally {
      monthlyRunning = false;
    }
  });
}
