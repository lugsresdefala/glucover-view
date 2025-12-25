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

#### Diretrizes Catalogadas e Aplicadas

**SBD 2025 - Sociedade Brasileira de Diabetes (R1-R17):**
- R1: Início de terapia farmacológica no DMG (Classe IIb, Nível C)
- R2: Insulina como primeira escolha (Classe I, Nível A)
- R3: Critério de crescimento fetal para insulina (Classe IIb, Nível B)
- R4: Dose inicial de insulina 0,5 UI/kg/dia (Classe IIb, Nível C)
- R5: Tipos de insulina aprovados - Categoria A/B/C ANVISA (Classe IIa, Nível C)
- R6: Análogos de ação rápida para pós-prandial (Classe IIa, Nível B)
- R7: Metformina como alternativa (Classe I, Nível B)
- R8: Associação metformina + insulina (Classe IIa, Nível B)
- R9: Glibenclamida CONTRAINDICADA (Classe III, Nível A)
- R10: DM2 - Suspender antidiabéticos orais (Classe I, Nível C)
- R11: Esquemas intensivos MDI/SICI em DM1/DM2 (Classe I, Nível B)
- R12: Redução de insulina pós-parto no DM1 (Classe I, Nível C)
- R13: Ajuste de insulina com corticóide (Classe I, Nível C)
- R14: Análogos rápidos no DM1 (Classe I, Nível B)
- R15: Manter análogos de ação prolongada (Classe IIa, Nível A)
- R16: DM2 - Metformina + insulina (Classe IIa, Nível B)
- R17: AAS para prevenção de pré-eclâmpsia (Classe I, Nível A)

**FEBRASGO 2019 - Femina 47(11):786-96 (F1-F10):**
- F1: Rastreamento universal de DMG
- F2: Diagnóstico de diabetes prévio (jejum ≥126 ou HbA1c ≥6,5%)
- F3: Diagnóstico de DMG (jejum 92-125 mg/dL)
- F4: TOTG 75g entre 24-28 semanas
- F5: Metas glicêmicas (jejum 65-95, 1h pós <140, 2h pós <120)
- F6: Terapia nutricional como primeira linha
- F7: Atividade física regular
- F8: Vigilância fetal
- F9: Momento do parto
- F10: Reclassificação pós-parto

**OMS 2025 - ISBN 9789240117044 (W1-W12):**
- W1: Rastreamento de hiperglicemia
- W2: Critérios diagnósticos WHO
- W3: Manejo nutricional
- W4: Atividade física
- W5: Automonitorização glicêmica
- W6: Insulina como tratamento preferencial
- W7: Metformina como alternativa
- W8: Vigilância fetal
- W9: Momento do parto
- W10: Cuidados pós-parto
- W11: Amamentação
- W12: Cuidados neonatais

**Metas Glicêmicas:**
- Jejum: 65-95 mg/dL
- Pré-prandial (pré-almoço, pré-jantar): <100 mg/dL
- Madrugada (3h): <100 mg/dL
- 1 hora pós-prandial: <140 mg/dL (medição padrão)

**Frequência de Monitorização:**
- Sem insulina: 4 medidas/dia (jejum, 1h pós-café, 1h pós-almoço, 1h pós-jantar)
- Com insulina: 7 medidas/dia (adiciona pré-almoço, pré-jantar, madrugada 3h)

### Security & Monitoring
- **Rate Limiting**: 2-tier rate limiting (global 100/min, auth 10/15min)
- **Security Headers**: Helmet with strict CSP in production, HSTS with preload
- **Structured Logging**: Per-request trace IDs via AsyncLocalStorage for request tracking
- **Health Endpoints**: `/healthz` (liveness) and `/readyz` (readiness) for monitoring
- **Error Boundary**: React ErrorBoundary with user-friendly Portuguese error messages
- **Test Coverage**: 22 unit tests for clinical engine (SBD/FEBRASGO/WHO rules)

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