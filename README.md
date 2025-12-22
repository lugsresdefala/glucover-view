# glucover-view

Aplicação full-stack para acompanhamento glicêmico e geração de recomendações clínicas para DMG, agora desvinculada de dependências do Replit.

## Configuração rápida

1. Copie o arquivo `.env.example` para `.env` e preencha:
   - `DATABASE_URL`: URL de um banco Postgres (Neon/Supabase possuem camadas gratuitas).
   - `SESSION_SECRET`: chave para assinar a sessão.
   - `SESSION_COOKIE_SECURE` (opcional): defina como `true` se o deploy estiver atrás de HTTPS.
   - `OPENAI_API_KEY` (opcional): define um provedor padrão de IA; se ausente, o sistema usa recomendações determinísticas.
2. Instale dependências: `npm install`
3. Execute o build de produção (interface + API): `npm run build`
4. Suba o servidor: `npm run start` (serve a API e os assets estáticos gerados em `dist/public`)

## Deploy sugerido (Vercel + backend gratuito)

- **Frontend**: no Vercel, use `npm run build` e defina o diretório de saída como `dist/public`. Configure a variável `VITE_API_BASE_URL` apontando para o backend.
- **Backend**: qualquer serviço Node gratuito (Render/Railway/Fly.io) usando Postgres gratuito (Neon/Supabase). Defina `ALLOWED_ORIGINS` com o domínio do Vercel para liberar CORS/CSRF e mantenha `SESSION_COOKIE_SECURE=true`.

## Desenvolvimento

- `npm run dev`: inicia o servidor em modo desenvolvimento com Vite em middleware.
- `npm run check`: valida tipos TypeScript.

## Arquitetura rápida (arquivos principais)

- **Backend**
  - `server/index.ts`: inicializa Express/HTTP, aplica logs JSON, escolhe Vite em desenvolvimento ou `serveStatic` em produção e sobe na porta `PORT`.
  - `server/routes.ts`: único registrador de rotas REST (`/api/*`) com sessão/CSRF, CORS condicionado a `ALLOWED_ORIGINS` e middlewares de autenticação. Expõe autenticação de paciente/profissional, busca de avaliações, importação em lote (`/api/evaluations/batch`) e análise clínica (`/api/analyze`).
  - `server/storage.ts`: camada de persistência com Drizzle para avaliações, pacientes e usuários, além das relações médico‑paciente.
  - `server/openai.ts` + `server/clinical-engine.ts`: processam avaliações (percentuais, médias, alertas) e geram recomendação clínica via OpenAI ou modo determinístico se a API não estiver configurada.
  - `shared/schema.ts`: fonte única de tipos e validações (metas glicêmicas, limites críticos, schemas Zod) usada por cliente, servidor e DB.

- **Frontend**
  - `client/src/main.tsx` + `client/src/App.tsx`: bootstrap do React, provedores (tema, React Query), roteamento com Wouter e seleção entre fluxos de paciente e profissional.
  - `client/src/pages/*`: telas principais (landing, dashboards de paciente/profissional, autenticação).
  - Exibição de resultados: `client/src/components/recommendation-panel.tsx` (conduta/urgência), `glucose-chart.tsx` (tendência x metas), `patient-stats.tsx` e `evaluation-history.tsx` (resumo e histórico).

### Regras de importação e processamento de dados
- Importação individual: `client/src/components/excel-import.tsx` normaliza cabeçalhos da planilha (ex.: “jejum”, “1h pós café”, “antes do jantar”), aceita apenas valores numéricos entre 0‑600 mg/dL e descarta células vazias/fora de faixa antes de enviar para análise.
- Importação em lote: `client/src/components/batch-import.tsx` aplica mapeamento semelhante, tenta inferir idade gestacional e nome a partir do arquivo e envia os casos para `/api/evaluations/batch`, que persiste via `storage` e retorna cada avaliação criada.
- Processamento/IA: chamadas de análise (`/api/analyze`) validam o payload com `patientEvaluationSchema`, calculam métricas clínicas no `clinical-engine` e só então consultam o OpenAI (se configurado) para preencher a recomendação exibida nos componentes acima.

## Banco de dados

O projeto usa Postgres via Drizzle ORM. Rode migrações com `npm run db:push` após configurar o `DATABASE_URL`. Nenhum serviço do Replit é necessário.
