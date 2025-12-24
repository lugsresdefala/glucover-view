/*
  # Create Initial Schema for Diabetes Monitoring System

  ## Overview
  This migration creates the foundational database schema for a gestational diabetes monitoring system that tracks patient evaluations, glucose readings, and insulin management.

  ## 1. New Tables
  
  ### `sessions`
  Server-managed session storage for authentication:
  - `sid` (varchar, PK) - Session identifier
  - `sess` (jsonb) - Session data
  - `expire` (timestamp) - Expiration timestamp
  - Index on expire for efficient cleanup

  ### `users`
  Healthcare professionals (doctors, nurses, nutritionists, coordinators):
  - `id` (varchar, PK, UUID) - Auto-generated unique identifier
  - `email` (varchar, unique) - Professional's email
  - `password_hash` (text) - Bcrypt hashed password
  - `first_name` (varchar) - First name
  - `last_name` (varchar) - Last name
  - `role` (varchar) - Role: medico, enfermeira, nutricionista, admin, coordinator
  - `created_at` (timestamp) - Account creation timestamp
  - `updated_at` (timestamp) - Last update timestamp

  ### `patients`
  Patient accounts with personal information:
  - `id` (serial, PK) - Auto-incrementing patient ID
  - `email` (varchar, unique) - Patient's email
  - `password_hash` (text) - Bcrypt hashed password
  - `name` (text) - Full name
  - `phone` (varchar) - Contact phone
  - `date_of_birth` (timestamp) - Birth date
  - `created_at` (timestamp) - Account creation timestamp
  - `updated_at` (timestamp) - Last update timestamp

  ### `doctor_patients`
  Links healthcare professionals to their patients:
  - `id` (serial, PK) - Relationship ID
  - `doctor_id` (varchar, FK) - References users.id
  - `patient_id` (integer, FK) - References patients.id
  - `assigned_at` (timestamp) - Assignment timestamp

  ### `evaluations`
  Clinical evaluations with glucose monitoring and insulin data:
  - `id` (serial, PK) - Evaluation ID
  - `user_id` (varchar, FK) - Healthcare professional who created it
  - `patient_id` (integer, FK) - Patient being evaluated
  - `patient_name` (text) - Patient name at time of evaluation
  - `weight` (real) - Patient weight in kg
  - `gestational_weeks` (integer) - Weeks of gestation
  - `gestational_days` (integer) - Additional days (0-6)
  - `uses_insulin` (boolean) - Whether patient uses insulin
  - `insulin_regimens` (jsonb) - Array of insulin regimen objects
  - `diet_adherence` (text) - Diet compliance: boa, regular, ruim
  - `glucose_readings` (jsonb) - Array of daily glucose measurements
  - `abdominal_circumference` (real) - Fetal abdominal circumference
  - `abdominal_circumference_percentile` (real) - Percentile (0-100)
  - `recommendation` (jsonb) - AI-generated clinical recommendation
  - `created_at` (timestamp) - Evaluation timestamp

  ## 2. Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Patients can only access their own evaluations
  - Healthcare professionals can access their assigned patients' data

  ## 3. Important Notes
  - Password fields store bcrypt hashes, never plain text
  - JSONB fields allow flexible storage of complex medical data
  - Foreign key constraints ensure referential integrity
  - Timestamps track data creation and modification
*/

-- Enable UUID extension for generating user IDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

-- Users table (healthcare professionals)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR,
  role VARCHAR(20) NOT NULL DEFAULT 'medico',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone VARCHAR(20),
  date_of_birth TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Doctor-patient relationships
CREATE TABLE IF NOT EXISTS doctor_patients (
  id SERIAL PRIMARY KEY,
  doctor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT now()
);

-- Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  weight REAL NOT NULL,
  gestational_weeks INTEGER NOT NULL,
  gestational_days INTEGER NOT NULL,
  uses_insulin BOOLEAN NOT NULL,
  insulin_regimens JSONB,
  diet_adherence TEXT NOT NULL,
  glucose_readings JSONB NOT NULL,
  abdominal_circumference REAL,
  abdominal_circumference_percentile REAL,
  recommendation JSONB,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- RLS Policies for patients table
CREATE POLICY "Patients can view own profile"
  ON patients FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Patients can update own profile"
  ON patients FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- RLS Policies for doctor_patients table
CREATE POLICY "Healthcare professionals can view their assignments"
  ON doctor_patients FOR SELECT
  TO authenticated
  USING (auth.uid()::text = doctor_id);

CREATE POLICY "Healthcare professionals can create assignments"
  ON doctor_patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = doctor_id);

CREATE POLICY "Patients can view their healthcare professionals"
  ON doctor_patients FOR SELECT
  TO authenticated
  USING (auth.uid()::text = patient_id::text);

-- RLS Policies for evaluations table
CREATE POLICY "Healthcare professionals can view evaluations they created"
  ON evaluations FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Healthcare professionals can create evaluations"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Patients can view their own evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (auth.uid()::text = patient_id::text);
