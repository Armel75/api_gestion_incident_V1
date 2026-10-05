import { Request, Response, NextFunction } from 'express';
import {
  CreateIncidentUseCase,
  GetAllIncidentsUseCase,
  GetIncidentByIdUseCase,
  UpdateIncidentUseCase,
  DeleteIncidentUseCase,
  CloseIncidentUseCase, // ✅ AJOUT
  ReopenIncidentUseCase,
} from '../../../application/usecases/IncidentUseCases';
import { PrismaIncidentRepository } from '../../../infrastructure/repositories/PrismaIncidentRepository';
import { z } from 'zod';
import { CreateIncidentDTO, UpdateIncidentDTO } from '../../../domain/entities/Incident';
import prisma from '../../../infrastructure/database/prisma';

import fs from 'fs/promises';
import path from 'path';
import { IncidentPdfService } from '../../../domain/services/IncidentPdfService';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { IncidentService } from '../../../services/IncidentService';
import { IncidentQuerySchema } from "../../../presentation/http/schemas/IncidentQuerySchema";
import { buildIncidentWhere } from "../../../presentation/http/mappers/incidentFilterMapper";

const incidentSchema = z.object({
    glpiUserIds: z.preprocess(
      (val) => {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
      },
      z.array(z.coerce.number()).optional()
    ),
  reporterName: z.string().min(2, "Nom du déclarant obligatoire"), // ✅ AJOUT
  description: z.string().min(5),
  // ✅ AJOUT
  glpiTicketId: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().int().positive().nullable().optional()
  ),
  scope: z.string().optional().nullable(),
  siteIds: z.preprocess(
    (val) => Array.isArray(val) ? val : [val],
    z.array(z.string()).min(1)
  ),
  // 🔗 Sites concernés (NOUVEAU)
  impactedSiteIds: z.preprocess(
    (val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    },
    z.array(z.string())
  ),
  categoryId: z.string(),
  subCategoryId: z.string().optional(),
  otherSubCategory: z.string().optional(),
  processDomainId: z.string().optional(),
  subProcessId: z.string().optional(),
  personneIds: z.preprocess(
    (val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    },
    z.array(z.coerce.number()).optional()
  ),
  dueDate: z.string(),
  urgency: z.enum(['Faible', 'Moyenne', 'Haute', 'Immédiate']),
  criticality: z.enum(['Faible', 'Moyenne', 'Haute', 'Critique']),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']).optional(),
  rootCause: z.string().optional(),
  proposedSolution: z.string().optional(),
});

const closeSchema = z
  .object({
    content: z.string().min(3).optional(),
    comment: z.string().min(3).optional(),
  })
  .refine((v) => (v.content ?? v.comment ?? "").trim().length >= 3, {
    message: "Le commentaire de clôture est obligatoire (min 3 caractères).",
    path: ["content"],
  })
  .transform((v) => ({
    content: (v.content ?? v.comment ?? "").trim(),
  }));


function hasAdminLikeAccess(user: any): boolean {
  return (
    user?.roles?.some((r: any) =>
      typeof r === "string"
        ? r === "ADMIN" || r === "MANAGER" || r === "CONTROLEUR"
        : r?.name === "ADMIN" ||
        r?.role?.name === "ADMIN" ||
        r?.name === "MANAGER" ||
        r?.role?.name === "MANAGER" ||
        r?.name === "CONTROLEUR" ||
        r?.role?.name === "CONTROLEUR"
    ) ?? false
  );
}

function hasRole(user: any, roleName: string): boolean {
  const target = String(roleName).toUpperCase();

  return (
    user?.roles?.some((r: any) =>
      typeof r === "string"
        ? r.toUpperCase() === target
        : (r?.name ?? r?.role?.name ?? "").toUpperCase() === target
    ) ?? false
  );
}


export class IncidentController {

  static async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user as AuthUser | undefined;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      const isAdmin = hasAdminLikeAccess(authUser);
      const userId = Number(authUser.id);

      const repo = new PrismaIncidentRepository();
      const useCase = new ReopenIncidentUseCase(repo);

      const incident = await useCase.execute({
        id: req.params.id,
        userId,
        isAdmin,
      });

      return res.json(incident);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({
          message: "Bad Request",
          error: error.issues?.[0]?.message ?? "Payload invalide",
          issues: error.issues,
        });
      }

      console.error("REOPEN INCIDENT ERROR:", {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
      });

      return res.status(500).json({
        message: "Internal Server Error",
        error: error?.message,
        code: error?.code,
      });
    }
  }

  static async create(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      /**
       * 1️⃣ Sécurité : utilisateur authentifié
       */
      const authUser = (req as any).user;
      if (!authUser?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      /**
       * 2️⃣ Validation Zod (body uniquement)
       */
      //const validatedData = incidentSchema.parse(req.body);
      const validatedData = incidentSchema.parse(req.body) as CreateIncidentDTO;
      /**
       * 3️⃣ Fichiers (multer)
       */
      const files = req.files as Express.Multer.File[] | undefined;
      /**
       * 4️⃣ Initialisation UseCase
       */
      const repo = new PrismaIncidentRepository();
      const useCase = new CreateIncidentUseCase(repo);

      /**
       * 5️⃣ Exécution métier
       */
      //const validatedData = incidentSchema.parse(req.body);
      const incident = await useCase.execute(
        validatedData,
        authUser.id,
        files
      );

      /**
       * 6️⃣ Réponse
       */
      return res.status(201).json(incident);

    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({
          message: "Payload invalide",
          issues: error.issues,
        });
      }

      console.error("[INCIDENT CREATE] ERROR:", error);

      return res.status(500).json({
        message: "Erreur serveur",
        error: error?.message ?? String(error),
      });
    }
  }


  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user as AuthUser | undefined;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      const rawPage = Number(req.query.page);
      const rawSize = Number(req.query.size ?? req.query.limit);

      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 100) : 10;

      const userId = Number(authUser.id);
      if (Number.isNaN(userId)) return res.status(400).json({ message: "Invalid user id" });

      const skip = (page - 1) * size;
      const take = size;

      const isAdmin = hasAdminLikeAccess(authUser);

      const repo = new PrismaIncidentRepository();

      const result = await repo.findAll(
        userId,
        isAdmin,
        skip,
        take,
        {},
        { createdAt: "desc" }
      );

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {

      if (!(req as any).user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const repo = new PrismaIncidentRepository();
      const useCase = new GetIncidentByIdUseCase(repo);

      const user = (req as any).user as AuthUser;

      // ✅ ADMIN ou MANAGER = voit tout
      const isAdmin = hasAdminLikeAccess(user);

      const incident = await useCase.execute(
        req.params.id,
        user.id,
        isAdmin
      );

      if (!incident) {
        return res.status(404).json({ message: 'Incident not found' });
      }

      return res.json(incident);

    } catch (error) {
      next(error);
    }
  }


  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user;
      if (!authUser?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = incidentSchema.partial().parse(req.body) as UpdateIncidentDTO;

      // ✅ Guard: seuls le déclarant, CONTROLEUR ou ADMIN/MANAGER peuvent clôturer
      const wantsClose = String(validatedData?.status ?? "").toUpperCase() === "CLOSED";

      if (wantsClose) {
        return res.status(400).json({
          message: "Utilise l'endpoint /incidents/:id/close avec un commentaire de clôture",
        });
      }

      const files = (req as any).files as Express.Multer.File[] | undefined;

      const repo = new PrismaIncidentRepository();
      const useCase = new UpdateIncidentUseCase(repo);

      const incident = await useCase.execute(req.params.id, validatedData, files);

      return res.json(incident);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaIncidentRepository();
      const useCase = new DeleteIncidentUseCase(repo);
      await useCase.execute((req as any).params.id);
      return (res as any).status(204).send();
    } catch (error) {
      // Fix: Type 'NextFunction' has no call signatures.
      (next as any)(error);
    }
  }

  static async getAttachments(req: Request, res: Response) {
    const incidentId = Number(req.params.incidentId);

    const attachments = await prisma.attachment.findMany({
      where: {
        incidentId,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return res.json(attachments);
  }

  static async deleteAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const incidentId = Number(req.params.incidentId);
      const attachmentId = Number(req.params.attachmentId);

      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, incidentId },
      });

      if (!attachment) {
        return res.status(404).json({ message: 'Attachment not found' });
      }

      // 🔥 SUPPRESSION FICHIER
      if (attachment.url) {
        const absolutePath = path.resolve(attachment.url);
        await fs.unlink(absolutePath).catch(() => {
          // optionnel : log si fichier déjà absent
        });
      }

      // 🔥 SUPPRESSION DB
      await prisma.attachment.delete({
        where: { id: attachmentId },
      });

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  }


  static async generatePdf(req: Request, res: Response, next: NextFunction) {
    try {
      if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });

      const incidentId = req.params.id;
      const user = (req as any).user as AuthUser;

      const isAdmin =
        user.roles?.some((r: any) =>
          typeof r === "string"
            ? r === "ADMIN"
            : r?.name === "ADMIN" || r?.role?.name === "ADMIN"
        ) ?? false;

      const repo = new PrismaIncidentRepository();
      const incident = await repo.findById(incidentId, user.id, isAdmin);

      if (!incident) {
        return res.status(404).json({ message: "Incident introuvable ou accès refusé" });
      }

      // ✅ chemins stables (adapte les ..)
      const TEMPLATE_DIR = path.resolve(__dirname, "../../../../templates");
      const ASSETS_DIR = path.resolve(__dirname, "../../../../assets");

      const templatePath = path.join(TEMPLATE_DIR, "incident-report.html");
      const logoPath = path.join(ASSETS_DIR, "logo.png");

      const template = await fs.readFile(templatePath, "utf8");
      const logoBuffer = await fs.readFile(logoPath);
      const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

      const escapeHtml = (s: any) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      // Texte libre multi-lignes : échappe le HTML PUIS convertit les retours
      // à la ligne en <br/> pour préserver les paragraphes à l'impression.
      const escapeMultiline = (s: any) =>
        escapeHtml(s).replace(/\r\n|\r|\n/g, "<br/>");

      const receiverSites =
        Array.isArray(incident.sites) && incident.sites.length
          ? incident.sites.map((s: any) => s?.name ?? s?.site?.name).filter(Boolean).join(", ")
          : "—";

      const impactedSites =
        Array.isArray(incident.impactedSites) && incident.impactedSites.length
          ? incident.impactedSites.map((s: any) => s?.name ?? s?.site?.name).filter(Boolean).join(", ")
          : "—";


      // Combine personnes et glpiUsers dans la même liste
      const personnesArray = [];
      if (Array.isArray(incident.personnes) && incident.personnes.length) {
        personnesArray.push(...incident.personnes.map((p: any) => p?.fullname ?? p?.name ?? ""));
      }
      if (Array.isArray(incident.glpiUsers) && incident.glpiUsers.length) {
        personnesArray.push(...incident.glpiUsers.map((u: any) => u?.fullname || u?.fullName || u?.login || "Utilisateur GLPI"));
      }
      const personnesList =
        personnesArray.length > 0
          ? `<ul>${personnesArray.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
          : "—";

      const createdAt = incident.createdAt ? new Date(incident.createdAt).toISOString().slice(0, 10) : "—";
      const dueDate = incident.dueDate ? new Date(incident.dueDate).toISOString().slice(0, 10) : "—";
      const formatDate = (value: any) => value ? new Date(value).toISOString().slice(0, 10) : "—";

      const glpiTicketNumber =
        incident.glpiTicketId ? String(incident.glpiTicketId) : "—";

      const tasksHtml =
        Array.isArray(incident.tasks) && incident.tasks.length
          ? `<table class="tasks-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Description</th>
                  <th>Statut</th>
                  <th>Échéance</th>
                </tr>
              </thead>
              <tbody>
                ${incident.tasks
                  .map((task: any) => `
                    <tr>
                      <td>${escapeHtml(task.name ?? "—")}</td>
                      <td>${escapeHtml(task.description ?? "—")}</td>
                      <td>${escapeHtml(task.status ?? "—")}</td>
                      <td>${escapeHtml(dueDate)}</td>
                    </tr>
                  `)
                  .join("")}
              </tbody>
            </table>`
          : "AUCUNE TACHE DE RESOLUTION DEFINIS POUR CET INCIDENT";

      const html = template
        .replace("{{reference}}", escapeHtml(incident.reference))
        .replace("{{createdAt}}", escapeHtml(createdAt))
        .replace("{{dueDate}}", escapeHtml(dueDate))
        .replace("{{creator}}", escapeHtml(incident.reporterName ?? "—"))
        .replace("{{emitterService}}", escapeHtml(incident.serviceEmitter ?? "—"))
        .replace("{{receiverService}}", escapeHtml(receiverSites))
        .replace("{{incidentSite}}", escapeHtml(impactedSites))
        .replace("{{status}}", escapeHtml(incident.status))
        .replace("{{criticality}}", escapeHtml(incident.criticality ?? "—"))
        .replace("{{priority}}", escapeHtml(incident.urgency ?? "—"))
        .replace("{{category}}", escapeHtml(incident.category ?? "—"))
        .replace("{{process}}", escapeHtml(incident.processDomain ?? "—"))
        .replace("{{cause}}", escapeMultiline(incident.subCategory ?? "—"))
        .replace("{{description}}", escapeMultiline(incident.description ?? "—"))
        .replace("{{rootCause}}", escapeMultiline(incident.rootCause ?? "—"))
        .replace("{{proposedSolution}}", escapeMultiline(incident.proposedSolution ?? "—"))
        .replace("{{personnes}}", personnesList)
        .replace("{{scope}}", escapeMultiline(incident.scope ?? "—"))
        .replace("{{tasks}}", tasksHtml)
        .replace("{{actions}}", "—")
        .replace("{{proposal}}", "—")
        .replace("{{observation}}", "—")
        .replace("{{glpiTicketNumber}}", escapeHtml(glpiTicketNumber))
        .replace("{{LOGO_URL}}", logoBase64);

      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="incident_${incident.id}.pdf"`);
      res.setHeader("Content-Length", String(pdfBuffer.length));

      return res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  static async downloadAttachment(req: Request, res: Response) {
    const { attachmentId } = req.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id: Number(attachmentId) }
    });

    if (!attachment) {
      return res.status(404).json({ message: 'Fichier introuvable' });
    }

    const filePath = path.join(process.cwd(), attachment.url);

    return res.download(filePath, attachment.fileName);
  }

    static async getStatusStats(req: any, res: any) {
    try {

      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      //const roles = dbUser.roles.map(r => r.role.name);
      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());
      const incidentService = new IncidentService();

      const stats = await incidentService.getStatusStats({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined
      });

      res.json(stats);

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération stats' });
    }
  }

    static async getTrend(req: any, res: any) {
    try {
      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());

      const incidentService = new IncidentService();

      const trend = await incidentService.getTrend7Days({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined,
      });

      res.json(trend);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération tendance 7 jours' });
    }
  }

  static async getByService(req: any, res: any) {
    try {
      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());

      const incidentService = new IncidentService();

      const data = await incidentService.getByService({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined,
      });

      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération stats par service' });
    }
  }

  static async getByPriority(req: any, res: any) {
    try {
      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());

      const incidentService = new IncidentService();

      const data = await incidentService.getByPriority({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined,
      });

      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération stats par priorité' });
    }
  }

    static async getOverdue(req: any, res: any) {
    try {
      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());

      const incidentService = new IncidentService();

      const count = await incidentService.getOverdue({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined,
      });

      res.json({ count });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération stats retard' });
    }
  }

  static async getDailyActivity(req: any, res: any) {
    try {
      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());

      const incidentService = new IncidentService();

      const data = await incidentService.getDailyActivity({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined,
      });

      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération activité journalière' });
    }
  }


  static async query(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user as AuthUser | undefined;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      // ✅ log brut
      console.log("[INCIDENTS QUERY] raw body:", req.body);

      // ✅ body vide => erreur claire
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          message: "Body JSON vide. Vérifie express.json() et Content-Type.",
        });
      }

      // ✅ parse Zod
      const parsed = IncidentQuerySchema.parse(req.body);
      console.log("[INCIDENTS QUERY] parsed:", parsed);

      const isAdmin = hasAdminLikeAccess(authUser);
      const userId = Number(authUser.id);

      // ✅ build where + order
      const whereUI = buildIncidentWhere(parsed.filters, parsed.logic);
      const orderBy = parsed.sort.length
        ? parsed.sort.map((s) => ({ [s.field]: s.dir }))
        : [{ createdAt: "desc" }];

      console.log("[INCIDENTS QUERY] whereUI:", JSON.stringify(whereUI));
      console.log("[INCIDENTS QUERY] orderBy:", JSON.stringify(orderBy));

      const skip = (parsed.page - 1) * parsed.pageSize;
      const take = parsed.pageSize;

      const repo = new PrismaIncidentRepository();
      const result = await repo.findAll(userId, isAdmin, skip, take, whereUI, orderBy as any);

      return res.json(result);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        console.error("[INCIDENTS QUERY] ZodError:", error.issues);
        return res.status(400).json({
          message: "Payload de filtre invalide",
          issues: error.issues,
        });
      }

      // ✅ Prisma: renvoyer le message complet
      const prismaMsg =
        error?.code || error?.name?.includes("Prisma")
          ? {
            name: error?.name,
            code: error?.code,
            message: error?.message,
            meta: error?.meta,
          }
          : null;

      console.error("[INCIDENTS QUERY] ERROR:", error);

      return res.status(500).json({
        message: "Erreur serveur pendant la requête",
        prisma: prismaMsg,
        error: String(error?.message ?? error),
      });
    }
  }

  static async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user as AuthUser | undefined;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      // ✅ body vide => 400 clair (évite parse inutile)
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Body JSON vide" });
      }

      const parsed = IncidentQuerySchema.parse(req.body);

      const isAdmin = hasAdminLikeAccess(authUser);
      const userId = Number(authUser.id);

      const whereUI = buildIncidentWhere(parsed.filters, parsed.logic);
      const orderBy = parsed.sort.length
        ? parsed.sort.map((s) => ({ [s.field]: s.dir }))
        : [{ createdAt: "desc" }];

      const EXPORT_LIMIT = 10000;

      const repo = new PrismaIncidentRepository();

      // ⚠️ exporter tout (ignore pagination UI)
      const result = await repo.findAll(
        userId,
        isAdmin,
        0,
        EXPORT_LIMIT + 1,
        whereUI,
        orderBy as any
      );

      const total = Number(result.total ?? (result.data?.length ?? 0));
      if (total > EXPORT_LIMIT) {
        return res.status(400).json({
          message: `Trop de lignes à exporter (${total}). Limite = ${EXPORT_LIMIT}.`,
        });
      }

      // ✅ chemins stables (évite process.cwd() en prod)
      // Adapte les .. selon ton arborescence (src/presentation/http/controllers/...)
      // const TEMPLATE_DIR = path.resolve(__dirname, "../../../templates");
      // const ASSETS_DIR = path.resolve(__dirname, "../../../assets");
      const TEMPLATE_DIR = path.resolve(__dirname, "../../../../templates");
      const ASSETS_DIR = path.resolve(__dirname, "../../../../assets");

      const templatePath = path.join(TEMPLATE_DIR, "incident-list-report.html");
      const logoPath = path.join(ASSETS_DIR, "logo.png");

      const template = await fs.readFile(templatePath, "utf8");
      const logoBuffer = await fs.readFile(logoPath);
      const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

      const now = new Date();
      const exportAt = now.toLocaleString("fr-FR");
      const dateTag = now.toISOString().slice(0, 10);

      const escapeHtml = (s: any) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      // Texte libre multi-lignes : échappe le HTML PUIS convertit les retours
      // à la ligne en <br/> pour préserver les paragraphes à l'impression.
      const escapeMultiline = (s: any) =>
        escapeHtml(s).replace(/\r\n|\r|\n/g, "<br/>");

      const rows = Array.isArray(result.data) ? result.data : [];

      const rowsHtml = rows
        .map((inc: any) => {
          const createdAt = inc.createdAt ? new Date(inc.createdAt).toLocaleDateString("fr-FR") : "—";
          const dueDate = inc.dueDate ? new Date(inc.dueDate).toLocaleDateString("fr-FR") : "—";

          // ✅ tolérant: sites peut être [{name}] ou [{site:{name}}]
          const sites =
            Array.isArray(inc.sites) && inc.sites.length
              ? inc.sites
                .map((s: any) => s?.name ?? s?.site?.name)
                .filter(Boolean)
                .join(", ")
              : "—";

          const glpiTicketNumber = inc.glpiTicketId ? String(inc.glpiTicketId) : "—";

          return `
            <tr>
              <td>${escapeHtml(inc.reference)}</td>
              <td>${escapeHtml(glpiTicketNumber)}</td>
              <td>${escapeMultiline(inc.description)}</td>
              <td>${escapeMultiline(inc.rootCause ?? "—")}</td>
              <td>${escapeMultiline(inc.proposedSolution ?? "—")}</td>
              <td>${escapeHtml(inc.status)}</td>
              <td>${escapeHtml(inc.urgency)}</td>
              <td>${escapeHtml(inc.serviceEmitter ?? "—")}</td>
              <td>${escapeHtml(sites)}</td>
              <td>${escapeHtml(createdAt)}</td>
              <td>${escapeHtml(dueDate)}</td>
            </tr>
          `;
        })
        .join("");

      const html = template
        .replace("{{LOGO_URL}}", logoBase64)
        .replace("{{EXPORT_AT}}", escapeHtml(exportAt))
        .replace("{{TOTAL}}", String(total))
        .replace("{{ROWS}}", rowsHtml || `<tr><td colspan="8">Aucun résultat</td></tr>`);

      // ✅ génération PDF en mémoire via Playwright
      const pdfBuffer = await IncidentPdfService.generateBuffer(html);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="incidents_${dateTag}.pdf"`);
      res.setHeader("Content-Length", String(pdfBuffer.length));

      return res.status(200).send(pdfBuffer);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Payload invalide", issues: error.issues });
      }
      next(error);
    }
  }


  static async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user as AuthUser | undefined;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      const parsed = IncidentQuerySchema.parse(req.body);

      const isAdmin = hasAdminLikeAccess(authUser);
      const userId = Number(authUser.id);

      const whereUI = buildIncidentWhere(parsed.filters, parsed.logic);
      const orderBy = parsed.sort.length
        ? parsed.sort.map((s) => ({ [s.field]: s.dir }))
        : [{ createdAt: "desc" }];

      // ✅ garde-fou export
      const EXPORT_LIMIT = 10000;

      const repo = new PrismaIncidentRepository();
      const result = await repo.findAll(
        userId,
        isAdmin,
        0,
        EXPORT_LIMIT + 1,
        whereUI,
        orderBy as any
      );

      if (result.total > EXPORT_LIMIT) {
        return res.status(400).json({
          message: `Trop de lignes à exporter (${result.total}). Limite = ${EXPORT_LIMIT}.`,
        });
      }

      // ✅ Sans librairie Excel : on renvoie du CSV (Excel l’ouvre)
      const sep = ";";
      const header = [
        "Référence",
        "Ticket GLPI",
        "Description",
        "Cause racine",
        "Solution proposée",
        "Statut",
        "Priorité",
        "Déclarant",
        "Service émetteur",
        "Service traitant (sites)",
        "Créé le",
        "Échéance",
      ];
      // ✅ compat TS: pas de replaceAll
      const csvEscape = (v: any) => {
        const s = String(v ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      };

      const lines = [
        header.map(csvEscape).join(sep),
        ...(result.data ?? []).map((inc: any) => {
          const createdAt = inc.createdAt
            ? new Date(inc.createdAt).toLocaleDateString("fr-FR")
            : "";
          const dueDate = inc.dueDate
            ? new Date(inc.dueDate).toLocaleDateString("fr-FR")
            : "";
          const sites =
            Array.isArray(inc.sites) && inc.sites.length
              ? inc.sites.map((s: any) => s.name).join(", ")
              : "";

          const glpiTicketNumber = inc.glpiTicketId ? String(inc.glpiTicketId) : "";

          return [
            inc.reference,
            glpiTicketNumber,
            inc.description,
            inc.rootCause ?? "",
            inc.proposedSolution ?? "",
            inc.status,
            inc.urgency,
            inc.reporterName,
            inc.serviceEmitter ?? "",
            sites,
            createdAt,
            dueDate,
          ]
            .map(csvEscape)
            .join(sep);
        }),
      ].join("\n");

      const now = new Date();
      const dateTag = now.toISOString().slice(0, 10);

      // ✅ IMPORTANT : ajouter BOM UTF-8
      const BOM = "\uFEFF";
      const csvWithBom = BOM + lines;

      // ✅ envoyer en Buffer UTF-8
      const buffer = Buffer.from(csvWithBom, "utf8");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="incidents_${dateTag}.csv"`);
      res.setHeader("Content-Length", buffer.length);

      return res.status(200).send(buffer);

    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Payload invalide", issues: error.issues });
      }
      next(error);
    }
  }

  static async close(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = (req as any).user as AuthUser | undefined;
      if (!authUser?.id) return res.status(401).json({ message: "Unauthorized" });

      const { content } = closeSchema.parse(req.body);

      const isAdmin = hasAdminLikeAccess(authUser);
      const userId = Number(authUser.id);

      const repo = new PrismaIncidentRepository();
      const useCase = new CloseIncidentUseCase(repo);

      const incident = await useCase.execute({
        id: req.params.id,
        userId,
        isAdmin,
        comment: content, // ✅ on mappe vers ce que ton usecase attend
      });

      return res.json(incident);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({
          message: "Bad Request",
          error: error.issues?.[0]?.message ?? "Payload invalide",
          issues: error.issues,
        });
      }

      console.error("CLOSE INCIDENT ERROR:", {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
      });

            return res.status(500).json({
        message: "Internal Server Error",
        error: error?.message,
        code: error?.code,
      });
    }
  }

    static async getByCategoryProcess(req: any, res: any) {
    try {
      const authUser = req.user;

      const dbUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const roles = dbUser.roles
        .map(r => r.role?.name)
        .filter(Boolean)
        .map((name: string) => name.toUpperCase());

      // ✅ Lecture du paramètre dateFrom (timestamp ISO passé en query string)
      let dateFrom: Date | undefined;
      if (req.query.dateFrom) {
        const parsed = new Date(req.query.dateFrom);
        if (!isNaN(parsed.getTime())) {
          dateFrom = parsed;
        }
      }

      const incidentService = new IncidentService();

      const data = await incidentService.getByCategoryProcess({
        id: dbUser.id,
        roles: roles,
        siteId: dbUser.siteId ?? undefined,
        dateFrom,
      });

      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur récupération stats par catégorie/processus' });
    }
  }
}
