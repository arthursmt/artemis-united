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
| 2 | Cadastro completo — checkbox de termos + verificação de email (stub) | ✅ feito |
| 3 | Esqueci minha senha — reset via token por email (stub) | ✅ feito |
| 4 | Onboarding-cliente completo (DoB, endereço, estado civil, filhos, pessoas na casa, telefone alt.) | ✅ feito |
| 5 | Onboarding-negócio completo (endereço, anos de negócio/experiência, telefone, nº empregados) | ✅ feito |
| 6 | Configurações — Dados Pessoais (CRUD sobre tarefa 4) | ✅ feito |
| 7 | Configurações — Dados do Negócio (CRUD sobre tarefa 5, sem criar 2º negócio) | ✅ feito |
| 8 | Configurações — Segurança (troca de senha; 2FA só se sobrar tempo) | ⚠️ troca de senha feita, 2FA pendente (ver log) |
| 9 | Configurações — Logout (verificar se já existe antes de duplicar) | ✅ feito (verificação, sem código novo) |
| 10 | Chat com BoB (menor prioridade — só se sobrar tempo/contexto) | ✅ feito |

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
     └─ feat/etapa5-signup-email-verification  (tarefa 2)
         └─ feat/etapa5-forgot-password          (tarefa 3)
             └─ feat/etapa5-onboarding-cliente     (tarefa 4)
                 └─ feat/etapa5-onboarding-negocio   (tarefa 5)
                     └─ feat/etapa5-settings-pessoais  (tarefa 6)
                         └─ feat/etapa5-settings-negocio (tarefa 7)
                             └─ feat/etapa5-settings-seguranca (tarefa 8)
                                 └─ feat/etapa5-settings-logout (tarefa 9)
                                     └─ feat/etapa5-chat-bob (tarefa 10, em andamento)
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

### Tarefa 3 — Esqueci minha senha

Status: ✅ concluída. Branch `feat/etapa5-forgot-password` (empilhada sobre a
tarefa 2), commit feito e push feito.

Decisões de implementação:
- Nova tabela `password_reset_tokens` — mesmo padrão de token de uso único, mas
  separada de `email_verification_tokens` (ciclo de vida diferente: cada nova
  solicitação de reset **invalida qualquer token anterior** do mesmo usuário —
  `createPasswordResetToken` apaga tokens antigos antes de criar o novo).
  Validade de 1h (mais curta que a de verificação de cadastro, 24h — reset é
  mais sensível).
- `POST /v1/auth/forgot-password` sempre responde a mesma mensagem genérica,
  exista ou não o email — evita enumeração de contas. Só envia o email (stub)
  se o usuário existir de verdade.
- `POST /v1/auth/reset-password`: consome o token, troca a senha, **derruba
  todas as sessões existentes do usuário** (`invalidateAllUserSessions`, nova
  função em `auth/session.ts` — antes só existia invalidar uma sessão por id),
  e cria uma sessão nova (login automático pós-reset).
- Decisão não pedida explicitamente, meu julgamento: completar um reset via
  link de email prova posse da caixa de entrada, igual à verificação de
  cadastro — então `reset-password` também marca `emailVerifiedAt` se ainda
  não estava marcado, pra uma conta nunca verificada não ficar presa depois de
  provar acesso ao email por outro caminho. Login normal continua exigindo
  `emailVerifiedAt` — só o próprio reset ganha esse efeito colateral.
- Mesmo stub de email da tarefa 2 (`lib/emailStub.ts`), reusado sem alteração.

Testado com curl real:
- `forgot-password` pra email inexistente vs. existente → resposta idêntica
  (200, mesma mensagem genérica)
- `reset-password` com token inválido → 400
- `reset-password` com senha fraca → 400
- `reset-password` com token real + senha válida → 200 + sessão criada
  (confirmado via `GET /me`)
- login com senha antiga → 401 (já trocou)
- login com senha nova → 200 (conta auto-verificada pelo reset)
- reuso do mesmo token de reset → 400 (uso único confirmado)
- dado de teste limpo do banco ao final

### Tarefa 4 — Onboarding-cliente completo

Status: ✅ concluída. Branch `feat/etapa5-onboarding-cliente` (empilhada sobre
a tarefa 3), commit feito e push feito.

Campos implementados (todos os pedidos): data de nascimento, endereço
residencial completo (linha 1, linha 2 opcional, cidade, estado, CEP — padrão
EUA), estado civil, filhos (sim/não), nº de pessoas na casa (opcional, único
campo assim marcado no pedido), telefone alternativo.

Decisões de implementação:
- Nova tabela `customer_profiles` (1:1 com `users`, `userId` UNIQUE) em vez de
  colunas soltas em `users` — mesmo racional de `businesses`/
  `financial_statements`: domínio de dado distinto, e a tarefa 6 (Configurações
  — Dados Pessoais) faz CRUD só sobre isto.
- **Verificação explícita da fronteira ECOA (decisão #16)**: rodei `grep` em
  `bobEngineClient.ts`, `routes/financialStatements.ts`, `routes/
  assessments.ts` e todo `services/bob-engine` procurando por
  `customerProfile`/`maritalStatus`/`dateOfBirth`/`hasChildren`/
  `householdSize` — zero ocorrências. Documentado como comentário no próprio
  schema (`customerProfiles`) pra qualquer edição futura ver o aviso antes de
  criar esse acoplamento.
- Nova constante compartilhada `packages/shared-types/src/usStates.ts` (50
  estados + DC) — usada tanto na validação do servidor (`state` precisa ser um
  código válido) quanto no dropdown do formulário. Não é invenção de escopo:
  "endereço residencial (padrão EUA)" já implica essa lista fixa e
  universalmente conhecida.
- `estado civil` implementado como enum do Postgres (`single`/`married`/
  `divorced`/`widowed`/`separated`) — categorias comuns, não estava
  especificado no pedido além do nome do campo.
- `POST /v1/customer-profile` só cria (409 se já existe) — leitura via `GET
  /me`. Atualização (PUT) fica pra tarefa 6, que é explicitamente sobre isso.
- Fluxo de onboarding reordenado: `routeAfterAuth` agora checa perfil-cliente
  **antes** de checar negócio (onboarding-cliente → onboarding-negócio →
  DRE → dashboard) — decisão minha, não especificada explicitamente, mas é a
  ordem lógica (dados pessoais antes de dados do negócio).
- Telefone alternativo: implementado como campo obrigatório (não fabriquei
  validação de formato de telefone — só não-vazio). Só "nº de pessoas na casa"
  estava marcado "(opcional)" no pedido; se a intenção real for diferente,
  fica como ponto a revisar, não decidi reinterpretar.

Testado com curl real:
- criação com `state` inválido → 400
- criação com dados válidos → 201
- criação duplicada → 409
- `GET /me` antes de criar → 404, depois de criar → 200
- confirmado que `GET /businesses/me` continua 404 depois do perfil-cliente
  criado (ordem do fluxo intacta — onboarding-negócio ainda pendente)
- dado de teste limpo do banco ao final

### Tarefa 5 — Onboarding-negócio completo

Status: ✅ concluída. Branch `feat/etapa5-onboarding-negocio` (empilhada sobre
a tarefa 4), commit feito e push feito.

Decisões de implementação:
- **Não mexi no `POST /v1/businesses` (criação, nome+setor) da Etapa 4** —
  interpretei "estender o negócio já criado" literalmente: os campos novos
  (endereço, anos de negócio/experiência, telefone opcional, nº de
  empregados) entram em colunas novas e nullable de `businesses` (migração
  aditiva), preenchidas num **segundo passo** via `PUT /v1/businesses/me`, não
  na criação. Isso preserva o endpoint de criação já revisado/testado da
  Etapa 4 intacto.
- Front: tela nova (`BusinessDetailsForm`) aparece logo depois da criação do
  negócio (nome+setor) e antes do DRE. `routeAfterAuth` trata
  `business.addressLine1 === null` como "onboarding de negócio incompleto" —
  mesmo padrão de detecção usado pra perfil-cliente/negócio inexistentes.
- **Autofill "mesmo endereço da residência"**: checkbox que copia
  `addressLine1/2/city/state/zipCode` do `customer_profile` (tarefa 4) pros
  campos do negócio, e trava esses campos como somente-leitura enquanto
  marcado (desmarcar libera edição de novo, sem apagar o que já tinha).
- Reusei a mesma constante `US_STATES`/`US_STATE_CODES` de `shared-types` (da
  tarefa 4) pra validar o estado do endereço do negócio — mesmo padrão, sem
  duplicar a lista.
- `phone` é o único campo opcional aqui (nullable, "(opcional)" no pedido);
  `yearsInBusiness`, `yearsOfIndustryExperience` e `numberOfEmployees` são
  inteiros não-negativos obrigatórios.
- **Trava de 1-negócio-por-usuário continua intacta** — `PUT /me` só edita o
  negócio já existente do usuário autenticado (404 se não existir ainda), não
  cria nada novo. Não toquei na lógica de criação/409 da Etapa 4.

Testado com curl real:
- negócio recém-criado tem todos os campos novos `null` (confirma que a
  criação da Etapa 4 continua igual)
- `PUT /me` com `state` inválido → 400
- `PUT /me` válido, sem telefone → 200, `phone: null` salvo corretamente
- `PUT /me` sem negócio existente ainda (usuário diferente) → 404
- dado de teste limpo do banco ao final

### Tarefa 6 — Configurações: Dados Pessoais

Status: ✅ concluída. Branch `feat/etapa5-settings-pessoais` (empilhada sobre
a tarefa 5), commit feito e push feito.

Decisões de implementação:
- `PUT /v1/customer-profile/me` adicionado (mesma validação do POST da
  tarefa 4, reusada via `parseCustomerProfile`) — 404 se o perfil ainda não
  existir (edição, não criação).
- Criei o shell `SettingsScreen.tsx` com 3 abas (Dados Pessoais/Dados do
  Negócio/Segurança) + botão de Sair, já pensando nas tarefas 7 e 8 que vêm a
  seguir — as abas "Dados do Negócio" e "Segurança" mostram um placeholder
  "em construção" por enquanto, viram reais nas próprias tarefas 7/8 (só
  troco o conteúdo da aba, não a estrutura do shell).
- `PersonalDataSettings.tsx`: busca o perfil atual no mount, formulário
  pré-preenchido, salva via `PUT`. Mesmos campos/validação do onboarding
  (tarefa 4), reaproveitando os componentes de UI (não o formulário em si,
  que tem lógica de pré-preenchimento diferente do de criação).
- `Dashboard.tsx` ganha um link "Configurações" ao lado de "Sair" no topo —
  único ponto de entrada adicionado ao fluxo existente.

Testado com curl real:
- `PUT /me` sem perfil existente → 404
- criar perfil, depois `PUT /me` mudando cidade/estado civil/pessoas na casa
  → 200, dados realmente atualizados (confirmado no corpo da resposta)
- dado de teste limpo do banco ao final

### Tarefa 7 — Configurações: Dados do Negócio

Status: ✅ concluída. Branch `feat/etapa5-settings-negocio` (empilhada sobre
a tarefa 6), commit feito e push feito.

**Sem mudança de backend** — `PUT /v1/businesses/me` já existia da tarefa 5 e
já atendia exatamente ao pedido ("CRUD sobre os dados da tarefa 5"). Só
construí a tela: `BusinessDataSettings.tsx` (busca o negócio atual, formulário
pré-preenchido, salva via o mesmo `PUT`), ligada na aba "Dados do Negócio" do
`SettingsScreen.tsx` (antes placeholder, criado na tarefa 6).

Trava de 1-negócio-por-usuário confirmada intacta por construção: `PUT /me`
só edita o negócio já existente do usuário (não passa por nenhum caminho de
criação) — mesmo `id` antes/depois da edição, testado explicitamente.

Testado com curl real: criar negócio → primeira edição (PUT) → segunda
edição real (PUT de novo, mudando cidade/nº empregados/telefone) → 200,
mesmo `id`, dados novos refletidos corretamente. Dado de teste limpo do
banco ao final.

### Tarefa 8 — Configurações: Segurança

Status: ✅ concluída (troca de senha) / ⚠️ **2FA não implementado — pendência
documentada abaixo, decisão explícita do pedido original ("prioridade
menor... deixe como sub-item documentado como incompleto se o tempo/contexto
apertar")**. Branch `feat/etapa5-settings-seguranca` (empilhada sobre a
tarefa 7), commit feito e push feito.

**Troca de senha — implementado:**
- `POST /v1/auth/change-password` (requireAuth): exige `currentPassword`
  correta (401 se errada) + `newPassword` válida pela mesma política de
  sempre (400 se fraca). Diferença chave vs. o reset da tarefa 3: change
  exige prova de posse da senha atual (usuário já autenticado), reset exige
  só o token de email (usuário provou não ter mais a senha).
- Depois de trocar: derruba todas as sessões existentes
  (`invalidateAllUserSessions`, reusada da tarefa 3) e cria uma sessão nova
  pro dispositivo atual — mesmo padrão do reset, evita deslogar o usuário no
  meio da própria troca. Testado explicitamente: sessão atual continua
  funcionando (`GET /me`) logo depois da troca.
- Frontend: `SecuritySettings.tsx` na aba "Segurança" — formulário
  senha-atual + nova-senha.

**2FA — não implementado, pendência real:**
- Nem TOTP nem código por email foram construídos nesta sessão.
- Não é uma omissão silenciosa: a tela `SecuritySettings.tsx` tem uma seção
  visível "Autenticação em duas etapas (2FA)" com texto explícito dizendo que
  não foi implementado e apontando pra este arquivo.
- Não decidi arbitrariamente qual dos dois (TOTP vs código por email)
  implementar primeiro quando isso for retomado — `docs/architecture.md`
  §2 lista os dois como igualmente válidos ("2FA opcional: código por email
  ou app autenticador (TOTP)"), então essa escolha fica pro fundador, não pra
  mim decidir sozinho ao retomar.

Testado com curl real (troca de senha): senha atual errada (401), nova senha
fraca (400), troca válida (200), sessão atual continua ativa depois da troca
(`GET /me`), login com senha antiga falha (401), login com senha nova
funciona (200). Dado de teste limpo do banco ao final.

### Tarefa 9 — Configurações: Logout

Status: ✅ concluída — **verificação, sem código novo** (o pedido era
"confirmar que existe... antes de duplicar", e já existia). Branch
`feat/etapa5-settings-logout` (empilhada sobre a tarefa 8), só o próprio
`etapa5-progress.md` muda nesse commit.

O que já existia, desde a Etapa 2/4, sem qualquer alteração nesta tarefa:
- Botão explícito de "Sair" em `Dashboard.tsx` **e** em `SettingsScreen.tsx`
  (ambos adicionados nesta sessão, tarefas 4-6, mas reusando o mesmo
  `logout()` de `api/auth.ts` já existente desde a Etapa 4).
- `POST /v1/auth/logout` (backend, Etapa 4): lê o cookie de sessão, chama
  `invalidateSession(session.id)` — **apaga a linha da tabela `sessions` no
  banco**, não só limpa o cookie no browser.

Testado com curl real, de forma conclusiva: `GET /me` com um cookie válido
→ 200; `POST /logout` com esse mesmo cookie → 204; `GET /me` **reusando o
mesmo cookie** (sem logout de novo, sem novo login) → 401. Isso prova que a
invalidação é no servidor — um cookie clonado/reaproveitado depois do logout
não funciona mais, o que não seria o caso se o logout só limpasse o cookie
do lado do cliente. Dado de teste limpo do banco ao final.

### Tarefa 10 — Chat com BoB (menor prioridade)

Status: ✅ concluída. Branch `feat/etapa5-chat-bob` (empilhada sobre a
tarefa 9), commit feito e push feito. Chegou nesta sessão porque sobrou
tempo/contexto depois das tarefas 2-9, exatamente como o pedido previa.

Decisões de implementação:
- **Sem SDK novo** — chamada direta via `fetch` nativo pra
  `https://api.anthropic.com/v1/messages` (endpoint oficial documentado),
  em vez de adicionar `@anthropic-ai/sdk` como dependência só pra isto. Mesma
  filosofia de minimalismo já aplicada no resto da sessão.
- Modelo usado: `claude-sonnet-5` — o ID mais atual disponível, sem
  necessidade de consultar a skill `claude-api` porque o próprio contexto
  desta sessão já traz os IDs corretos (Sonnet 5, Opus 4.8, Haiku 4.5).
- **`ANTHROPIC_API_KEY` — mesmo padrão do `SENTRY_DSN`**: sem a chave no
  ambiente, `POST /v1/chat` responde `{configured: false}` com **200** (não é
  um erro, é um estado normal do ambiente de dev sem credencial real) — nunca
  simula resposta, nunca trava a requisição. **Não inventei nenhuma chave**
  (confirmado: `ANTHROPIC_API_KEY` não existe no `.env` real usado nesta
  sessão).
- Prompt do sistema usa a voz do BoB tal como descrita no pedido (calorosa,
  direta, linguagem simples, não-julgadora) + injeta o assessment mais
  recente do negócio como contexto (reusa `fetchLatestAssessment` de
  `bobEngineClient.ts`, já existente da Etapa 4 — nenhuma mudança em
  `services/bob-engine`).
- `POST /v1/chat` exige negócio existente (409 se não), mas **não exige
  assessment existente** — sem avaliação ainda, o contexto injetado no prompt
  só diz isso explicitamente ("o usuário ainda não tem avaliação calculada"),
  não é bloqueio.
- Frontend: `ChatScreen.tsx` simples (histórico de mensagens em memória, sem
  persistência — não pedido), acessível via link "Chat com BoB" no topo do
  Dashboard. Mostra um aviso claro (não um erro genérico) quando
  `configured: false`.

**Achado durante o teste, não um bug**: o primeiro teste deu 500 porque o
`services/bob-engine` não estava rodando desde o início desta sessão (nunca
precisei subir ele antes — as tarefas 2-9 são só `apps/api`/`apps/web`). Subi
o serviço (sem tocar em nenhum arquivo dele, regra global respeitada) e o
teste passou normalmente.

Testado com curl real: chat sem negócio → 409; chat com negócio mas sem
`ANTHROPIC_API_KEY` (com bob-engine real rodando, `fetchLatestAssessment`
retornando `not_found` corretamente) → 200 `{"configured":false}`. Dado de
teste limpo do banco ao final.

## Fase 2 (jul/2026) — 2FA por email, reenvio de verificação, plano mestre

Retomada da sessão a pedido do fundador, resolvendo diretamente as pendências
1 e 2 do resumo final abaixo (2FA e reenvio de verificação), mais a primeira
edição registrada em `artemis-united-plano-mestre.md` (arquivo que apareceu
untracked no repo nesta fase — confirmado ausente em todas as branches até
aqui).

### `artemis-united-plano-mestre.md`

Branch `docs/plano-mestre-pendencias-etapa5` (a partir de `main`, não
empilhada — mudança de documentação, não de código). Commit `603ea97`, push
feito, sem merge.

Três mudanças: (1) Seção 2 marca 2FA V1 como decidido (só email, TOTP sem
escopo); (2) nova seção 4.9 "Pendências e decisões de UX/Fluxo (Etapa 5)" com
os itens decididos nesta fase + a pendência real de texto legal (não bloqueia
beta fechado); (3) três novas linhas no Log de decisões (#40, #41, #42).

### Tarefa 11 — 2FA por email

Status: ✅ concluída. Branch `feat/etapa5-2fa-email` (empilhada sobre
`feat/etapa5-chat-bob`, tarefa 10) — resolve a pendência 1 do resumo final
abaixo.

Decisões de implementação:
- **Schema**: `users.twoFactorEnabled` (opt-in, por usuário — afeta todo
  login futuro em qualquer dispositivo); `sessions.isTwoFactorSession` (por
  linha de sessão, nunca por usuário — é o ponto crítico pedido
  explicitamente: um segundo dispositivo não pode herdar a autenticação do
  primeiro); nova tabela `two_factor_codes` (`userId` UNIQUE, um código
  pendente por vez, `id` é UUID aleatório — não hash do código, porque um
  código de 6 dígitos colidiria entre usuários se usado como chave). Migração
  `0008_wet_tiger_shark.sql`, só aditiva, sem prompt interativo.
- **Duas políticas de sessão coexistindo em `auth/session.ts`**: padrão de 30
  dias (decisão #18, Etapa 2, **inalterado** para sessões sem 2FA) e 24h
  rolantes (decisão #41, só para sessões com `isTwoFactorSession: true`).
  `validateSessionToken` lê o flag da própria linha da sessão pra escolher a
  política — não existe um "modo 2FA global" em lugar nenhum.
- **Três prazos distintos, documentados separadamente pra não confundir**:
  validade do código de 2FA em si (10 min, `twoFactor.ts`), cooldown de
  reenvio do código de 2FA (60s — é um código de login, usuário está
  esperando na tela), validade da sessão pós-2FA (24h rolantes, acima).
- `POST /login`: senha certa + `twoFactorEnabled` → gera código, envia por
  email (stub), responde `{twoFactorRequired: true, userId}` **sem** criar
  sessão. `userId` só é devolvido depois da senha já ter sido validada — sem
  a senha certa, um atacante nunca chega nessa resposta.
- `POST /verify-2fa`: consome o código (uso único, `userId` + `code` no
  corpo), cria a sessão com `twoFactor: true`.
- `POST /resend-2fa`: mesma função de criação de código, respeita o cooldown
  de 60s (429 + `retryAfterSeconds` se pedir de novo cedo demais).
- `POST /two-factor/toggle` (requireAuth): liga/desliga o opt-in do usuário
  autenticado.

**Teste obrigatório multi-dispositivo (pedido explicitamente pelo fundador,
critério de parada se falhasse) — passou:**
1. Sessão A (cookie jar 1): login → `twoFactorRequired`, código real extraído
   do log do stub, `verify-2fa` → sessão criada, `is_two_factor_session = t`,
   `expires_at` ~24h à frente (confirmado via `psql`).
2. Sessão B (cookie jar 2 **separado**, mesmo usuário): login **enquanto a
   sessão A ainda estava válida dentro da janela de 24h** → respondeu
   `twoFactorRequired: true` normalmente, **exigiu o código de novo**. Não
   houve nenhum atalho/herança da autenticação da sessão A.
3. Confirmado que a sessão A continuou válida e intacta depois do login da
   sessão B (a geração do código novo pra B não afeta a sessão já criada de
   A).
4. Sessão B completou o próprio `verify-2fa` com o próprio código → segunda
   sessão criada, também `is_two_factor_session = t`, também 24h — duas
   linhas independentes em `app.sessions` pro mesmo `user_id`, confirmado via
   `psql`.

Outros testes com curl real: usuário sem 2FA ativo faz login normal (sessão
direta, `is_two_factor_session = f`, ~30 dias — política padrão intacta);
código errado → 400; resend antes do cooldown → 429 com `retryAfterSeconds`.
Dado de teste limpo do banco ao final.

### Tarefa 12 — Reenvio de verificação de cadastro

Status: ✅ concluída. Mesma branch `feat/etapa5-2fa-email` — resolve a
pendência 2 do resumo final abaixo.

- `resendEmailVerificationToken` em `auth/emailVerification.ts`: busca token
  pendente por `userId` (o `id` da tabela é hash do token, não dá pra buscar
  por ele sem conhecer o token) — se existir e o cooldown de 24h não tiver
  passado, retorna `retryAfterSeconds`; senão apaga o antigo e cria um novo.
- `POST /v1/auth/resend-verification`: **decisão explícita do fundador de
  divergir do padrão anti-enumeração do forgot-password** — aqui a resposta é
  clara (404 se a conta não existe, 400 se já verificada, 429 com
  `retryAfterSeconds` se em cooldown), não uma mensagem genérica. Faz sentido
  porque o signup já revela via 409 se o email existe; uma resposta vaga
  aqui não protegeria nada, só pioraria a UX.

Testado com curl real: email desconhecido → 404; conta já verificada → 400;
pedido imediatamente após o signup (que já envia um) → 429 com
`retryAfterSeconds: 86400`. Dado de teste limpo do banco ao final.

### Validação da Fase 2

`typecheck`, `build` e `lint` limpos em `apps/api` (workspace único afetado —
nenhuma mudança em `apps/web` nesta fase, frontend de 2FA/reenvio fica como
próximo passo). Testes funcionais acima cobrem os três fluxos pedidos:
login com 2FA ativo, reenvio de verificação respeitando o cooldown, e sessão
seguindo a regra de 24h rolantes por dispositivo — incluindo o teste
obrigatório multi-dispositivo, que passou sem indício de herança de
autenticação entre sessões.

## Resumo final da sessão

Fila completa: 10/10 tarefas concluídas (tarefa 8 com uma pendência
explicitamente documentada — 2FA). 9 branches empilhadas, cada uma commitada
e pushada para o `origin`, nenhuma PR aberta, nenhum merge feito, `main`
nunca tocada diretamente — exatamente como pedido.

Pendências reais deixadas registradas (não escondidas):
1. ~~**2FA** (tarefa 8) — nem TOTP nem código por email~~ **resolvido na
   Fase 2** (ver acima): 2FA por email implementado (tarefa 11); TOTP segue
   deliberadamente sem escopo (decisão #40 do plano mestre).
2. ~~**Reenvio de verificação de email** (tarefa 2) — não construído~~
   **resolvido na Fase 2** (ver acima, tarefa 12): cooldown de 24h por
   usuário.
3. **Texto legal real de Termos de Uso/Privacidade** (tarefa 2) — checkbox
   funcional, mas sem conteúdo jurídico real por trás (não fabriquei texto
   legal). Registrado no plano mestre (§4.9) como não-bloqueante para o beta
   fechado, prioridade baixa por ora.
4. Nenhum campo de onboarding-cliente chegou a `bob-engine` em nenhum
   momento — verificado explicitamente via `grep` na tarefa 4, não só por
   inspeção visual.
5. `services/bob-engine` não foi tocado em nenhuma tarefa — confirmado por
   `git status`/`git diff` a cada branch, zero arquivos daquele diretório
   apareceram em qualquer commit desta sessão.
