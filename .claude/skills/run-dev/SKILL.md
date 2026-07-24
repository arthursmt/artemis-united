---
name: run-dev
description: Sobe os três serviços locais do Artemis United (bob-engine, apps/api, apps/web) na ordem e com os passos de ambiente corretos. Use quando o usuário pedir para "subir os serviços", "rodar o projeto localmente", "iniciar o dev", ou quando qualquer teste manual/curl contra localhost:4000/4100/5173 falhar de forma que sugira serviço fora do ar (ECONNREFUSED, connection refused, 500 genérico em rota que deveria funcionar).
---

# Subir o ambiente de desenvolvimento local

Sequência real deste monorepo (Turborepo + npm workspaces). Pular passos aqui
é a causa mais comum de "cadastro não persiste"/"login falha"/"bug fantasma"
em sessões de teste manual — na prática quase sempre é ambiente fora do ar,
não bug de código.

## 1. Confirmar diretório e branch

```bash
pwd   # deve ser a raiz do repo
git branch --show-current
```

## 2. Garantir que o Postgres local está de pé

O Postgres roda em Docker (`infra/docker-compose.yml`). Se o Docker Desktop
não estiver rodando, `apps/api` e `bob-engine` sobem normalmente (não
conferem DB na inicialização) mas **toda query falha com `ECONNREFUSED`**,
geralmente aparecendo pro usuário como 500 genérico — sintoma enganoso.

```bash
docker info >/dev/null 2>&1 && echo "docker ok" || echo "docker down"
```

Se `docker down`: iniciar o Docker Desktop e aguardar o daemon (não precisa
sleep longo, ele costuma subir em ~10-20s):

```bash
"/c/Program Files/Docker/Docker/Docker Desktop.exe" &
disown
for i in $(seq 1 24); do docker info >/dev/null 2>&1 && break; sleep 5; done
```

Depois, subir (ou confirmar) o container do Postgres:

```bash
docker compose -f infra/docker-compose.yml up -d postgres
docker exec artemis-united-postgres pg_isready -U artemis -d artemis_united
```

## 3. Checar portas livres antes de subir (4100, 4000, 5173)

```bash
netstat -ano | grep -E ':4000|:4100|:5173'
```

Se algo já está escutando e não é o processo que você quer manter, mate
antes de subir de novo (evita `EADDRINUSE` no `tsx watch`):

```bash
taskkill //F //PID <pid> //T
```

## 4. Se os pacotes internos (`packages/shared-types`, `packages/analytics`)
   nunca foram buildados nesta máquina/checkout

`bob-engine` importa `@artemis-united/shared-types` compilado (`dist/`), não
o TS fonte. `node_modules` recém-instalado ou `dist/` ausente causa
`ERR_MODULE_NOT_FOUND`. Se acontecer:

```bash
find packages -name tsconfig.tsbuildinfo -delete   # evita cache do tsc -b mentir que já buildou
npx turbo run build --filter=@artemis-united/shared-types --filter=@artemis-united/analytics --force
```

## 5. Subir os três serviços (background, cada um com log próprio)

`bob-engine` e `apps/api` têm `.env` com `DATABASE_URL`/segredos — sempre
`set -a; source .env; set +a` antes do `npm run dev`. `apps/web` não tem
`.env` (só `.env.example`), não precisa desse passo.

```bash
cd services/bob-engine && set -a && source .env && set +a && npm run dev > ../../bob-engine.log 2>&1 &
disown

cd apps/api && set -a && source .env && set +a && npm run dev > ../../apps-api.log 2>&1 &
disown

cd apps/web && npm run dev > ../../apps-web.log 2>&1 &
disown
```

(Ajuste os caminhos de log conforme o diretório de onde você está rodando —
o padrão usado nas sessões anteriores é gravar na raiz do repo.)

## 6. Health-check real, não só porta aberta

`/ ` em `bob-engine`/`apps/api` responde 404 (não têm rota raiz) — isso é
normal, não é falha. O teste real é `/health`:

```bash
curl -s http://localhost:4100/health   # bob-engine
curl -s http://localhost:4000/health   # apps/api
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # apps/web, espera 200
```

Ambos os `/health` devem responder `{"status":"ok","service":"..."}`.

## Se algo ainda falhar depois disso

Olhe o log do serviço específico (`bob-engine.log`, `apps-api.log`,
`apps-web.log`) antes de suspeitar de bug de código — na maioria dos casos
já vistos neste projeto, a causa raiz foi ambiental (Docker fora do ar,
`dist/` ausente, porta ocupada por processo zumbi de sessão anterior), não
uma regressão real.
