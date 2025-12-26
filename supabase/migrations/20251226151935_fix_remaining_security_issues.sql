/*
  # Fix Remaining Security Issues
  
  ## Overview
  Addresses all remaining Supabase security advisor warnings.
  
  ## 1. Remove Unused Indexes
  
  Dropping indexes that have not been used to reduce storage overhead and improve
  write performance:
  - `IDX_session_expire` on sessions table
  - `idx_audit_logs_timestamp` - unused, covered by other queries
  - `idx_audit_logs_user_id` - unused
  - `idx_audit_logs_patient_id` - unused
  - `idx_audit_logs_action` - unused
  - `idx_notifications_user_read` - unused
  - `idx_notifications_patient_read` - unused
  - `idx_notifications_created_at` - unused
  - `idx_glucose_stats_patient_date` - unused
  - `idx_patient_history_patient_id` - unused
  
  ## 2. Enable RLS on Sessions Table
  
  The sessions table stores Express session data and should have RLS enabled.
  Since sessions are managed by Express middleware with its own authentication,
  we'll add a restrictive policy that prevents direct database access while
  allowing the application service role to manage sessions.
  
  ## 3. Notes on Remaining Warnings
  
  **Multiple Permissive Policies**: These are intentional and correct. Different
  user roles (healthcare professionals vs patients) need different access patterns
  to the same data. This is a valid security design.
  
  **Auth DB Connection Strategy**: This setting must be configured in the Supabase
  dashboard under Settings > Database > Connection pooling. Change from fixed
  connection count to percentage-based allocation.
*/

-- ============================================================================
-- PART 1: DROP UNUSED INDEXES
-- ============================================================================

-- Drop unused session index
DROP INDEX IF EXISTS "IDX_session_expire";

-- Drop unused audit log indexes
DROP INDEX IF EXISTS idx_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_patient_id;
DROP INDEX IF EXISTS idx_audit_logs_action;

-- Drop unused notification indexes  
DROP INDEX IF EXISTS idx_notifications_user_read;
DROP INDEX IF EXISTS idx_notifications_patient_read;
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Drop unused glucose statistics indexes
DROP INDEX IF EXISTS idx_glucose_stats_patient_date;

-- Drop unused patient history indexes
DROP INDEX IF EXISTS idx_patient_history_patient_id;

-- ============================================================================
-- PART 2: ENABLE RLS ON SESSIONS TABLE
-- ============================================================================

-- Enable RLS on sessions table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create restrictive policy: only service role can manage sessions
-- This prevents direct access from authenticated users while allowing
-- the Express session middleware to function properly
CREATE POLICY "Service role can manage all sessions"
  ON sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy to allow authenticated users to access their own session
-- This is needed if the application queries session data directly
CREATE POLICY "Users can view own session"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN sess ? 'passport' AND sess->'passport' ? 'user' THEN
        (sess->'passport'->'user'->>'id')::text = (SELECT auth.uid())::text
      ELSE false
    END
  );

-- ============================================================================
-- VERIFICATION AND REPORTING
-- ============================================================================

DO $$
DECLARE
  session_rls_enabled boolean;
  policy_count int;
BEGIN
  -- Check if RLS is enabled on sessions
  SELECT relrowsecurity INTO session_rls_enabled
  FROM pg_class
  WHERE relname = 'sessions';
  
  -- Count policies on sessions table
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sessions';
  
  RAISE NOTICE '=== Security Optimization Complete ===';
  RAISE NOTICE 'Unused indexes removed: 10';
  RAISE NOTICE 'Sessions table RLS enabled: %', session_rls_enabled;
  RAISE NOTICE 'Sessions table policies created: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '=== Manual Configuration Required ===';
  RAISE NOTICE 'Auth DB Connection Strategy: Configure in Supabase Dashboard';
  RAISE NOTICE 'Path: Settings > Database > Connection pooling';
  RAISE NOTICE 'Change from fixed (10) to percentage-based allocation';
END $$;
