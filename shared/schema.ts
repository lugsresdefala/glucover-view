import { pgTable, text, serial, integer, real, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Re-export auth models
export * from "./models/auth";

// Import tables from auth for relations
import { users, patients } from "./models/auth";

// Gestational age source types
export const gestationalAgeSources = ["explicit", "calculated", "propagated"] as const;
export type GestationalAgeSource = typeof gestationalAgeSources[number];

// Evaluation status types
export const evaluationStatuses = ["active", "resolved"] as const;
export type EvaluationStatus = typeof evaluationStatuses[number];

// Evaluations table - now links to patients
export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  patientId: integer("patient_id").references(() => patients.id),
  patientName: text("patient_name").notNull(),
  diabetesType: text("diabetes_type").default("DMG"),
  weight: real("weight"),
  gestationalWeeks: integer("gestational_weeks").notNull(),
  gestationalDays: integer("gestational_days").notNull(),
  gestationalAgeSource: text("gestational_age_source").default("explicit"),
  usesInsulin: boolean("uses_insulin").notNull(),
  insulinRegimens: jsonb("insulin_regimens"),
  dietAdherence: text("diet_adherence").notNull(),
  glucoseReadings: jsonb("glucose_readings").notNull(),
  abdominalCircumference: real("abdominal_circumference"),
  abdominalCircumferencePercentile: real("abdominal_circumference_percentile"),
  recommendation: jsonb("recommendation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Automatic resolution tracking: "resolved" when gestationalWeeks >= 40
  status: text("status").default("active").notNull(),
});

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  user: one(users, {
    fields: [evaluations.userId],
    references: [users.id],
  }),
  patient: one(patients, {
    fields: [evaluations.patientId],
    references: [patients.id],
  }),
}));

// Insert schema for evaluations database record
export const insertEvaluationDbSchema = createInsertSchema(evaluations).omit({
  id: true,
  createdAt: true,
});

// Types from Drizzle
export type EvaluationRecord = typeof evaluations.$inferSelect;
export type InsertEvaluationRecord = z.infer<typeof insertEvaluationDbSchema>;

// ========== Zod Schemas for Validation ==========

// Glucose reading for a specific time of day
// Sem insulina: jejum, posCafe1h, posAlmoco1h, posJantar1h (4 medidas)
// Com insulina: adiciona preAlmoco, preJantar, madrugada (7 medidas total)
export const glucoseReadingSchema = z.object({
  jejum: z.number().min(0).max(500).optional(),
  posCafe1h: z.number().min(0).max(500).optional(),
  preAlmoco: z.number().min(0).max(500).optional(),
  posAlmoco1h: z.number().min(0).max(500).optional(),
  preJantar: z.number().min(0).max(500).optional(),
  posJantar1h: z.number().min(0).max(500).optional(),
  madrugada: z.number().min(0).max(500).optional(),
  // Data da medição para detecção de gaps cronológicos
  measurementDate: z.string().optional(), // ISO date string (YYYY-MM-DD)
  gestationalAge: z.number().optional(),  // Idade gestacional em semanas decimais
}).passthrough();

export type GlucoseReading = z.infer<typeof glucoseReadingSchema>;

// Check if a glucose reading has at least one valid value
export function hasValidGlucoseValue(reading: GlucoseReading): boolean {
  return Object.values(reading).some((v) => typeof v === "number" && v > 0);
}

// Filter out empty readings
export function filterValidReadings(readings: GlucoseReading[]): GlucoseReading[] {
  return readings.filter(hasValidGlucoseValue);
}

// Insulin types available
export const insulinTypes = [
  "NPH",
  "Regular",
  "Lispro",
  "Asparte",
  "Glulisina",
  "Glargina",
  "Detemir",
  "Degludeca",
] as const;

export type InsulinType = typeof insulinTypes[number];

// Insulin regimen
export const insulinRegimenSchema = z.object({
  type: z.enum(insulinTypes),
  doseManhaUI: z.number().min(0).optional(),
  doseAlmocoUI: z.number().min(0).optional(),
  doseJantarUI: z.number().min(0).optional(),
  doseDormirUI: z.number().min(0).optional(),
});

export type InsulinRegimen = z.infer<typeof insulinRegimenSchema>;

// Patient evaluation input
export const diabetesTypes = ["DMG", "DM1", "DM2"] as const;
export type DiabetesType = typeof diabetesTypes[number];

export const patientEvaluationSchema = z.object({
  patientName: z.string().min(1, "Nome da paciente é obrigatório"),
  diabetesType: z.enum(diabetesTypes).default("DMG"),
  weight: z.number().min(30).max(200, "Peso deve estar entre 30 e 200 kg").nullable().optional(),
  gestationalWeeks: z.number().min(0).max(42, "Semanas devem estar entre 0 e 42"),
  gestationalDays: z.number().min(0).max(6, "Dias devem estar entre 0 e 6"),
  gestationalAgeSource: z.enum(gestationalAgeSources).default("explicit").optional(),
  usesInsulin: z.boolean(),
  insulinRegimens: z.array(insulinRegimenSchema).optional(),
  dietAdherence: z.enum(["boa", "regular", "ruim"]),
  glucoseReadings: z.array(glucoseReadingSchema),
  abdominalCircumference: z.number().min(0).max(500).optional(),
  abdominalCircumferencePercentile: z.number().min(0).max(100).optional(),
});

export type PatientEvaluation = z.infer<typeof patientEvaluationSchema>;

// Insert schema for new evaluation (Zod validation)
export const insertEvaluationSchema = patientEvaluationSchema;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;

// Stored evaluation with ID and recommendation
export interface StoredEvaluation extends PatientEvaluation {
  id: number;
  createdAt: string;
  userId?: string;
  recommendation?: ClinicalRecommendation;
  status: EvaluationStatus;  // "active" or "resolved" (auto-set to resolved when gestationalWeeks >= 40)
}

// Clinical recommendation generated by AI
export interface ClinicalRecommendation {
  analysis: string;
  mainRecommendation: string;
  justification: string;
  nextSteps: string[];
  urgencyLevel: "info" | "warning" | "critical";
  guidelineReferences: string[];
  // Data quality indicators
  chronologyWarning?: string;  // Aviso sobre gaps nos dados ou dados sem datas
  dateRange?: { start: string; end: string };  // Intervalo de datas analisado
  totalDaysAnalyzed?: number;  // Número de dias incluídos na análise
}

// API response types
export interface AnalyzeResponse {
  evaluation: StoredEvaluation;
  recommendation: ClinicalRecommendation;
}

// Glucose targets according to SBD 2025 / FEBRASGO 2019 / OMS 2025
// Metas glicêmicas para diabetes na gestação
// IMPORTANTE: "max" representa "MENOR QUE" (ex: jejum < 95), não "menor ou igual"
export const glucoseTargets = {
  jejum: { min: 65, max: 95 },           // Jejum: ≥65 e <95 mg/dL
  prePrandial: { min: 65, max: 100 },    // Pré-prandial (pré-almoço, pré-jantar): ≥65 e <100 mg/dL
  madrugada: { min: 65, max: 100 },      // Madrugada (3h): ≥65 e <100 mg/dL
  posPrandial1h: { min: 65, max: 140 },  // 1h pós-prandial: ≥65 e <140 mg/dL
} as const;

// Critical thresholds for alerts
export const criticalGlucoseThresholds = {
  hypo: 65,          // Abaixo de 65 mg/dL é hipoglicemia
  severeHyper: 200,  // Acima de 200 mg/dL é hiperglicemia severa
} as const;

// Monitoring frequency according to guidelines
// Sem insulina: 4 medidas (jejum, 1h pós-café, 1h pós-almoço, 1h pós-jantar)
// Com insulina: 7 medidas (adiciona pré-almoço, pré-jantar, madrugada 3h)
export const monitoringFrequency = {
  initialFollowUp: 4,    // 4 medidas/dia no início do seguimento (sem insulina)
  onInsulin: 7,          // 7 medidas/dia quando em uso de insulina
} as const;

// Helper to check if glucose is within target
export type GlucoseTargetType = "jejum" | "prePrandial" | "madrugada" | "posPrandial1h";

export function isGlucoseWithinTarget(value: number, type: GlucoseTargetType): boolean {
  const target = glucoseTargets[type];
  // SBD 2025: meta é "< valor" não "<= valor" (ex: jejum < 95, não <= 95)
  return value >= target.min && value < target.max;
}

// Check for critical glucose values
export interface CriticalAlert {
  type: "hypoglycemia" | "severe_hyperglycemia";
  value: number;
  timepoint: string;
  day: number;
}

// Campos que são leituras de glicose (não incluir measurementDate, gestationalAge, etc.)
const glucoseFields = ["jejum", "posCafe1h", "preAlmoco", "posAlmoco1h", "preJantar", "posJantar1h", "madrugada", "posAlmoco2h", "posJantar2h"] as const;

export function checkCriticalGlucose(readings: GlucoseReading[]): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const timepointLabels: Record<string, string> = {
    jejum: "Jejum",
    posCafe1h: "1h pós-café",
    preAlmoco: "Pré-almoço",
    posAlmoco1h: "1h pós-almoço",
    posAlmoco2h: "2h pós-almoço", // legado - mantido para compatibilidade
    preJantar: "Pré-jantar",
    posJantar1h: "1h pós-jantar",
    posJantar2h: "2h pós-jantar", // legado - mantido para compatibilidade
    madrugada: "Madrugada (3h)",
  };

  readings.forEach((reading, dayIndex) => {
    // Iterar APENAS sobre campos de glicose, não sobre gestationalAge, measurementDate, etc.
    for (const key of glucoseFields) {
      const value = reading[key as keyof GlucoseReading];
      if (typeof value === "number" && value > 0) {
        if (value < criticalGlucoseThresholds.hypo) {
          alerts.push({
            type: "hypoglycemia",
            value,
            timepoint: timepointLabels[key] || key,
            day: dayIndex + 1,
          });
        } else if (value > criticalGlucoseThresholds.severeHyper) {
          alerts.push({
            type: "severe_hyperglycemia",
            value,
            timepoint: timepointLabels[key] || key,
            day: dayIndex + 1,
          });
        }
      }
    }
  });

  return alerts;
}

// Calculate percentage of glucose readings within target
export function calculateGlucosePercentageInTarget(readings: GlucoseReading[]): number {
  let total = 0;
  let inTarget = 0;

  readings.forEach((reading) => {
    if (reading.jejum !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.jejum, "jejum")) inTarget++;
    }
    if (reading.posCafe1h !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.posCafe1h, "posPrandial1h")) inTarget++;
    }
    if (reading.preAlmoco !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.preAlmoco, "prePrandial")) inTarget++;
    }
    if (reading.posAlmoco1h !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.posAlmoco1h, "posPrandial1h")) inTarget++;
    }
    if (reading.preJantar !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.preJantar, "prePrandial")) inTarget++;
    }
    if (reading.posJantar1h !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.posJantar1h, "posPrandial1h")) inTarget++;
    }
    if (reading.madrugada !== undefined) {
      total++;
      if (isGlucoseWithinTarget(reading.madrugada, "madrugada")) inTarget++;
    }
  });

  return total > 0 ? Math.round((inTarget / total) * 100) : 0;
}

// Calculate average glucose
export function calculateAverageGlucose(readings: GlucoseReading[]): number {
  let total = 0;
  let count = 0;

  readings.forEach((reading) => {
    Object.values(reading).forEach((value) => {
      if (typeof value === "number") {
        total += value;
        count++;
      }
    });
  });

  return count > 0 ? Math.round(total / count) : 0;
}
