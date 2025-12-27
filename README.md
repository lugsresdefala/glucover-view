# GluCover

Aplicação full-stack para acompanhamento glicêmico e geração de recomendações clínicas para Diabetes Mellitus Gestacional (DMG), com suporte completo a deploy em plataformas gratuitas.

## 🚀 Deploy Rápido (Plataformas Gratuitas)

Este projeto está configurado para deploy gratuito com preview e produção:

- **Frontend**: [Vercel](https://vercel.com) (gratuito)
- **Backend**: [Render](https://render.com), [Railway](https://railway.app), ou [Fly.io](https://fly.io) (gratuito)
- **Database**: [Neon](https://neon.tech), [Supabase](https://supabase.com), ou Render PostgreSQL (gratuito)

### Deploy em 3 Passos

1. **Backend no Render/Railway**
   - Conecte seu repositório GitHub
   - Configure variáveis de ambiente (ver `.env.example`)
   - Deploy automático com `npm run build` → `npm start`

2. **Database PostgreSQL**
   - Crie um banco gratuito no Neon, Supabase ou Render
   - Configure `DATABASE_URL` no backend
   - Execute `npm run db:push` para criar tabelas

3. **Frontend no Vercel**
   - Importe repositório no Vercel
   - Configure `VITE_API_BASE_URL` apontando para o backend
   - Deploy automático de `dist/public`

📖 **Documentação**:
- **[Guia Rápido de Deploy](./QUICKSTART.md)** - Deploy em 10 minutos
- **[Guia Completo de Deploy](./DEPLOYMENT.md)** - Instruções detalhadas
- **[Problemas Conhecidos](./KNOWN_ISSUES.md)** - Issues conhecidos e soluções

## Configuração Local

1. Copie o arquivo `.env.example` para `.env` e preencha:
   - `DATABASE_URL`: URL de um banco Postgres (Neon/Supabase possuem camadas gratuitas)
   - `SESSION_SECRET`: chave para assinar a sessão
   - `SESSION_COOKIE_SECURE`: defina como `true` para HTTPS em produção
   - `OPENAI_API_KEY` (opcional): para recomendações via IA; se ausente, usa recomendações determinísticas

2. Instale dependências:
   ```bash
   npm install
   ```

3. Execute migrações do banco de dados:
   ```bash
   npm run db:push
   ```

4. Execute em modo desenvolvimento:
   ```bash
   npm run dev
   ```

Ou para produção:
   ```bash
   npm run build
   npm start
   ```

## Desenvolvimento

- `npm run dev`: inicia o servidor em modo desenvolvimento com Vite
- `npm run check`: valida tipos TypeScript
- `npm run build`: cria build de produção
- `npm run db:push`: aplica migrações do banco de dados

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Modo desenvolvimento com hot reload |
| `npm run build` | Build de produção (frontend + backend) |
| `npm start` | Inicia servidor de produção |
| `npm run check` | Validação de tipos TypeScript |
| `npm run db:push` | Aplica schema do banco de dados |
| `npm test` | Executa testes unitários |

## Arquitetura rápida (arquivos principais)

- **Backend**
  - `server/index.ts`: inicializa Express/HTTP, aplica logs JSON, escolhe Vite em desenvolvimento ou `serveStatic` em produção e sobe na porta `PORT`.
  - `server/routes.ts`: único registrador de rotas REST (`/api/*`) com sessão/CSRF, CORS condicionado a `ALLOWED_ORIGINS` e middlewares de autenticação. Expõe autenticação de paciente/profissional, busca de avaliações, importação em lote (`/api/evaluations/batch`) e análise clínica (`/api/analyze`).
  - `server/storage.ts`: camada de persistência com Drizzle para avaliações, pacientes e usuários, além das relações médico-paciente.
  - `server/openai.ts` + `server/clinical-engine.ts`: processam avaliações (percentuais, médias, alertas) e geram recomendação clínica via OpenAI ou modo determinístico se a API não estiver configurada.
  - `shared/schema.ts`: fonte única de tipos e validações (metas glicêmicas, limites críticos, schemas Zod) usada por cliente, servidor e DB.

- **Frontend**
  - `client/src/main.tsx` + `client/src/App.tsx`: bootstrap do React, provedores (tema, React Query), roteamento com Wouter e seleção entre fluxos de paciente e profissional.
  - `client/src/pages/*`: telas principais (landing, dashboards de paciente/profissional, autenticação).
  - Exibição de resultados: `client/src/components/recommendation-panel.tsx` (conduta/urgência), `glucose-chart.tsx` (tendência x metas), `patient-stats.tsx` e `evaluation-history.tsx` (resumo e histórico).

### Regras de importação e processamento de dados
- Importação individual: `client/src/components/excel-import.tsx` normaliza cabeçalhos da planilha (ex.: “jejum”, “1h pós café”, “antes do jantar”), aceita apenas valores numéricos entre 0-600 mg/dL e descarta células vazias/fora de faixa antes de enviar para análise.
- Importação em lote: `client/src/components/batch-import.tsx` aplica mapeamento semelhante, tenta inferir idade gestacional e nome a partir do arquivo e envia os casos para `/api/evaluations/batch`, que persiste via `storage` e retorna cada avaliação criada.
- Processamento/IA: chamadas de análise (`/api/analyze`) validam o payload com `patientEvaluationSchema`, calculam métricas clínicas no `clinical-engine` e só então consultam o OpenAI (se configurado) para preencher a recomendação exibida nos componentes acima.

## Banco de dados

O projeto usa PostgreSQL via Drizzle ORM. Execute migrações com `npm run db:push` após configurar o `DATABASE_URL`.

### Provedores Gratuitos de PostgreSQL

- **[Neon](https://neon.tech)**: 10GB, auto-suspend, ideal para desenvolvimento
- **[Supabase](https://supabase.com)**: 500MB, inclui autenticação e storage
- **[Render PostgreSQL](https://render.com)**: 1GB, 90 dias de retenção

## Funcionalidades

- ✅ Autenticação dual (pacientes e profissionais)
- ✅ Monitoramento de glicemia com importação via Excel
- ✅ Análise clínica baseada em diretrizes (SBD 2025, FEBRASGO 2019, WHO 2025)
- ✅ Recomendações via IA (OpenAI) com fallback determinístico
- ✅ Geração de relatórios em PDF
- ✅ Dashboard com gráficos e métricas
- ✅ Histórico de avaliações
- ✅ Sistema de notificações
- ✅ Logs de auditoria

## Tecnologias

### Frontend
- React 18 + TypeScript
- Vite (build e dev server)
- TailwindCSS + shadcn/ui
- TanStack React Query
- Recharts (gráficos)
- Wouter (roteamento)

### Backend
- Node.js 20+
- Express.js
- PostgreSQL + Drizzle ORM
- OpenAI API (opcional)
- Session-based auth

## Ambientes de Deploy

### Preview (Pull Requests)
- Vercel automaticamente cria preview para cada PR
- Render/Railway podem ser configurados para preview branches

### Produção (Branch main)
- Deploy automático no merge para `main`
- Frontend: Vercel
- Backend: Render/Railway/Fly.io
- Database: Neon/Supabase

## CI/CD

GitHub Actions está configurado para:
- ✅ Type checking (TypeScript)
- ✅ Build de produção
- ✅ Testes unitários
- ✅ Deploy automático (via Vercel/Render)
