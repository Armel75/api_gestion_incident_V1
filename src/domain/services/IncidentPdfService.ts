import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { PdfUnavailableError } from "../errors/AppError";
import { ensureSafeTmpdir, getSafeTmpdir } from "../../bootstrap/safeTmpdir.bootstrap";

// Idempotent : garantit un dossier temporaire local sûr même si ce service
// est importé hors du flux normal de server.ts (tests, script isolé...).
ensureSafeTmpdir();

export class IncidentPdfService {
  /**
   * Essaie de lancer un navigateur Chromium en cascade (fallback) :
   *   1. Chromium embarqué (binaire Playwright) — rendu de référence verrouillé
   *   2. Chrome système  (channel: "chrome")
   *   3. Edge système    (channel: "msedge")
   * Retourne le browser lancé, ou null si aucun moteur n'est disponible.
   */
  private static async launchBrowser(
    artifactsDir: string,
    tmpBase: string
  ): Promise<Awaited<ReturnType<typeof chromium.launch>> | null> {
    const commonOpts: any = {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      artifactsDir,
      env: {
        ...process.env,
        TEMP: tmpBase,
        TMP: tmpBase,
        TMPDIR: tmpBase,
      },
    };

    // 1er essai : Chromium embarqué (aucun channel → binaire Playwright)
    try {
      return await chromium.launch(commonOpts);
    } catch (err1: any) {
      console.error("[PDF] Chromium embarqué indisponible:", err1?.message ?? err1);
    }

    // 2e essai : Chrome système
    try {
      console.warn("[PDF] Bascule vers Chrome système (fallback)...");
      return await chromium.launch({ ...commonOpts, channel: "chrome" });
    } catch (err2: any) {
      console.error("[PDF] Chrome système indisponible:", err2?.message ?? err2);
    }

    // 3e essai : Edge système
    try {
      console.warn("[PDF] Bascule vers Edge système (fallback)...");
      return await chromium.launch({ ...commonOpts, channel: "msedge" });
    } catch (err3: any) {
      console.error("[PDF] Edge système indisponible:", err3?.message ?? err3);
    }

    return null;
  }

  static async generateBuffer(html: string): Promise<Buffer> {
    const tmpBase = getSafeTmpdir();
    const artifactsDir = fs.mkdtempSync(path.join(tmpBase, "artifacts-"));

    const browser = await IncidentPdfService.launchBrowser(artifactsDir, tmpBase);

    if (!browser) {
      // Aucun moteur n'a pu démarrer : nettoyage puis erreur métier claire
      fs.rmSync(artifactsDir, { recursive: true, force: true });
      throw new PdfUnavailableError();
    }

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
      // Nettoyage des dossiers temporaires locaux (le dossier de base est réutilisé)
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  }
}