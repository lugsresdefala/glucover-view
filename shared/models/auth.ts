import { sql, relations } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, serial, text } from "drizzle-orm/pg-core";

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

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
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

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;
export type DoctorPatient = typeof doctorPatients.$inferSelect;
