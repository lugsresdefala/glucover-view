/*
  # Add Diabetes Type Column to Evaluations
  
  ## Overview
  Adds the diabetes_type field to track the type of diabetes for each evaluation.
  
  ## 1. Schema Changes
  
  ### `evaluations` table - Add new column
  - `diabetes_type` (text) - Type of diabetes: DMG (gestational), DM1 (type 1), DM2 (type 2)
  - Default value: 'DMG' (Diabetes Mellitus Gestacional)
  - Placed after patient_name to maintain logical grouping
  
  ## 2. Important Notes
  - Uses IF NOT EXISTS pattern to safely add column
  - Default value ensures existing records have valid data
  - Column is nullable to allow flexibility but has a default
*/

-- Add diabetes_type column to evaluations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evaluations' AND column_name = 'diabetes_type'
  ) THEN
    ALTER TABLE evaluations ADD COLUMN diabetes_type TEXT DEFAULT 'DMG';
  END IF;
END $$;
