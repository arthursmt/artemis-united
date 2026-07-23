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

## Decisão de estrutura de branches

As tarefas 2–9 não são logicamente independentes entre si (ex: tarefa 6 é CRUD
sobre os campos que a tarefa 4 cria; tarefa 7 idem sobre a tarefa 5). Como nunca
mergeamos em `main` durante a sessão, branchar cada tarefa a partir de `main`
faria cada uma "esquecer" o schema/rotas das tarefas anteriores — e esse arquivo
de progresso também some se a branch não vier daqui.

**Decisão: branches empilhadas.** Cada branch nasce da ponta da branch da tarefa
anterior, não de `main`. Ordem real (atualizado conforme avanço):

```
main
 └─ chore/etapa5-progress-file              (tarefa 1)
     └─ feat/etapa5-signup-email-verification  (tarefa 2, em andamento)
```

Cada branch continua com commit próprio e push próprio, como pedido. Revisão
final: o fundador decide se revisa/mergeia em sequência (cada PR contra a
anterior) ou se prefere que eu rebase tudo numa branch única de Etapa 5 no
final — não decido isso sozinho, só sinalizo a estrutura real.

## Log por tarefa

### Tarefa 2 — Cadastro completo (checkbox de termos + verificação de email)

Status: ✅ concluída. Branch `feat/etapa5-signup-email-verification` (empilhada
sobre `chore/etapa5-progress-file`), commit feito e push feito.

Testado com curl real (Postgres local + apps/api rodando):
- signup sem `acceptedTerms` → 400
- signup com `acceptedTerms: true` → 201, `verificationRequired: true`, **sem**
  cookie de sessão
- login antes de verificar → 403
- `verify-email` com token inválido → 400
- `verify-email` com token real (extraído do log do stub) → 200 + sessão criada
  (confirmado via `GET /me`)
- reuso do mesmo token → 400 (uso único confirmado)
- login depois de verificar → 200
- dado de teste limpo do banco ao final

Decisões de implementação (documentadas, não pedidas explicitamente no plano
mestre ausente, mas necessárias pra fechar o fluxo):
- `users.termsAcceptedAt` e `users.emailVerifiedAt` — **nullable** no schema
  (não NOT NULL): linhas de teste da Etapa 4 não têm esses valores, e forçar
  NOT NULL exigiria um default silencioso (`now()`) que mascararia ausência
  real de aceite/verificação. A rota de signup sempre grava valor real; null =
  "nunca aceitou/nunca verificou" pra qualquer lógica futura.
- Nova tabela `email_verification_tokens` — mesmo padrão de `sessions` (token
  aleatório ao usuário, só hash SHA-256 no banco), uso único.
- Signup **não cria sessão** — só após confirmar o email (`POST
  /v1/auth/verify-email`) a conta ganha sessão. Login de conta não verificada
  responde 403, não deixa passar.
- Envio de email é stub: `apps/api/src/lib/emailStub.ts`, loga JSON
  estruturado com o link/token em vez de enviar de verdade (mesmo padrão do
  `SENTRY_DSN` vazio).
- Sem endpoint de "reenviar verificação" — fora de escopo explícito, anotado
  como possível follow-up, não bloqueia a tarefa.
- Texto de Termos de Uso/Política de Privacidade: **não fabriquei conteúdo
  legal real** — checkbox com rótulo genérico ("Li e aceito os Termos de Uso e
  a Política de Privacidade"), sem link pra documento real (não existe). Isso
  é uma pendência de conteúdo jurídico real, não uma implementação técnica —
  registrado, não resolvido.
