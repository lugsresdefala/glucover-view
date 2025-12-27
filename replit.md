# GluCover - Clinical Decision Support System

## Overview

GluCover is a full-stack clinical decision support application for managing diabetes mellitus in pregnancy (gestational diabetes). It provides healthcare professionals with tools to:

- Import and analyze glucose monitoring data from patients
- Generate AI-powered clinical recommendations based on Brazilian medical guidelines (SBD 2025, FEBRASGO 2019, WHO 2025)
- Track patient evaluations with comprehensive glucose statistics
- Export clinical reports as PDFs
- Manage patient-provider relationships with role-based access control

The application is designed for use in Brazilian healthcare settings, with all clinical content in Portuguese and compliance with local medical standards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript in strict mode
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for clinical/medical theme
- **Build Tool**: Vite for development and production builds
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON API at `/api` prefix
- **Authentication**: Session-based with express-session, stored in PostgreSQL
- **Security**: Helmet.js for headers, CSRF protection, rate limiting on auth endpoints
- **Clinical Engine**: Custom rule-based analysis engine implementing Brazilian diabetes guidelines
- **AI Integration**: Optional OpenAI integration for enhanced recommendations (falls back to deterministic rules)

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` and `shared/models/auth.ts`
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Key Tables**: users (healthcare professionals), patients, evaluations, doctor_patients (relationships), audit_logs, notifications

### Authentication & Authorization
- **Dual Auth Systems**: Separate flows for healthcare professionals and patients
- **Role-Based Access**: Healthcare roles include medico, enfermeira, nutricionista, admin, coordinator
- **Password Hashing**: bcryptjs with cost factor 10
- **Session Security**: HTTP-only cookies, configurable secure flag, SameSite protection

### Build & Deployment
- **Build Script**: `script/build.ts` uses esbuild for server, Vite for client
- **Output**: `dist/` directory with `index.cjs` (server) and `public/` (client assets)
- **Deployment Configs**: Vercel (frontend), Render/Railway/Fly.io (backend)

## External Dependencies

### Database
- **PostgreSQL**: Primary database (Neon, Supabase, or Render PostgreSQL on free tiers)
- **Drizzle ORM**: Type-safe database queries with `drizzle-kit` for migrations

### AI Services
- **OpenAI API** (optional): GPT integration for enhanced clinical recommendations
- Environment variables: `OPENAI_API_KEY`, `OPENAI_BASE_URL`

### Email (Optional)
- **SMTP**: Configurable email service for critical glucose alerts
- Environment variables: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

### Key NPM Dependencies
- **Server**: express, helmet, express-rate-limit, express-session, connect-pg-simple, bcryptjs, drizzle-orm, pg, openai, zod
- **Client**: React, TanStack Query, Radix UI components, Tailwind CSS, xlsx (Excel import), jspdf/html2canvas (PDF export), recharts (glucose charts)
- **Shared**: zod (validation), drizzle-zod (schema generation), date-fns

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Session signing key (required in production)
- `SESSION_COOKIE_SECURE`: Set to "true" for HTTPS
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `NODE_ENV`: "development" or "production"
- `PORT`: Server port (default 5000)