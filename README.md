# glucover-view

Aplicação full-stack para acompanhamento glicêmico e geração de recomendações clínicas para DMG, agora desvinculada de dependências do Replit.

## Configuração rápida

1. Copie o arquivo `.env.example` para `.env` e preencha:
   - `DATABASE_URL`: URL de um banco Postgres (Neon/Supabase possuem camadas gratuitas).
   - `SESSION_SECRET`: chave para assinar a sessão.
   - `OPENAI_API_KEY` (opcional): define um provedor padrão de IA; se ausente, o sistema usa recomendações determinísticas.
2. Instale dependências: `npm install`
3. Execute o build de produção (interface + API): `npm run build`
4. Suba o servidor: `npm run start` (serve a API e os assets estáticos gerados em `dist/public`)

## Desenvolvimento

- `npm run dev`: inicia o servidor em modo desenvolvimento com Vite em middleware.
- `npm run check`: valida tipos TypeScript.

## Banco de dados

O projeto usa Postgres via Drizzle ORM. Rode migrações com `npm run db:push` após configurar o `DATABASE_URL`. Nenhum serviço do Replit é necessário.
