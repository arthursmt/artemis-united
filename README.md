# Artemis United

Monorepo gerenciado com [Turborepo](https://turbo.build/) e npm workspaces.

## Estrutura

- `apps/web` — React + TypeScript + Vite
- `apps/api` — Express + TypeScript (BFF)
- `services/bob-engine` — Express + TypeScript, isolado (não importa de `apps/*`)
- `packages/shared-types` — tipos TS compartilhados (preparado para geração via OpenAPI)
- `packages/config` — tsconfig, ESLint e Prettier compartilhados
- `infra/docker-compose.yml` — Postgres local para desenvolvimento

## Uso

```bash
npm install
npm run dev        # todos os apps em modo dev
npm run build      # build de tudo via turbo
npm run lint
npm run typecheck
npm run test
```

## Banco de dados local

```bash
docker compose -f infra/docker-compose.yml up -d
```
