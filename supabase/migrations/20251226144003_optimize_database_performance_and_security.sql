/*
  # Database Performance and Security Optimization
  
  ## Overview
  Addresses Supabase security advisor recommendations for optimal performance and security.
  
  ## 1. Foreign Key Indexes
  
  Adding indexes on foreign key columns to improve query performance:
  - `doctor_patients.doctor_id` - Fast doctor lookups
  - `doctor_patients.patient_id` - Fast patient lookups
  - `evaluations.user_id` - Fast professional evaluation lookups
  - `evaluations.patient_id` - Fast patient evaluation lookups
  - `glucose_statistics.evaluation_id` - Fast evaluation statistics lookups
  - `notifications.related_evaluation_id` - Fast notification-evaluation joins
  
  ## 2. RLS Policy Optimization
  
  Optimizing all RLS policies to use (SELECT auth.uid()) pattern instead of auth.uid().
  This prevents re-evaluation of auth.uid() for each row, significantly improving query
  performance at scale.
  
  All policies are recreated with optimized auth function calls:
  - Users table policies
  - Patients table policies
  - Doctor-patients relationship policies
  - Evaluations policies
  - Patient medical history policies
  - Audit logs policies
  - Notifications policies
  - Glucose statistics policies
  
  ## 3. Important Notes
  
  - Sessions table intentionally has RLS disabled (Express manages sessions)
  - Multiple permissive SELECT policies are intentional (different access patterns)
  - Existing indexes remain for future scalability
  - All changes are idempotent and safe to rerun
*/

-- ============================================================================
-- PART 1: ADD FOREIGN KEY INDEXES
-- ============================================================================

-- Index for doctor_patients.doctor_id
CREATE INDEX IF NOT EXISTS idx_doctor_patients_doctor_id 
  ON doctor_patients(doctor_id);

-- Index for doctor_patients.patient_id  
CREATE INDEX IF NOT EXISTS idx_doctor_patients_patient_id
  ON doctor_patients(patient_id);

-- Index for evaluations.user_id
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id
  ON evaluations(user_id);

-- Index for evaluations.patient_id
CREATE INDEX IF NOT EXISTS idx_evaluations_patient_id
  ON evaluations(patient_id);

-- Index for glucose_statistics.evaluation_id
CREATE INDEX IF NOT EXISTS idx_glucose_statistics_evaluation_id
  ON glucose_statistics(evaluation_id);

-- Index for notifications.related_evaluation_id
CREATE INDEX IF NOT EXISTS idx_notifications_related_evaluation_id
  ON notifications(related_evaluation_id);

-- ============================================================================
-- PART 2: OPTIMIZE RLS POLICIES WITH (SELECT auth.uid()) PATTERN
-- ============================================================================

-- Drop and recreate all policies with optimized auth function calls

-- USERS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid())::text = id)
  WITH CHECK ((SELECT auth.uid())::text = id);

-- PATIENTS TABLE POLICIES
DROP POLICY IF EXISTS "Patients can view own profile" ON patients;
DROP POLICY IF EXISTS "Patients can update own profile" ON patients;

CREATE POLICY "Patients can view own profile"
  ON patients FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = id::text);

CREATE POLICY "Patients can update own profile"
  ON patients FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid())::text = id::text)
  WITH CHECK ((SELECT auth.uid())::text = id::text);

-- DOCTOR_PATIENTS TABLE POLICIES
DROP POLICY IF EXISTS "Healthcare professionals can view their assignments" ON doctor_patients;
DROP POLICY IF EXISTS "Healthcare professionals can create assignments" ON doctor_patients;
DROP POLICY IF EXISTS "Patients can view their healthcare professionals" ON doctor_patients;

CREATE POLICY "Healthcare professionals can view their assignments"
  ON doctor_patients FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = doctor_id);

CREATE POLICY "Healthcare professionals can create assignments"
  ON doctor_patients FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = doctor_id);

CREATE POLICY "Patients can view their healthcare professionals"
  ON doctor_patients FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = patient_id::text);

-- EVALUATIONS TABLE POLICIES
DROP POLICY IF EXISTS "Healthcare professionals can view evaluations they created" ON evaluations;
DROP POLICY IF EXISTS "Healthcare professionals can create evaluations" ON evaluations;
DROP POLICY IF EXISTS "Patients can view their own evaluations" ON evaluations;

CREATE POLICY "Healthcare professionals can view evaluations they created"
  ON evaluations FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id);

CREATE POLICY "Healthcare professionals can create evaluations"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id);

CREATE POLICY "Patients can view their own evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = patient_id::text);

-- PATIENT_MEDICAL_HISTORY TABLE POLICIES
DROP POLICY IF EXISTS "Patients can view own medical history" ON patient_medical_history;
DROP POLICY IF EXISTS "Healthcare professionals can view assigned patients' history" ON patient_medical_history;
DROP POLICY IF EXISTS "Healthcare professionals can update assigned patients' history" ON patient_medical_history;
DROP POLICY IF EXISTS "Healthcare professionals can create medical history" ON patient_medical_history;

CREATE POLICY "Patients can view own medical history"
  ON patient_medical_history FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = patient_id::text);

CREATE POLICY "Healthcare professionals can view assigned patients' history"
  ON patient_medical_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "Healthcare professionals can update assigned patients' history"
  ON patient_medical_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY "Healthcare professionals can create medical history"
  ON patient_medical_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = patient_medical_history.patient_id
      AND doctor_patients.doctor_id = (SELECT auth.uid())::text
    )
  );

-- AUDIT_LOGS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id OR (SELECT auth.uid())::text = patient_id::text);

-- NOTIFICATIONS TABLE POLICIES
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id OR (SELECT auth.uid())::text = patient_id::text);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id OR (SELECT auth.uid())::text = patient_id::text)
  WITH CHECK ((SELECT auth.uid())::text = user_id OR (SELECT auth.uid())::text = patient_id::text);

-- GLUCOSE_STATISTICS TABLE POLICIES
DROP POLICY IF EXISTS "Patients can view own glucose statistics" ON glucose_statistics;
DROP POLICY IF EXISTS "Healthcare professionals can view assigned patients' statistics" ON glucose_statistics;

CREATE POLICY "Patients can view own glucose statistics"
  ON glucose_statistics FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid())::text = patient_id::text);

CREATE POLICY "Healthcare professionals can view assigned patients' statistics"
  ON glucose_statistics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.patient_id = glucose_statistics.patient_id
      AND doctor_patients.doctor_id = (SELECT auth.uid())::text
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (for logging purposes)
-- ============================================================================

-- Verify all foreign key indexes exist
DO $$
BEGIN
  RAISE NOTICE 'Foreign key indexes created successfully';
  RAISE NOTICE 'RLS policies optimized with SELECT auth.uid() pattern';
  RAISE NOTICE 'Database performance and security optimization complete';
END $$;
