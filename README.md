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

## Banco de dados

O projeto usa Postgres via Drizzle ORM. Rode migrações com `npm run db:push` após configurar o `DATABASE_URL`. Nenhum serviço do Replit é necessário.
