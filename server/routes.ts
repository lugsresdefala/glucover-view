import type { Express, RequestHandler, Request } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { generateClinicalRecommendation } from "./openai";
import { patientEvaluationSchema, type Patient, checkCriticalGlucose } from "@shared/schema";
import { z } from "zod";
import { getCookieSecurity, getSession } from "./session";
import { AuditLogger } from "./audit-logger";
import { NotificationService } from "./notification-service";
import { PatientHistoryService } from "./patient-history-service";
import { logger } from "./logger";

// Extended request types
interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface PatientAuthenticatedRequest extends Request {
  patient?: Patient;
}

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => {
      try {
        const parsed = new URL(origin);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => origin !== null),
);

function getRequestHost(req: Request) {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) || req.protocol;
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) || req.get("host");
  if (!host) return undefined;
  return `${proto}://${host}`;
}

function normalizeOrigin(origin: string | undefined) {
  if (!origin) return undefined;
  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
}

function isTrustedOrigin(origin: string | undefined, host: string | undefined) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  if (host && normalizedOrigin === host) return true;
  return allowedOrigins.has(normalizedOrigin);
}

// Patient session middleware
const isPatientAuthenticated: RequestHandler = (req: PatientAuthenticatedRequest, res, next) => {
  if (req.session && (req.session as any).patientId) {
    next();
  } else {
    res.status(401).json({ message: "Paciente não autenticado" });
  }
};

// Professional session middleware
const isAuthenticated: RequestHandler = (req: AuthenticatedRequest, res, next) => {
  const userId = (req.session as any)?.userId;
  if (userId) {
    req.userId = userId;
    next();
  } else {
    res.status(401).json({ message: "Não autenticado" });
  }
};

// Get current user role from database
async function getUserRole(userId: string): Promise<string> {
  const user = await storage.getUserById(userId);
  return user?.role || "doctor";
}

// Role-based middleware
const requireRole = (...allowedRoles: string[]): RequestHandler => {
  return async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const role = await getUserRole(userId);
      if (!allowedRoles.includes(role)) {
        logger.warn("Access denied - insufficient role", { userId, role, allowedRoles });
        return res.status(403).json({ message: "Acesso não autorizado para este perfil" });
      }
      
      next();
    } catch (error) {
      logger.error("Error checking permissions", error as Error, { userId: req.userId });
      res.status(500).json({ message: "Erro ao verificar permissões" });
    }
  };
};

// Validation schemas
const patientRegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
});

const patientLoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Professional authentication schemas
const professionalRegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  lastName: z.string().optional(),
  role: z.enum(["medico", "enfermeira", "nutricionista", "admin", "coordinator"]).default("medico"),
});

const professionalLoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Setup session middleware
  app.set("trust proxy", 1);
  app.use(getSession());
  const { secureCookies, sameSite } = getCookieSecurity();

  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    const host = getRequestHost(req);
    const trusted = isTrustedOrigin(origin, host);

    if (trusted && origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token, X-XSRF-Token",
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    return next();
  });

  app.use((req, res, next) => {
    const sessionData = req.session as any;
    if (sessionData && !sessionData.csrfToken) {
      sessionData.csrfToken = crypto.randomBytes(24).toString("hex");
    }

    if (sessionData?.csrfToken) {
      res.cookie("csrf_token", sessionData.csrfToken, {
        httpOnly: false,
        secure: secureCookies,
        sameSite,
      });
    }

    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      req.path === "/api/csrf-token"
    ) {
      return next();
    }

    const csrfHeader =
      (req.headers["x-csrf-token"] as string | undefined) ||
      (req.headers["x-xsrf-token"] as string | undefined);

    if (sessionData?.csrfToken && csrfHeader === sessionData.csrfToken) {
      return next();
    }

    return res.status(403).json({ message: "CSRF token missing or invalid" });
  });

  app.get("/api/csrf-token", (req, res) => {
    const token = (req.session as any)?.csrfToken;
    if (!token) {
      return res.status(500).json({ message: "CSRF token unavailable" });
    }
    res.json({ csrfToken: token });
  });

  // Health check endpoints for monitoring
  app.get("/healthz", async (_req, res) => {
    try {
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Health check failed", error as Error);
      res.status(503).json({ status: "unhealthy" });
    }
  });

  app.get("/readyz", async (_req, res) => {
    try {
      // Readiness check - verify database connection without exposing data
      await storage.getAllEvaluations();
      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
        database: "connected",
      });
    } catch (error) {
      logger.error("Readiness check failed - database connection error", error as Error);
      res.status(503).json({
        status: "not ready",
      });
    }
  });

  // Basic CSRF mitigation: ensure mutating requests originate from the same host.
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const originHeader = req.headers.origin as string | undefined;
    const refererHeader = req.headers.referer as string | undefined;
    const origin = originHeader || normalizeOrigin(refererHeader);
    const host = getRequestHost(req);

    if (isTrustedOrigin(origin, host)) {
      return next();
    }

    return res.status(403).json({ message: "CSRF protection: invalid origin" });
  });

  // ========== Patient Authentication Routes ==========
  
  // Patient registration
  app.post("/api/patient/register", async (req, res) => {
    try {
      const validationResult = patientRegisterSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }

      const { email, password, name, phone } = validationResult.data;

      // Check if patient already exists
      const existing = await storage.getPatientByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }

      const patient = await storage.createPatient(email, password, name, phone);
      
      // Set session and save explicitly
      (req.session as any).patientId = patient.id;
      (req.session as any).patientEmail = patient.email;
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({
          message: "Cadastro realizado com sucesso",
          patient: {
            id: patient.id,
            email: patient.email,
            name: patient.name,
          },
        });
      });
    } catch (error) {
      console.error("Error registering patient:", error);
      res.status(500).json({ message: "Erro ao realizar cadastro" });
    }
  });

  // Patient login
  app.post("/api/patient/login", async (req, res) => {
    try {
      const validationResult = patientLoginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }

      const { email, password } = validationResult.data;
      const patient = await storage.validatePatientPassword(email, password);
      
      if (!patient) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      // Set session and save explicitly
      (req.session as any).patientId = patient.id;
      (req.session as any).patientEmail = patient.email;
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({
          message: "Login realizado com sucesso",
          patient: {
            id: patient.id,
            email: patient.email,
            name: patient.name,
          },
        });
      });
    } catch (error) {
      console.error("Error logging in patient:", error);
      res.status(500).json({ message: "Erro ao realizar login" });
    }
  });

  // Patient logout
  app.post("/api/patient/logout", (req, res) => {
    (req.session as any).patientId = null;
    (req.session as any).patientEmail = null;
    res.json({ message: "Logout realizado com sucesso" });
  });

  // Get current patient session
  app.get("/api/patient/me", async (req, res) => {
    try {
      const patientId = (req.session as any).patientId;
      if (!patientId) {
        return res.json({ patient: null });
      }
      
      const patient = await storage.getPatientById(patientId);
      if (!patient) {
        return res.json({ patient: null });
      }
      
      res.json({
        patient: {
          id: patient.id,
          email: patient.email,
          name: patient.name,
          phone: patient.phone,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar dados" });
    }
  });

  // ========== Patient Self-Service Routes ==========

  // Patient: Get their own evaluations
  app.get("/api/patient/evaluations", isPatientAuthenticated, async (req, res) => {
    try {
      const patientId = (req.session as any).patientId;
      const evaluations = await storage.getEvaluationsByPatient(patientId);
      res.json(evaluations);
    } catch (error) {
      console.error("Error fetching patient evaluations:", error);
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });

  // Patient: Submit their own glucose data
  app.post("/api/patient/evaluate", isPatientAuthenticated, async (req, res) => {
    try {
      const validationResult = patientEvaluationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }

      const patientId = (req.session as any).patientId;
      const patient = await storage.getPatientById(patientId);
      
      if (!patient) {
        return res.status(401).json({ message: "Paciente não encontrado" });
      }

      const evaluationData = {
        ...validationResult.data,
        patientName: patient.name,
      };

      // Create evaluation linked to patient
      const storedEvaluation = await storage.createEvaluation(evaluationData, undefined, patientId);

      // Generate recommendation
      const recommendation = await generateClinicalRecommendation(evaluationData);
      const updatedEvaluation = await storage.updateEvaluationRecommendation(
        storedEvaluation.id,
        recommendation
      );

      res.json({
        evaluation: updatedEvaluation,
        recommendation,
      });
    } catch (error) {
      console.error("Error creating patient evaluation:", error);
      res.status(500).json({ message: "Erro ao salvar avaliação" });
    }
  });

  // Patient: Get their assigned doctors
  app.get("/api/patient/doctors", isPatientAuthenticated, async (req, res) => {
    try {
      const patientId = (req.session as any).patientId;
      const doctors = await storage.getDoctorsForPatient(patientId);
      res.json(doctors.map(d => ({
        id: d.id,
        name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email,
        email: d.email,
        role: d.role,
      })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar médicos" });
    }
  });

  // Patient: Get available professionals to link
  app.get("/api/patient/available-professionals", isPatientAuthenticated, async (req, res) => {
    try {
      const professionals = await storage.getAllProfessionals();
      res.json(professionals.map(p => ({
        id: p.id,
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email,
        email: p.email,
        role: p.role,
      })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar profissionais" });
    }
  });

  // Patient: Link to a professional
  app.post("/api/patient/link-professional", isPatientAuthenticated, async (req, res) => {
    try {
      const patientId = (req.session as any).patientId;
      const { professionalId } = req.body;
      
      if (!professionalId) {
        return res.status(400).json({ message: "ID do profissional é obrigatório" });
      }
      
      // Validate that the professional exists and has a clinical role
      const professional = await storage.getUserById(professionalId);
      if (!professional) {
        return res.status(404).json({ message: "Profissional não encontrado" });
      }
      
      const clinicalRoles = ["medico", "enfermeira", "nutricionista", "coordinator"];
      if (!professional.role || !clinicalRoles.includes(professional.role)) {
        return res.status(400).json({ message: "Usuário não é um profissional de saúde" });
      }
      
      await storage.assignPatientToDoctor(professionalId, patientId);
      res.json({ message: "Profissional vinculado com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao vincular profissional" });
    }
  });

  // Patient: Unlink from a professional
  app.delete("/api/patient/unlink-professional/:professionalId", isPatientAuthenticated, async (req, res) => {
    try {
      const patientId = (req.session as any).patientId;
      const professionalId = req.params.professionalId;
      
      await storage.removePatientFromDoctor(professionalId, patientId);
      res.json({ message: "Vínculo removido com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover vínculo" });
    }
  });

  // ========== Healthcare Professional Authentication ==========

  // Professional registration
  app.post("/api/user/register", async (req, res) => {
    try {
      const validationResult = professionalRegisterSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }
      
      const { email, password, firstName, lastName, role } = validationResult.data;
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }
      
      const user = await storage.createUser(email, password, firstName, lastName, role);
      
      // Only auto-login if user is approved (coordinators are auto-approved)
      if (user.isApproved) {
        (req.session as any).userId = user.id;
        (req.session as any).userEmail = user.email;
        
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ message: "Erro ao salvar sessão" });
          }
          res.json({
            message: "Cadastro realizado com sucesso",
            user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, isApproved: user.isApproved },
          });
        });
      } else {
        // User needs approval - don't log them in
        res.json({
          message: "Cadastro realizado! Aguarde a aprovação do coordenador para acessar o sistema.",
          user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, isApproved: false },
          pendingApproval: true,
        });
      }
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Erro ao realizar cadastro" });
    }
  });

  // Professional login
  app.post("/api/user/login", async (req, res) => {
    try {
      const validationResult = professionalLoginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }
      
      const { email, password } = validationResult.data;
      
      const user = await storage.validateUserPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }
      
      // Check if user is approved
      if (!user.isApproved) {
        return res.status(403).json({ 
          message: "Seu cadastro ainda não foi aprovado. Aguarde a aprovação do coordenador.",
          pendingApproval: true 
        });
      }
      
      (req.session as any).userId = user.id;
      (req.session as any).userEmail = user.email;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({
          message: "Login realizado com sucesso",
          user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, isApproved: user.isApproved },
        });
      });
    } catch (error) {
      console.error("Error logging in user:", error);
      res.status(500).json({ message: "Erro ao realizar login" });
    }
  });

  // Professional logout
  app.post("/api/user/logout", (req, res) => {
    (req.session as any).userId = null;
    (req.session as any).userEmail = null;
    res.json({ message: "Logout realizado com sucesso" });
  });

  // Get current user info with role
  app.get("/api/user/me", async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.json({ user: null });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.json({ user: null });
      }
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role || "medico",
          isApproved: user.isApproved,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar dados do usuário" });
    }
  });

  // ========== User Approval Management (Coordinator only) ==========
  
  // Get pending approval users
  app.get("/api/admin/pending-users", isAuthenticated, requireRole("coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const pendingUsers = await storage.getPendingApprovalUsers();
      res.json(pendingUsers.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      logger.error("Error fetching pending users", error as Error);
      res.status(500).json({ message: "Erro ao buscar usuários pendentes" });
    }
  });
  
  // Approve user
  app.post("/api/admin/approve-user/:userId", isAuthenticated, requireRole("coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.userId;
      const coordinatorId = req.userId;
      
      if (!coordinatorId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const approvedUser = await storage.approveUser(userId, coordinatorId);
      if (!approvedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json({ 
        message: "Usuário aprovado com sucesso",
        user: {
          id: approvedUser.id,
          email: approvedUser.email,
          firstName: approvedUser.firstName,
          role: approvedUser.role,
          isApproved: approvedUser.isApproved,
        }
      });
    } catch (error) {
      logger.error("Error approving user", error as Error);
      res.status(500).json({ message: "Erro ao aprovar usuário" });
    }
  });
  
  // Reject user (delete)
  app.delete("/api/admin/reject-user/:userId", isAuthenticated, requireRole("coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.userId;
      
      const deleted = await storage.rejectUser(userId);
      if (!deleted) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json({ message: "Usuário rejeitado e removido" });
    } catch (error) {
      logger.error("Error rejecting user", error as Error);
      res.status(500).json({ message: "Erro ao rejeitar usuário" });
    }
  });

  // ========== Healthcare Professional Routes (Doctors/Coordinators) ==========

  // Doctor: Get their assigned patients
  app.get("/api/doctor/patients", isAuthenticated, requireRole("medico", "enfermeira", "nutricionista", "coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const role = await getUserRole(userId);
      
      // Coordinators can see all patients
      if (role === "coordinator") {
        const allPatients = await storage.getAllPatients();
        return res.json(allPatients.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
        })));
      }
      
      // Doctors see only their patients
      const patients = await storage.getPatientsForDoctor(userId);
      res.json(patients.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
      })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar pacientes" });
    }
  });

  // Doctor: Assign patient
  app.post("/api/doctor/patients/:patientId/assign", isAuthenticated, requireRole("medico", "enfermeira", "nutricionista", "coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      const patientId = parseInt(req.params.patientId, 10);
      
      if (!userId || isNaN(patientId)) {
        return res.status(400).json({ message: "Dados inválidos" });
      }
      
      await storage.assignPatientToDoctor(userId, patientId);
      res.json({ message: "Paciente vinculado com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao vincular paciente" });
    }
  });

  // Doctor: Get evaluations for their patients
  app.get("/api/doctor/evaluations", isAuthenticated, requireRole("medico", "enfermeira", "nutricionista", "coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const role = await getUserRole(userId);
      
      // Coordinators can see all evaluations
      if (role === "coordinator") {
        const allEvaluations = await storage.getAllEvaluations();
        return res.json(allEvaluations);
      }
      
      // Get evaluations created by this professional
      const ownEvaluations = await storage.getAllEvaluations(userId);
      
      // Get evaluations for linked patients
      const patientEvaluations = await storage.getEvaluationsForDoctor(userId);
      
      // Combine and deduplicate by ID
      const allEvaluations = [...ownEvaluations, ...patientEvaluations];
      const uniqueMap = new Map(allEvaluations.map(e => [e.id, e]));
      const combined = Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      res.json(combined);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });

  // Doctor: Get specific patient's evaluations
  app.get("/api/doctor/patients/:patientId/evaluations", isAuthenticated, requireRole("medico", "enfermeira", "nutricionista", "coordinator"), async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = parseInt(req.params.patientId, 10);
      if (isNaN(patientId)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const evaluations = await storage.getEvaluationsByPatient(patientId);
      res.json(evaluations);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });

  // ========== Coordinator-Only Routes ==========

  // Coordinator: Get all users (doctors)
  app.get("/api/admin/users", isAuthenticated, requireRole("coordinator"), async (req, res) => {
    try {
      const allUsers = await storage.getUsersByRole("medico");
      const enfermeiras = await storage.getUsersByRole("enfermeira");
      const nutricionistas = await storage.getUsersByRole("nutricionista");
      const coordinators = await storage.getUsersByRole("coordinator");
      res.json([...allUsers, ...enfermeiras, ...nutricionistas, ...coordinators].map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
      })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // Coordinator: Update user role
  app.patch("/api/admin/users/:userId/role", isAuthenticated, requireRole("coordinator"), async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!["medico", "enfermeira", "nutricionista", "admin", "coordinator"].includes(role)) {
        return res.status(400).json({ message: "Perfil inválido" });
      }
      
      const updatedUser = await storage.updateUserRole(userId, role);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json({
        message: "Perfil atualizado com sucesso",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  // Coordinator: Get all patients
  app.get("/api/admin/patients", isAuthenticated, requireRole("coordinator"), async (req, res) => {
    try {
      const allPatients = await storage.getAllPatients();
      res.json(allPatients.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        createdAt: p.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar pacientes" });
    }
  });

  // Coordinator: Assign patient to any doctor
  app.post("/api/admin/assign", isAuthenticated, requireRole("coordinator"), async (req, res) => {
    try {
      const { doctorId, patientId } = req.body;
      
      if (!doctorId || !patientId) {
        return res.status(400).json({ message: "Dados inválidos" });
      }
      
      await storage.assignPatientToDoctor(doctorId, parseInt(patientId, 10));
      res.json({ message: "Paciente vinculado com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao vincular paciente" });
    }
  });

  // ========== Legacy Routes (kept for backward compatibility) ==========

  // Get all evaluations for the authenticated user
  app.get("/api/evaluations", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      const evaluations = await storage.getAllEvaluations(userId);
      res.json(evaluations);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });

  // Get single evaluation
  app.get("/api/evaluations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const evaluation = await storage.getEvaluation(id);
      if (!evaluation) {
        return res.status(404).json({ message: "Avaliação não encontrada" });
      }
      res.json(evaluation);
    } catch (error) {
      console.error("Error fetching evaluation:", error);
      res.status(500).json({ message: "Erro ao buscar avaliação" });
    }
  });

  // Delete single evaluation
  app.delete("/api/evaluations/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const userId = req.userId;
      const success = await storage.deleteEvaluation(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Avaliação não encontrada" });
      }
      res.json({ message: "Avaliação removida com sucesso" });
    } catch (error) {
      console.error("Error deleting evaluation:", error);
      res.status(500).json({ message: "Erro ao remover avaliação" });
    }
  });

  // Delete multiple evaluations
  app.delete("/api/evaluations", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { ids, deleteAll } = req.body;
      const userId = req.userId;
      
      if (deleteAll === true) {
        const count = await storage.deleteAllEvaluations(userId);
        return res.json({ message: `${count} avaliações removidas com sucesso`, count });
      }
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Lista de IDs inválida" });
      }
      
      const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      const count = await storage.deleteEvaluations(numericIds, userId);
      res.json({ message: `${count} avaliações removidas com sucesso`, count });
    } catch (error) {
      console.error("Error deleting evaluations:", error);
      res.status(500).json({ message: "Erro ao remover avaliações" });
    }
  });

  // Search evaluations by patient name
  app.get("/api/evaluations/search", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Nome do paciente é obrigatório" });
      }
      
      const userId = req.userId;
      const allEvaluations = await storage.getAllEvaluations(userId);
      
      const normalizedSearch = name.toLowerCase().trim();
      const matchingEvaluations = allEvaluations.filter(e => 
        e.patientName.toLowerCase().includes(normalizedSearch)
      );
      
      const latestEvaluation = matchingEvaluations.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0] || null;
      
      res.json({ evaluation: latestEvaluation });
    } catch (error) {
      console.error("Error searching evaluations:", error);
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });

  // Batch create evaluations with AI recommendations
  app.post("/api/evaluations/batch", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { evaluations: evaluationsData } = req.body;

      if (!Array.isArray(evaluationsData) || evaluationsData.length === 0) {
        return res.status(400).json({ message: "Lista de avaliações vazia" });
      }

      const userId = req.userId;
      const results = [];
      const processedPatients = new Set<string>();

      logger.info("Starting batch evaluation", {
        count: evaluationsData.length,
        userId,
      });

      for (const data of evaluationsData) {
        try {
          const validationResult = patientEvaluationSchema.safeParse(data);
          if (!validationResult.success) {
            results.push({
              patientName: data.patientName || "Desconhecido",
              success: false,
              error: "Dados inválidos",
            });
            continue;
          }

          const evaluationData = validationResult.data;

          // Check for duplicate in current batch
          if (processedPatients.has(evaluationData.patientName)) {
            logger.warn("Duplicate patient in batch", {
              patientName: evaluationData.patientName,
            });
            results.push({
              patientName: evaluationData.patientName,
              success: false,
              error: "Paciente duplicado neste lote",
            });
            continue;
          }

          processedPatients.add(evaluationData.patientName);

          // Use upsert to update existing patients instead of duplicating
          const storedEvaluation = await storage.upsertEvaluation(evaluationData, userId);
          const patient = await storage.getPatientByName(evaluationData.patientName);
          const patientId = patient?.id;

          const recommendation = await generateClinicalRecommendation(evaluationData);
          const updatedEvaluation = await storage.updateEvaluationRecommendation(
            storedEvaluation.id,
            recommendation
          );

          // Log audit trail
          if (patientId) {
            await AuditLogger.logEvaluationCreate(userId, patientId, storedEvaluation.id, req);
          }

          // Check for critical glucose values
          const criticalAlerts = checkCriticalGlucose(evaluationData.glucoseReadings);
          if (criticalAlerts.length > 0 && patientId) {
            await NotificationService.notifyCriticalGlucose(
              patientId,
              userId,
              storedEvaluation.id,
              criticalAlerts
            );
          }

          results.push({
            patientName: evaluationData.patientName,
            success: true,
            evaluation: updatedEvaluation,
          });
        } catch (err) {
          logger.error("Error processing evaluation in batch", err as Error, {
            patientName: data.patientName,
          });
          results.push({
            patientName: data.patientName || "Desconhecido",
            success: false,
            error: err instanceof Error ? err.message : "Erro desconhecido",
          });
        }
      }

      logger.info("Batch evaluation completed", {
        total: evaluationsData.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      res.json({ results });
    } catch (error) {
      logger.error("Error in batch evaluation", error as Error, {
        userId: req.userId,
      });
      res.status(500).json({ message: "Erro ao processar avaliações em lote" });
    }
  });

  // Analyze patient data and generate recommendation
  app.post("/api/analyze", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate request body
      const validationResult = patientEvaluationSchema.safeParse(req.body);
      if (!validationResult.success) {
        await AuditLogger.log({
          userId: req.userId,
          action: "create",
          entityType: "evaluations",
          req,
          success: false,
          errorMessage: "Dados inválidos",
        });
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }

      const evaluationData = validationResult.data;
      const userId = req.userId;

      // Create evaluation in storage
      const storedEvaluation = await storage.createEvaluation(evaluationData, userId);

      // Get patient ID if available
      const patient = await storage.getPatientByName(evaluationData.patientName);
      const patientId = patient?.id;

      // Generate recommendation using AI
      const recommendation = await generateClinicalRecommendation(evaluationData);

      // Update evaluation with recommendation
      const updatedEvaluation = await storage.updateEvaluationRecommendation(
        storedEvaluation.id,
        recommendation
      );

      if (!updatedEvaluation) {
        throw new Error("Failed to update evaluation");
      }

      // Log the evaluation creation
      await AuditLogger.logEvaluationCreate(userId, patientId || 0, storedEvaluation.id, req);

      // Check for critical glucose values
      const criticalAlerts = checkCriticalGlucose(evaluationData.glucoseReadings);
      if (criticalAlerts.length > 0 && patientId) {
        await NotificationService.notifyCriticalGlucose(
          patientId,
          userId,
          storedEvaluation.id,
          criticalAlerts
        );
      }

      // Notify about recommendation
      if (patientId) {
        await NotificationService.notifyRecommendationReady(
          patientId,
          userId,
          storedEvaluation.id,
          recommendation.urgencyLevel
        );
      }

      logger.info("Evaluation created successfully", {
        evaluationId: storedEvaluation.id,
        patientName: evaluationData.patientName,
        userId,
      });

      res.json({
        evaluation: updatedEvaluation,
        recommendation,
      });
    } catch (error) {
      logger.error("Error analyzing patient data", error as Error, {
        userId: req.userId,
      });
      await AuditLogger.log({
        userId: req.userId,
        action: "create",
        entityType: "evaluations",
        req,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      });
      const message = error instanceof Error ? error.message : "Erro ao analisar dados";
      res.status(500).json({ message });
    }
  });

  return httpServer;
}
