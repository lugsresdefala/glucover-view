import { db } from "./db";
import { evaluations, patients, doctorPatients, users, type EvaluationRecord, type Patient, type User } from "@shared/schema";
import type {
  PatientEvaluation,
  StoredEvaluation,
  ClinicalRecommendation,
  GlucoseReading,
  InsulinRegimen,
} from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Evaluation operations
  createEvaluation(evaluation: PatientEvaluation, userId?: string, patientId?: number): Promise<StoredEvaluation>;
  upsertEvaluation(evaluation: PatientEvaluation, userId?: string, patientId?: number): Promise<StoredEvaluation>;
  getEvaluation(id: number): Promise<StoredEvaluation | undefined>;
  getEvaluationByPatientName(patientName: string, userId?: string): Promise<StoredEvaluation | undefined>;
  getAllEvaluations(userId?: string): Promise<StoredEvaluation[]>;
  getEvaluationsByPatient(patientId: number): Promise<StoredEvaluation[]>;
  getEvaluationsForDoctor(doctorId: string): Promise<StoredEvaluation[]>;
  updateEvaluationRecommendation(
    id: number,
    recommendation: ClinicalRecommendation
  ): Promise<StoredEvaluation | undefined>;
  deleteEvaluation(id: number, userId?: string): Promise<boolean>;
  deleteEvaluations(ids: number[], userId?: string): Promise<number>;
  deleteAllEvaluations(userId?: string): Promise<number>;
  
  // Patient operations
  createPatient(email: string, password: string, name: string, phone?: string): Promise<Patient>;
  getPatientByEmail(email: string): Promise<Patient | undefined>;
  getPatientById(id: number): Promise<Patient | undefined>;
  getPatientByName(name: string): Promise<Patient | undefined>;
  validatePatientPassword(email: string, password: string): Promise<Patient | null>;
  getAllPatients(): Promise<Patient[]>;
  
  // Doctor-patient relationship operations
  assignPatientToDoctor(doctorId: string, patientId: number): Promise<void>;
  removePatientFromDoctor(doctorId: string, patientId: number): Promise<void>;
  getPatientsForDoctor(doctorId: string): Promise<Patient[]>;
  getDoctorsForPatient(patientId: number): Promise<User[]>;
  
  // User role operations
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllProfessionals(): Promise<User[]>;
  
  // Professional user authentication
  createUser(email: string, password: string, firstName: string, lastName?: string, role?: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  validateUserPassword(email: string, password: string): Promise<User | null>;
  
  // User approval operations
  getPendingApprovalUsers(): Promise<User[]>;
  approveUser(userId: string, approvedByUserId: string): Promise<User | undefined>;
  rejectUser(userId: string): Promise<boolean>;
}

// Transform database record to StoredEvaluation
function toStoredEvaluation(record: EvaluationRecord): StoredEvaluation {
  return {
    id: record.id,
    patientName: record.patientName,
    diabetesType: (record.diabetesType as "DMG" | "DM1" | "DM2") || "DMG",
    weight: record.weight,
    gestationalWeeks: record.gestationalWeeks,
    gestationalDays: record.gestationalDays,
    gestationalAgeSource: (record.gestationalAgeSource as "explicit" | "calculated" | "propagated") || "explicit",
    usesInsulin: record.usesInsulin,
    insulinRegimens: (record.insulinRegimens as InsulinRegimen[] | null) || undefined,
    dietAdherence: record.dietAdherence as "boa" | "regular" | "ruim",
    glucoseReadings: record.glucoseReadings as GlucoseReading[],
    abdominalCircumference: record.abdominalCircumference || undefined,
    abdominalCircumferencePercentile: record.abdominalCircumferencePercentile || undefined,
    recommendation: (record.recommendation as ClinicalRecommendation | null) || undefined,
    userId: record.userId || undefined,
    createdAt: record.createdAt.toISOString(),
    status: (record.status as "active" | "resolved") || "active",
  };
}

// Determine evaluation status based on gestational age
function determineEvaluationStatus(gestationalWeeks: number): "active" | "resolved" {
  return gestationalWeeks >= 40 ? "resolved" : "active";
}

export class DatabaseStorage implements IStorage {
  // Evaluation operations
  async createEvaluation(evaluation: PatientEvaluation, userId?: string, patientId?: number): Promise<StoredEvaluation> {
    // Automatically set status to "resolved" if gestational age >= 40 weeks
    const status = determineEvaluationStatus(evaluation.gestationalWeeks);
    
    const [record] = await db
      .insert(evaluations)
      .values({
        userId: userId || null,
        patientId: patientId || null,
        patientName: evaluation.patientName,
        diabetesType: evaluation.diabetesType || "DMG",
        weight: evaluation.weight,
        gestationalWeeks: evaluation.gestationalWeeks,
        gestationalDays: evaluation.gestationalDays,
        gestationalAgeSource: evaluation.gestationalAgeSource || "explicit",
        usesInsulin: evaluation.usesInsulin,
        insulinRegimens: evaluation.insulinRegimens || null,
        dietAdherence: evaluation.dietAdherence,
        glucoseReadings: evaluation.glucoseReadings,
        abdominalCircumference: evaluation.abdominalCircumference || null,
        abdominalCircumferencePercentile: evaluation.abdominalCircumferencePercentile || null,
        status,
      })
      .returning();

    return toStoredEvaluation(record);
  }

  async getEvaluation(id: number): Promise<StoredEvaluation | undefined> {
    const [record] = await db.select().from(evaluations).where(eq(evaluations.id, id));
    return record ? toStoredEvaluation(record) : undefined;
  }

  async getEvaluationByPatientName(patientName: string, userId?: string): Promise<StoredEvaluation | undefined> {
    const normalizedName = patientName.trim().toUpperCase();
    
    // IMPORTANT: Always require userId to prevent cross-user data leaks
    if (!userId) {
      return undefined;
    }
    
    const records = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.userId, userId))
      .orderBy(desc(evaluations.createdAt));
    
    // Find by normalized name match within the user's evaluations only
    const record = records.find(r => r.patientName.trim().toUpperCase() === normalizedName);
    return record ? toStoredEvaluation(record) : undefined;
  }

  async upsertEvaluation(evaluation: PatientEvaluation, userId?: string, patientId?: number): Promise<StoredEvaluation> {
    // Check if evaluation exists for this patient
    const existing = await this.getEvaluationByPatientName(evaluation.patientName, userId);
    
    if (existing) {
      // Update existing evaluation
      // Automatically set status to "resolved" if gestational age >= 40 weeks
      const status = determineEvaluationStatus(evaluation.gestationalWeeks);
      
      const [record] = await db
        .update(evaluations)
        .set({
          patientId: patientId || null,
          diabetesType: evaluation.diabetesType || "DMG",
          weight: evaluation.weight,
          gestationalWeeks: evaluation.gestationalWeeks,
          gestationalDays: evaluation.gestationalDays,
          gestationalAgeSource: evaluation.gestationalAgeSource || "explicit",
          usesInsulin: evaluation.usesInsulin,
          insulinRegimens: evaluation.insulinRegimens || null,
          dietAdherence: evaluation.dietAdherence,
          glucoseReadings: evaluation.glucoseReadings,
          abdominalCircumference: evaluation.abdominalCircumference || null,
          abdominalCircumferencePercentile: evaluation.abdominalCircumferencePercentile || null,
          recommendation: null, // Clear recommendation so new one is generated
          createdAt: new Date(), // Update timestamp
          status,
        })
        .where(eq(evaluations.id, existing.id))
        .returning();
      
      return toStoredEvaluation(record);
    } else {
      // Create new evaluation
      return this.createEvaluation(evaluation, userId, patientId);
    }
  }

  async getAllEvaluations(userId?: string): Promise<StoredEvaluation[]> {
    if (userId) {
      const records = await db
        .select()
        .from(evaluations)
        .where(eq(evaluations.userId, userId))
        .orderBy(desc(evaluations.createdAt));
      return records.map(toStoredEvaluation);
    }
    
    const records = await db.select().from(evaluations).orderBy(desc(evaluations.createdAt));
    return records.map(toStoredEvaluation);
  }

  async getEvaluationsByPatient(patientId: number): Promise<StoredEvaluation[]> {
    const records = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.patientId, patientId))
      .orderBy(desc(evaluations.createdAt));
    return records.map(toStoredEvaluation);
  }

  async getEvaluationsForDoctor(doctorId: string): Promise<StoredEvaluation[]> {
    // Get patient IDs for this doctor
    const relationships = await db
      .select({ patientId: doctorPatients.patientId })
      .from(doctorPatients)
      .where(eq(doctorPatients.doctorId, doctorId));
    
    if (relationships.length === 0) {
      return [];
    }
    
    const patientIds = relationships.map(r => r.patientId);
    const records = await db
      .select()
      .from(evaluations)
      .where(inArray(evaluations.patientId, patientIds))
      .orderBy(desc(evaluations.createdAt));
    return records.map(toStoredEvaluation);
  }

  async updateEvaluationRecommendation(
    id: number,
    recommendation: ClinicalRecommendation
  ): Promise<StoredEvaluation | undefined> {
    const [record] = await db
      .update(evaluations)
      .set({ recommendation })
      .where(eq(evaluations.id, id))
      .returning();

    return record ? toStoredEvaluation(record) : undefined;
  }

  async deleteEvaluation(id: number, userId?: string): Promise<boolean> {
    if (userId) {
      const result = await db
        .delete(evaluations)
        .where(and(eq(evaluations.id, id), eq(evaluations.userId, userId)))
        .returning();
      return result.length > 0;
    }
    const result = await db.delete(evaluations).where(eq(evaluations.id, id)).returning();
    return result.length > 0;
  }

  async deleteEvaluations(ids: number[], userId?: string): Promise<number> {
    if (ids.length === 0) return 0;
    if (userId) {
      const result = await db
        .delete(evaluations)
        .where(and(inArray(evaluations.id, ids), eq(evaluations.userId, userId)))
        .returning();
      return result.length;
    }
    const result = await db.delete(evaluations).where(inArray(evaluations.id, ids)).returning();
    return result.length;
  }

  async deleteAllEvaluations(userId?: string): Promise<number> {
    if (userId) {
      const result = await db
        .delete(evaluations)
        .where(eq(evaluations.userId, userId))
        .returning();
      return result.length;
    }
    const result = await db.delete(evaluations).returning();
    return result.length;
  }

  // Patient operations
  async createPatient(email: string, password: string, name: string, phone?: string): Promise<Patient> {
    const passwordHash = await bcrypt.hash(password, 10);
    const [patient] = await db
      .insert(patients)
      .values({
        email,
        passwordHash,
        name,
        phone: phone || null,
      })
      .returning();
    return patient;
  }

  async getPatientByEmail(email: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.email, email));
    return patient;
  }

  async getPatientById(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async getPatientByName(name: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.name, name)).limit(1);
    return patient;
  }

  async validatePatientPassword(email: string, password: string): Promise<Patient | null> {
    const patient = await this.getPatientByEmail(email);
    if (!patient) return null;

    const isValid = await bcrypt.compare(password, patient.passwordHash);
    return isValid ? patient : null;
  }

  async getAllPatients(): Promise<Patient[]> {
    return await db.select().from(patients).orderBy(desc(patients.createdAt));
  }

  // Doctor-patient relationship operations
  async assignPatientToDoctor(doctorId: string, patientId: number): Promise<void> {
    // Check if relationship already exists
    const existing = await db
      .select()
      .from(doctorPatients)
      .where(and(eq(doctorPatients.doctorId, doctorId), eq(doctorPatients.patientId, patientId)));
    
    if (existing.length === 0) {
      await db.insert(doctorPatients).values({ doctorId, patientId });
    }
  }

  async removePatientFromDoctor(doctorId: string, patientId: number): Promise<void> {
    await db
      .delete(doctorPatients)
      .where(and(eq(doctorPatients.doctorId, doctorId), eq(doctorPatients.patientId, patientId)));
  }

  async getPatientsForDoctor(doctorId: string): Promise<Patient[]> {
    const relationships = await db
      .select({ patientId: doctorPatients.patientId })
      .from(doctorPatients)
      .where(eq(doctorPatients.doctorId, doctorId));
    
    if (relationships.length === 0) {
      return [];
    }
    
    const patientIds = relationships.map(r => r.patientId);
    return await db
      .select()
      .from(patients)
      .where(inArray(patients.id, patientIds))
      .orderBy(desc(patients.createdAt));
  }

  async getDoctorsForPatient(patientId: number): Promise<User[]> {
    const relationships = await db
      .select({ doctorId: doctorPatients.doctorId })
      .from(doctorPatients)
      .where(eq(doctorPatients.patientId, patientId));
    
    if (relationships.length === 0) {
      return [];
    }
    
    const doctorIds = relationships.map(r => r.doctorId);
    return await db
      .select()
      .from(users)
      .where(inArray(users.id, doctorIds));
  }

  // User role operations
  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async getAllProfessionals(): Promise<User[]> {
    const clinicalRoles = ["medico", "enfermeira", "nutricionista", "coordinator"];
    return await db
      .select()
      .from(users)
      .where(inArray(users.role, clinicalRoles))
      .orderBy(desc(users.createdAt));
  }

  // Professional user authentication
  async createUser(email: string, password: string, firstName: string, lastName?: string, role: string = "medico"): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    // Auto-approve coordinators
    const isApproved = role === "coordinator";
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName,
        lastName: lastName || null,
        role,
        isApproved,
        approvedAt: isApproved ? new Date() : null,
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    // Guard against legacy users without password hash
    if (!user.passwordHash) return null;
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }
  
  // User approval operations
  async getPendingApprovalUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.isApproved, false))
      .orderBy(desc(users.createdAt));
  }
  
  async approveUser(userId: string, approvedByUserId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        isApproved: true,
        approvedBy: approvedByUserId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async rejectUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
