# DMG Assist - Clinical Decision Support Platform

## Overview

DMG Assist is a clinical decision support system for managing Gestational Diabetes Mellitus (DMG). It helps healthcare professionals and patients track glucose data, manage insulin regimens, and generate evidence-based treatment recommendations following Brazilian clinical guidelines.

The application provides:
- **Three-tier user access system**:
  - **Patients**: Self-service registration/login, glucose data entry, view recommendations
  - **Doctors**: Access to assigned patients, manage evaluations, clinical analysis
  - **Coordinators**: Full system access to all patients and evaluations
- User authentication for healthcare professionals (Replit Auth) and patients (credential-based)
- Patient glucose monitoring with multi-day tracking
- Insulin regimen management with multiple insulin types
- AI-powered clinical recommendations based on DMG guidelines (R1-R7)
- Visual glucose trend analysis with charts
- Evaluation history tracking with persistent database storage
- Critical glucose alerts (hypoglycemia <60 mg/dL, severe hyperglycemia >200 mg/dL)
- PDF export of clinical reports with patient data, glucose tables, and recommendations
- Excel import for batch glucose data entry

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query for server state, React useState for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for glucose visualization

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful JSON API under `/api` prefix
- **AI Integration**: OpenAI-compatible API via Replit AI Integrations for generating clinical recommendations
- **Build System**: Vite for frontend, esbuild for server bundling

### Data Layer
- **Schema Definition**: Drizzle ORM with Zod for type-safe schemas
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Storage**: DatabaseStorage class for persistent evaluations and user data
- **Validation**: Shared Zod schemas between client and server in `/shared/schema.ts`
- **Authentication**: Replit Auth (OIDC) for healthcare professional login

### Authentication
- **Provider**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL-backed sessions
- **User Storage**: Users table stores Replit user profiles (id, email, name, avatar)

### Key Design Patterns
- **Shared Types**: Common types and validation schemas in `/shared` directory used by both client and server
- **Component Composition**: Reusable UI components with consistent styling
- **Form Validation**: Zod schemas with react-hook-form integration
- **Error Handling**: Centralized API error handling with toast notifications

### File Structure
```
client/src/
├── components/     # React components (glucose inputs, charts, recommendations)
│   ├── glucose-input.tsx    # Glucose measurement input with critical alerts
│   ├── pdf-export.tsx       # PDF report generation
│   ├── excel-import.tsx     # Excel batch import
│   └── evaluation-history.tsx
├── components/ui/  # shadcn/ui base components
├── pages/          # Page components (dashboard, landing)
├── hooks/          # Custom React hooks
├── lib/            # Utilities and API client
server/
├── index.ts        # Express server entry point
├── routes.ts       # API route definitions
├── storage.ts      # Database storage interface
├── openai.ts       # AI recommendation generation
├── auth.ts         # Replit Auth OIDC integration
├── db.ts           # Drizzle database connection
shared/
├── schema.ts       # Zod schemas, types, and clinical thresholds
```

## External Dependencies

### AI Services
- **Replit AI Integrations**: OpenAI-compatible API for generating clinical recommendations. Uses environment variables `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`

### Database
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable. Drizzle ORM configured for schema management with `drizzle-kit push` for migrations

### UI Framework
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **Recharts**: Data visualization for glucose trends
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build and development server with HMR
- **Replit Plugins**: Runtime error overlay, cartographer, and dev banner for Replit environment