import type { Express, RequestHandler, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateClinicalRecommendation } from "./openai";
import { patientEvaluationSchema, type Patient } from "@shared/schema";
import { z } from "zod";
import { getSession } from "./replit_integrations/auth";

// Extended request types
interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface PatientAuthenticatedRequest extends Request {
  patient?: Patient;
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
        return res.status(403).json({ message: "Acesso não autorizado para este perfil" });
      }
      
      next();
    } catch (error) {
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
  role: z.enum(["doctor", "coordinator"]).default("doctor"),
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
      })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar médicos" });
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
      
      (req.session as any).userId = user.id;
      (req.session as any).userEmail = user.email;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({
          message: "Cadastro realizado com sucesso",
          user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
        });
      });
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
      
      (req.session as any).userId = user.id;
      (req.session as any).userEmail = user.email;
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Erro ao salvar sessão" });
        }
        res.json({
          message: "Login realizado com sucesso",
          user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
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
          role: user.role || "doctor",
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar dados do usuário" });
    }
  });

  // ========== Healthcare Professional Routes (Doctors/Coordinators) ==========

  // Doctor: Get their assigned patients
  app.get("/api/doctor/patients", isAuthenticated, requireRole("doctor", "coordinator"), async (req: AuthenticatedRequest, res) => {
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
  app.post("/api/doctor/patients/:patientId/assign", isAuthenticated, requireRole("doctor", "coordinator"), async (req: AuthenticatedRequest, res) => {
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
  app.get("/api/doctor/evaluations", isAuthenticated, requireRole("doctor", "coordinator"), async (req: AuthenticatedRequest, res) => {
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
      
      // Doctors see evaluations for their patients
      const evaluations = await storage.getEvaluationsForDoctor(userId);
      res.json(evaluations);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });

  // Doctor: Get specific patient's evaluations
  app.get("/api/doctor/patients/:patientId/evaluations", isAuthenticated, requireRole("doctor", "coordinator"), async (req: AuthenticatedRequest, res) => {
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
      const allUsers = await storage.getUsersByRole("doctor");
      const coordinators = await storage.getUsersByRole("coordinator");
      res.json([...allUsers, ...coordinators].map(u => ({
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
      
      if (!["doctor", "coordinator"].includes(role)) {
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
          const storedEvaluation = await storage.createEvaluation(evaluationData, userId);
          const recommendation = await generateClinicalRecommendation(evaluationData);
          const updatedEvaluation = await storage.updateEvaluationRecommendation(
            storedEvaluation.id,
            recommendation
          );
          
          results.push({
            patientName: evaluationData.patientName,
            success: true,
            evaluation: updatedEvaluation,
          });
        } catch (err) {
          results.push({
            patientName: data.patientName || "Desconhecido",
            success: false,
            error: err instanceof Error ? err.message : "Erro desconhecido",
          });
        }
      }
      
      res.json({ results });
    } catch (error) {
      console.error("Error in batch evaluation:", error);
      res.status(500).json({ message: "Erro ao processar avaliações em lote" });
    }
  });

  // Analyze patient data and generate recommendation
  app.post("/api/analyze", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate request body
      const validationResult = patientEvaluationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validationResult.error.errors,
        });
      }

      const evaluationData = validationResult.data;
      const userId = req.userId;

      // Create evaluation in storage
      const storedEvaluation = await storage.createEvaluation(evaluationData, userId);

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

      res.json({
        evaluation: updatedEvaluation,
        recommendation,
      });
    } catch (error) {
      console.error("Error analyzing patient data:", error);
      const message = error instanceof Error ? error.message : "Erro ao analisar dados";
      res.status(500).json({ message });
    }
  });

  return httpServer;
}
