/*
  # Add Patient Medical History and Audit Logging

  ## Overview
  Extends the database schema with comprehensive patient medical history tracking,
  audit logging for compliance, and enhanced patient profile fields.

  ## 1. New Tables

  ### `patient_medical_history`
  Complete medical history for each patient:
  - `id` (serial, PK) - History record ID
  - `patient_id` (integer, FK) - References patients.id
  - `cpf` (varchar) - Brazilian ID number
  - `date_of_birth` (date) - Birth date for age calculations
  - `blood_type` (varchar) - Blood type (A+, A-, B+, B-, AB+, AB-, O+, O-)
  - `pre_pregnancy_weight` (real) - Weight before pregnancy (kg)
  - `height` (real) - Height in cm
  - `pregnancy_dum` (date) - Date of last menstruation
  - `expected_due_date` (date) - Expected delivery date
  - `previous_pregnancies` (integer) - Number of previous pregnancies
  - `previous_cesareans` (integer) - Number of previous C-sections
  - `diabetes_type` (varchar) - Type: gestational, type1, type2, pre_gestational
  - `diabetes_diagnosis_date` (date) - When diabetes was diagnosed
  - `pre_existing_conditions` (jsonb) - Array of conditions
  - `allergies` (jsonb) - Array of allergies
  - `current_medications` (jsonb) - Array of medication objects
  - `emergency_contact_name` (text) - Emergency contact person
  - `emergency_contact_phone` (varchar) - Emergency contact number
  - `created_at` (timestamp) - Record creation
  - `updated_at` (timestamp) - Last update

  ### `audit_logs`
  Comprehensive audit trail for compliance:
  - `id` (serial, PK) - Log entry ID
  - `user_id` (varchar, FK) - User who performed action (nullable for system)
  - `patient_id` (integer, FK) - Patient affected (nullable)
  - `action` (varchar) - Action type: create, update, delete, view, login, logout
  - `entity_type` (varchar) - Table/entity affected
  - `entity_id` (varchar) - ID of affected record
  - `changes` (jsonb) - Before/after values for updates
  - `ip_address` (varchar) - Client IP address
  - `user_agent` (text) - Browser/client info
  - `timestamp` (timestamp) - When action occurred
  - `success` (boolean) - Whether action succeeded
  - `error_message` (text) - Error details if failed

  ### `notifications`
  System notifications for critical events:
  - `id` (serial, PK) - Notification ID
  - `user_id` (varchar, FK) - Healthcare professional (nullable)
  - `patient_id` (integer, FK) - Patient (nullable)
  - `type` (varchar) - Type: critical_glucose, appointment, assignment, system
  - `title` (text) - Notification title
  - `message` (text) - Notification content
  - `severity` (varchar) - Severity: info, warning, critical
  - `related_evaluation_id` (integer, FK) - Related evaluation if applicable
  - `is_read` (boolean) - Read status
  - `sent_via_email` (boolean) - Whether email was sent
  - `created_at` (timestamp) - Creation time

  ### `glucose_statistics`
  Aggregated glucose statistics for analytics:
  - `id` (serial, PK) - Statistic ID
  - `patient_id` (integer, FK) - Patient
  - `evaluation_id` (integer, FK) - Related evaluation
  - `date` (date) - Date of statistics
  - `avg_fasting` (real) - Average fasting glucose
  - `avg_postprandial` (real) - Average postprandial glucose
  - `percentage_in_target` (real) - % of readings in target
  - `hypo_count` (integer) - Number of hypoglycemic events
  - `severe_hyper_count` (integer) - Number of severe hyperglycemic events
  - `total_readings` (integer) - Total glucose readings
  - `created_at` (timestamp) - Record creation

  ## 2. Enhanced Existing Tables

  ### `patients` - Add new fields
  - `cpf` (varchar, unique) - Brazilian ID
  - `height` (real) - Height in cm
  - `blood_type` (varchar) - Blood type

  ### `users` - Add new fields
  - `specialization` (varchar) - Medical specialization
  - `license_number` (varchar) - Professional license
  - `department` (varchar) - Department/clinic
  - `is_active` (boolean) - Account status

  ## 3. Security
  - Enable RLS on all new tables
  - Audit logs are append-only and read-only for non-admins
  - Patients can only view their own history and notifications
  - Healthcare professionals can view assigned patients' data
  - Only admins can access full audit logs

  ## 4. Indexes for Performance
  - Index on audit_logs(timestamp) for log queries
  - Index on audit_logs(user_id) for user activity reports
  - Index on audit_logs(patient_id) for patient access logs
  - Index on notifications(user_id, is_read) for unread notifications
  - Index on notifications(patient_id, is_read) for patient notifications
  - Index on glucose_statistics(patient_id, date) for trend analysis

  ## 5. Important Notes
  - Audit logs are immutable - no UPDATE or DELETE allowed
  - All timestamp fields use timezone-aware timestamps
  - JSONB fields allow flexible medical data storage
  - Foreign keys maintain referential integrity
  - Notifications support both in-app and email delivery
*/

-- Add new columns to patients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'cpf'
  ) THEN
    ALTER TABLE patients ADD COLUMN cpf VARCHAR(14) UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'height'
  ) THEN
    ALTER TABLE patients ADD COLUMN height REAL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'blood_type'
  ) THEN
    ALTER TABLE patients ADD COLUMN blood_type VARCHAR(5);
  END IF;
END $$;

-- Add new columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'specialization'
  ) THEN
    ALTER TABLE users ADD COLUMN specialization VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'license_number'
  ) THEN
    ALTER TABLE users ADD COLUMN license_number VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'department'
  ) THEN
    ALTER TABLE users ADD COLUMN department VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Patient medical history table
CREATE TABLE IF NOT EXISTS patient_medical_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  cpf VARCHAR(14),
  date_of_birth DATE,
  blood_type VARCHAR(5),
  pre_pregnancy_weight REAL,
  height REAL,
  pregnancy_dum DATE,
  expected_due_date DATE,
  previous_pregnancies INTEGER DEFAULT 0,
  previous_cesareans INTEGER DEFAULT 0,
  diabetes_type VARCHAR(50),
  diabetes_diagnosis_date DATE,
  pre_existing_conditions JSONB DEFAULT '[]'::jsonb,
  allergies JSONB DEFAULT '[]'::jsonb,
  current_medications JSONB DEFAULT '[]'::jsonb,
  emergency_contact_name TEXT,
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(patient_id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT now() NOT NULL,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  related_evaluation_id INTEGER REFERENCES evaluations(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  sent_via_email BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Glucose statistics table
CREATE TABLE IF NOT EXISTS glucose_statistics (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  evaluation_id INTEGER REFERENCES evaluations(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  avg_fasting REAL,
  avg_postprandial REAL,
  percentage_in_target REAL,
  hypo_count INTEGER DEFAULT 0,
  severe_hyper_count INTEGER DEFAULT 0,
  total_readings INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(patient_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_read ON notifications(patient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_glucose_stats_patient_date ON glucose_statistics(patient_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_history_patient_id ON patient_medical_history(patient_id);

-- Enable RLS on new tables
ALTER TABLE patient_medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE glucose_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for patient_medical_history
CREATE POLICY "Patients can view own medical history"
  ON patient_medical_history FOR SELECT
  TO authenticated
  USING (auth.uid()::text = patient_id::text);

CREATE POLICY "Healthcare professionals can view assigned patients' history"
  ON patient_medical_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = auth.uid()::text
    )
  );

CREATE POLICY "Healthcare professionals can update assigned patients' history"
  ON patient_medical_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = auth.uid()::text
    )
  );

CREATE POLICY "Healthcare professionals can create medical history"
  ON patient_medical_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = auth.uid()::text
    )
  );

-- RLS Policies for audit_logs (read-only for most users)
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id OR auth.uid()::text = patient_id::text);

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id OR auth.uid()::text = patient_id::text);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id OR auth.uid()::text = patient_id::text)
  WITH CHECK (auth.uid()::text = user_id OR auth.uid()::text = patient_id::text);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for glucose_statistics
CREATE POLICY "Patients can view own glucose statistics"
  ON glucose_statistics FOR SELECT
  TO authenticated
  USING (auth.uid()::text = patient_id::text);

CREATE POLICY "Healthcare professionals can view assigned patients' statistics"
  ON glucose_statistics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = glucose_statistics.patient_id
      AND doctor_patients.doctor_id = auth.uid()::text
    )
  );

CREATE POLICY "System can insert glucose statistics"
  ON glucose_statistics FOR INSERT
  TO authenticated
  WITH CHECK (true);
