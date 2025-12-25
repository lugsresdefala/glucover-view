# GlucoVer - Clinical Decision Support for Diabetes in Pregnancy

## Overview

GlucoVer is a full-stack clinical decision support system designed for healthcare professionals managing patients with Diabetes Mellitus during pregnancy (DM1, DM2, and Gestational Diabetes - DMG). The application enables glucose monitoring, clinical analysis, and AI-powered treatment recommendations based on Brazilian and international medical guidelines (SBD 2025, FEBRASGO 2019, WHO 2025).

Key capabilities:
- Patient glucose data entry (manual and Excel import)
- Clinical analysis engine with guideline-based recommendations
- Dual authentication system (patients and healthcare professionals)
- AI-powered recommendations via OpenAI (with deterministic fallback)
- PDF report generation for clinical documentation
- Doctor-patient relationship management

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode)
- **Build Tool**: Vite with path aliases (`@/` for client, `@shared/` for shared code)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Entry Point**: `server/index.ts` initializes HTTP server, applies middleware
- **API Routes**: `server/routes.ts` handles all `/api/*` endpoints with session/CSRF protection
- **Development**: Vite middleware mode for HMR
- **Production**: Static file serving from `dist/public`

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` and `shared/models/auth.ts`
- **Session Storage**: PostgreSQL-backed sessions via `connect-pg-simple`
- **Migrations**: Run with `npm run db:push` (Drizzle Kit)

### Authentication System
- **Dual Auth**: Separate flows for patients and healthcare professionals
- **Session-based**: Express sessions with PostgreSQL storage
- **CSRF Protection**: Token-based protection for state-changing requests
- **Password Hashing**: bcryptjs

### Clinical Engine
- **Location**: `server/clinical-engine.ts` and `server/openai.ts`
- **Function**: Calculates glucose metrics, identifies critical alerts, generates treatment recommendations
- **AI Integration**: OpenAI for recommendations (optional - falls back to deterministic rules if not configured)
- **Guidelines**: Based on Brazilian DMG treatment protocols (R1-R7 recommendations)

### Key Design Patterns
- **Shared Types**: Single source of truth in `shared/schema.ts` for database schema, Zod validation, and TypeScript types
- **API Request Pattern**: `apiRequest()` helper handles CSRF tokens, credentials, and error handling
- **Component Structure**: Feature components in `client/src/components/`, pages in `client/src/pages/`

## External Dependencies

### Database
- **PostgreSQL**: Required. Configure via `DATABASE_URL` environment variable
- **Recommended Providers**: Neon, Supabase (free tiers available)

### AI Services (Optional)
- **OpenAI API**: Set `OPENAI_API_KEY` for AI-powered recommendations
- **Fallback**: System uses deterministic clinical rules if OpenAI is not configured

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes (prod) | Session signing key |
| `OPENAI_API_KEY` | No | Enables AI recommendations |
| `SESSION_COOKIE_SECURE` | No | Set `true` for HTTPS deployments |
| `ALLOWED_ORIGINS` | No | Comma-separated list of allowed CORS origins |

### Key NPM Dependencies
- **UI**: `@radix-ui/*`, `tailwindcss`, `class-variance-authority`
- **Data**: `drizzle-orm`, `@tanstack/react-query`, `zod`
- **Charts**: `recharts`
- **Excel**: `xlsx` for spreadsheet import
- **PDF**: `jspdf`, `html2canvas` for report generation