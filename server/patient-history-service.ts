import { db } from "./db";
import {
  patientMedicalHistory,
  type InsertPatientMedicalHistory,
  type PatientMedicalHistory
} from "@shared/models/auth";
import { eq } from "drizzle-orm";

export class PatientHistoryService {
  static async getOrCreateHistory(patientId: number): Promise<PatientMedicalHistory> {
    const [existing] = await db
      .select()
      .from(patientMedicalHistory)
      .where(eq(patientMedicalHistory.patientId, patientId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [newHistory] = await db
      .insert(patientMedicalHistory)
      .values({
        patientId,
        preExistingConditions: [],
        allergies: [],
        currentMedications: [],
      })
      .returning();

    return newHistory;
  }

  static async updateHistory(
    patientId: number,
    updates: Partial<InsertPatientMedicalHistory>
  ): Promise<PatientMedicalHistory> {
    const [updated] = await db
      .update(patientMedicalHistory)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(patientMedicalHistory.patientId, patientId))
      .returning();

    return updated;
  }

  static async getHistory(patientId: number): Promise<PatientMedicalHistory | null> {
    const [history] = await db
      .select()
      .from(patientMedicalHistory)
      .where(eq(patientMedicalHistory.patientId, patientId))
      .limit(1);

    return history || null;
  }

  static async calculateGestationalAge(patientId: number): Promise<{ weeks: number; days: number } | null> {
    const history = await this.getHistory(patientId);

    if (!history?.pregnancyDum) {
      return null;
    }

    const dum = new Date(history.pregnancyDum);
    const today = new Date();
    const diffTime = today.getTime() - dum.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    return { weeks, days };
  }

  static async getLatestWeight(patientId: number): Promise<number | null> {
    const history = await this.getHistory(patientId);
    return history?.prePregnancyWeight || null;
  }

  static async getDietAdherence(patientId: number): Promise<"boa" | "regular" | "ruim"> {
    return "boa";
  }

  static async getBMI(patientId: number): Promise<number | null> {
    const history = await this.getHistory(patientId);

    if (!history?.prePregnancyWeight || !history?.height) {
      return null;
    }

    const heightInMeters = history.height / 100;
    return history.prePregnancyWeight / (heightInMeters * heightInMeters);
  }

  static async isHighRisk(patientId: number): Promise<boolean> {
    const history = await this.getHistory(patientId);

    if (!history) {
      return false;
    }

    const bmi = await this.getBMI(patientId);
    if (bmi && (bmi < 18.5 || bmi > 30)) {
      return true;
    }

    if (history.previousCesareans && history.previousCesareans >= 2) {
      return true;
    }

    if (history.diabetesType === "type1" || history.diabetesType === "type2") {
      return true;
    }

    const conditions = (history.preExistingConditions as any[]) || [];
    const highRiskConditions = [
      "hipertensão",
      "doença_renal",
      "doença_cardíaca",
      "síndrome_antifosfolípide"
    ];

    return conditions.some(c =>
      typeof c === "string" && highRiskConditions.includes(c.toLowerCase())
    );
  }
}
