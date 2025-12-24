import { sql, relations } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, serial, text, real, date, boolean, integer } from "drizzle-orm/pg-core";

// Role types for healthcare professionals
// medico = doctor, enfermeira = nurse, nutricionista = nutritionist, admin = system admin
export const userRoles = ["medico", "enfermeira", "nutricionista", "admin", "coordinator"] as const;
export type UserRole = typeof userRoles[number];

// Role display names in Portuguese
export const roleDisplayNames: Record<UserRole, string> = {
  medico: "Médico(a)",
  enfermeira: "Enfermeiro(a)",
  nutricionista: "Nutricionista",
  admin: "Administrador(a)",
  coordinator: "Coordenador(a)",
};

// Session storage table for server-managed login state.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table for healthcare professionals.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name"),
  role: varchar("role", { length: 20 }).notNull().default("medico"),
  specialization: varchar("specialization", { length: 100 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  department: varchar("department", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Patient accounts table - separate from healthcare professionals
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 20 }),
  dateOfBirth: timestamp("date_of_birth"),
  cpf: varchar("cpf", { length: 14 }).unique(),
  height: real("height"),
  bloodType: varchar("blood_type", { length: 5 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Doctor-patient relationship table
export const doctorPatients = pgTable("doctor_patients", {
  id: serial("id").primaryKey(),
  doctorId: varchar("doctor_id").references(() => users.id).notNull(),
  patientId: serial("patient_id").references(() => patients.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  patients: many(doctorPatients),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  doctors: many(doctorPatients),
}));

export const doctorPatientsRelations = relations(doctorPatients, ({ one }) => ({
  doctor: one(users, {
    fields: [doctorPatients.doctorId],
    references: [users.id],
  }),
  patient: one(patients, {
    fields: [doctorPatients.patientId],
    references: [patients.id],
  }),
}));

// Patient medical history table
export const patientMedicalHistory = pgTable("patient_medical_history", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  dateOfBirth: date("date_of_birth"),
  bloodType: varchar("blood_type", { length: 5 }),
  prePregnancyWeight: real("pre_pregnancy_weight"),
  height: real("height"),
  pregnancyDum: date("pregnancy_dum"),
  expectedDueDate: date("expected_due_date"),
  previousPregnancies: integer("previous_pregnancies").default(0),
  previousCesareans: integer("previous_cesareans").default(0),
  diabetesType: varchar("diabetes_type", { length: 50 }),
  diabetesDiagnosisDate: date("diabetes_diagnosis_date"),
  preExistingConditions: jsonb("pre_existing_conditions").default([]),
  allergies: jsonb("allergies").default([]),
  currentMedications: jsonb("current_medications").default([]),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  patientId: integer("patient_id").references(() => patients.id),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }),
  changes: jsonb("changes"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  patientId: integer("patient_id").references(() => patients.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { length: 20 }).default("info"),
  relatedEvaluationId: integer("related_evaluation_id"),
  isRead: boolean("is_read").default(false),
  sentViaEmail: boolean("sent_via_email").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Glucose statistics table
export const glucoseStatistics = pgTable("glucose_statistics", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  evaluationId: integer("evaluation_id"),
  date: date("date").notNull(),
  avgFasting: real("avg_fasting"),
  avgPostprandial: real("avg_postprandial"),
  percentageInTarget: real("percentage_in_target"),
  hypoCount: integer("hypo_count").default(0),
  severeHyperCount: integer("severe_hyper_count").default(0),
  totalReadings: integer("total_readings").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;
export type DoctorPatient = typeof doctorPatients.$inferSelect;
export type PatientMedicalHistory = typeof patientMedicalHistory.$inferSelect;
export type InsertPatientMedicalHistory = typeof patientMedicalHistory.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type GlucoseStatistic = typeof glucoseStatistics.$inferSelect;
export type InsertGlucoseStatistic = typeof glucoseStatistics.$inferInsert;
