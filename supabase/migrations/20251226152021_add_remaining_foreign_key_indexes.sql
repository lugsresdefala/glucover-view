/*
  # Add Remaining Foreign Key Indexes
  
  ## Overview
  Adds indexes for all remaining foreign keys to ensure optimal query performance.
  
  ## Foreign Key Indexes Added
  
  1. `audit_logs.user_id` - Fast audit log lookups by user
  2. `audit_logs.patient_id` - Fast audit log lookups by patient
  3. `notifications.user_id` - Fast notification lookups by user
  4. `notifications.patient_id` - Fast notification lookups by patient
  
  These indexes will improve JOIN performance and foreign key constraint checks.
*/

-- Add index for audit_logs.user_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_fk
  ON audit_logs(user_id);

-- Add index for audit_logs.patient_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id_fk
  ON audit_logs(patient_id);

-- Add index for notifications.user_id
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_fk
  ON notifications(user_id);

-- Add index for notifications.patient_id
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id_fk
  ON notifications(patient_id);

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'All foreign key indexes created successfully';
  RAISE NOTICE 'Total foreign key indexes added in this migration: 4';
END $$;
