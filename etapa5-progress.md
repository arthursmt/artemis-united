# Etapa 5 — Progresso (sessão noturna, sem supervisão em tempo real)

> Arquivo de memória externa da sessão. Atualizado após cada tarefa concluída ou
> bloqueada. Se uma sessão nova retomar este trabalho, leia este arquivo inteiro
> antes de continuar.

## Nota inicial importante — documentos referenciados que não existem no repo

Antes de começar, busquei `artemis-united-plano-mestre.md`, `DESIGN.md` e
`docs/designpowers/wireframes/` em todos os branches (main + todos os remotes).
**Nenhum dos três existe no repositório.** Só existem `docs/architecture.md` e
`docs/bob-engine-parametros-setoriais.md`.

Isso já tinha acontecido na Etapa 4 (mesma ausência de DESIGN.md/wireframes) — na
época o fundador resolveu com "estilo mínimo pragmático agora, sistema de design
formal fica para depois". Aplico a mesma resolução aqui, sem reabrir a pergunta.

Para as seções 4.1–4.7 do plano mestre (que também não existe como arquivo), estou
seguindo os requisitos que o próprio fundador já detalhou inline na mensagem que
disparou esta fila de tarefas — cada tarefa abaixo tem campos/fluxo específicos
descritos ali, suficientes para implementar sem inventar escopo. Não é uma decisão
minha preencher a lacuna do documento ausente; é usar a especificação que já foi
dada diretamente.

**Isso não bloqueia a fila.** Registro aqui pra rastreabilidade, e sigo em frente.

## Regras globais desta sessão (não repetir, só relembrar se em dúvida)

- Nunca tocar em `services/bob-engine/` (schema, rotas, migrações, domínio).
- Nunca reabrir decisão do plano mestre/parâmetros setoriais sem "bloqueio
  pendente" documentado — não decido isso sozinho.
- Nunca credencial/chave real. Provedores externos (email, etc.) = stub (log
  estruturado), mesmo padrão de `SENTRY_DSN` vazio = no-op.
- Nenhum campo de onboarding-cliente (estado civil, filhos, pessoas na casa) pode
  chegar ao bob-engine, nem ser referenciado por ele. Fronteira da decisão #16
  (ECOA).
- Uma branch por tarefa/grupo relacionado. Commit + push ao final de cada uma.
  **Nunca abrir PR, nunca mergear, nunca tocar em `main` diretamente.**
- typecheck + build + lint limpos antes de considerar uma tarefa concluída.
- Migração via `drizzle-kit generate`: sempre duas passagens (add-only, depois
  drop-only) pra evitar o prompt interativo sem TTY — mesmo padrão validado na
  Etapa 4.
- Ambiguidade real de produto (não técnica) → para só aquela tarefa, documenta o
  motivo aqui, segue pra próxima. Não inventa a decisão do fundador.

## Estado do repositório no início desta sessão

- Branch de partida: `main`, atualizado (`origin/main` @ `2eebc64`, PR #4 da Etapa
  4 já mergeada).
- Schema `app` atual: `users` (id, email, passwordHash, timestamps — **sem**
  campo de verificação de email ainda), `businesses` (id, ownerUserId UNIQUE,
  name, sectorSegment, taxId nullable, timestamps), `financial_statements`,
  `institution_connections`, `sessions`.
- Auth existente (Etapa 2/4): signup, login, `GET /me`, `POST /logout` (já
  invalida sessão no servidor via `invalidateSession` — ver tarefa 9, já
  atendida, não duplicar).
- Padrão de token: `services/../session.ts` gera token aleatório
  (`randomBytes(20).toString('base64url')`), só o hash SHA-256 fica no banco —
  vou reusar esse padrão pra tokens de verificação de email e reset de senha.
- Frontend: `App.tsx` é uma máquina de estados local (sem router), componentes em
  `apps/web/src/components/`. Vou continuar essa convenção em vez de introduzir
  react-router no meio da sessão.

## Fila de tarefas

| # | Tarefa | Status |
|---|---|---|
| 1 | Criar este arquivo de progresso | ✅ feito |
| 2 | Cadastro completo — checkbox de termos + verificação de email (stub) | pendente |
| 3 | Esqueci minha senha — reset via token por email (stub) | pendente |
| 4 | Onboarding-cliente completo (DoB, endereço, estado civil, filhos, pessoas na casa, telefone alt.) | pendente |
| 5 | Onboarding-negócio completo (endereço, anos de negócio/experiência, telefone, nº empregados) | pendente |
| 6 | Configurações — Dados Pessoais (CRUD sobre tarefa 4) | pendente |
| 7 | Configurações — Dados do Negócio (CRUD sobre tarefa 5, sem criar 2º negócio) | pendente |
| 8 | Configurações — Segurança (troca de senha; 2FA só se sobrar tempo) | pendente |
| 9 | Configurações — Logout (verificar se já existe antes de duplicar) | pendente |
| 10 | Chat com BoB (menor prioridade — só se sobrar tempo/contexto) | pendente |

## Log por tarefa

(preenchido conforme cada tarefa é concluída ou bloqueada)
