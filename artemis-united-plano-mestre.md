# Artemis United + BoB — Plano Mestre do Projeto

> Documento vivo. Preenchido incrementalmente, vertente por vertente, com decisões pressionadas e justificadas — não um wishlist.
> Status: 🟢 Fechado | 🟡 Parcial | 🔴 Em aberto

---

## 1. Arquitetura 🟡

**Decidido:**
- Monorepo com Turborepo, hospedado no GitHub
- Estrutura: `apps/web` (Artemis United), `apps/api` (BFF), `services/bob-engine` (motor de underwriting isolado)
- `bob-engine` não conhece o conceito de "usuário Artemis" — recebe dados financeiros, devolve score/recomendação
- `packages/shared-types` para contratos de API compartilhados

### 1.1 Contrato de API: REST, não SOAP

SOAP fica fora — é XML verboso, contrato rígido via WSDL, geração de integração bancária que hoje só sobrevive em sistemas legados. Não há racional para adotar em um projeto novo em 2026.

**Proposta: REST + JSON, contract-first via OpenAPI 3.x**
- `packages/shared-types` deixa de ser só tipos TS soltos e passa a ser gerado a partir de um `openapi.yaml` único — API e web consomem o mesmo contrato, sem drift entre front e back.
- Versionamento por path: `/v1/assessments`, não por header — mais simples de debugar e de expor futuramente a parceiros B2B (bancos vão preferir isso).
- Endpoints centrais do `bob-engine` (rascunho, a refinar):
  - `POST /v1/assessments` — recebe snapshot financeiro (DRE + dívida atual), devolve recomendação de capital ótimo + score
  - `GET /v1/assessments/{id}` — recupera assessment já calculado
  - `POST /v1/assessments/{id}/refine` — envia dados adicionais para refinar uma recomendação existente

### 1.2 Modelagem de dados (proposta inicial)

Schema `app` (dados do usuário/negócio, propriedade do `api`):
- `users` — identidade, credenciais, contato
- `businesses` — dados do negócio, 1:1 ou 1:N com `users` (permitir múltiplos negócios por usuário no futuro, mesmo que V1 trave em 1)
- `financial_statements` — snapshots versionados do DRE (nunca sobrescrever — cada atualização gera nova linha com timestamp, é histórico que alimenta o BoB)
- `institution_connections` — vínculo do usuário com instituições financeiras conectadas (Plaid/Open Finance — ver 1.3)

Schema `bob` (propriedade do `bob-engine`, alimentado via API, não acesso direto a `app`):
- `assessments` — cada rodada de cálculo: inputs recebidos, outputs (score, capital ótimo, confiança), timestamp, e **parâmetros de segmentação usados** (ramo/setor)
- `assessment_refinements` — histórico de dados adicionais pedidos/recebidos por assessment
- `institution_offers` — ofertas de crédito de terceiros usadas nas comparações (cache local, não fonte de verdade)
- `assessment_outcomes` — **nova, crítica para evolução futura**: registra o que aconteceu depois da recomendação (usuário tomou o crédito sugerido? em qual instituição? houve inadimplência? negócio segue ativo N meses depois?). Sem essa tabela, não existe caminho para modelo aprendido no futuro — é o dado de "resultado" que falta para qualquer ML de crédito funcionar. Fica vazia/pouco populada no início, mas o schema precisa existir desde o V1.

Ponto de disciplina: `bob-engine` nunca faz `JOIN` direto nas tabelas de `app`. Ele recebe payload via API e persiste só o que é dele. É isso que mantém a fronteira real, não só de código.

### 1.3 Conexões externas — duas integrações diferentes, não uma

Você pediu duas coisas que parecem parecidas mas são **categorias de problema diferentes**:

**(a) Conectar a apps financeiros do usuário (tipo Guiabolso)** — isso é **agregação de conta bancária** (account aggregation / open banking). Nos EUA o equivalente ao Guiabolso é resolvido por provedores como **Plaid**, **MX** ou **Finicity (Mastercard)** — eles fazem a ponte com milhares de bancos e devolvem transações via uma API só. Isso é uma integração técnica direta: você assina Plaid, integra uma vez, e tem acesso a saldo/transações de qualquer banco que o usuário conectar. **Recomendo Plaid** — é o padrão de mercado nos EUA, documentação madura, e tem produto específico para exatamente esse caso (`Transactions`, `Assets`).

**(b) Simulações externas de outras instituições financeiras (comparação de ofertas)** — isso **não é uma integração técnica simples**. Não existe um "Plaid de taxas de crédito" universal — cada instituição que você quiser comparar precisa de parceria própria ou de um agregador de originação de crédito B2B (existem no mercado americano, a pesquisar caso a caso). **Isso é trabalho de parceria comercial, não só engenharia** — sinalizo para não subestimar o esforço achando que é "só conectar uma API".

**Decidido**: Plaid fica fora do V1 — entra como projeto adicional, depois que o B2C provar tração com dados inseridos manualmente via DRE. Reduz escopo de integração externa no lançamento inicial.

### 1.4 Estratégia de autenticação (três problemas, não um)

Você propôs "API Key ou proxy reverso" — vou separar em três camadas, porque são decisões independentes:

| Camada | Quem autentica | Proposta |
|---|---|---|
| Usuário final → `api` | Pessoa logando no Artemis United | Sessão via token opaco (não JWT) — hash SHA-256 armazenado em tabela `sessions` no Postgres, cookie httpOnly, validação e renovação de expiração no servidor (padrão Lucia, implementado manualmente, sem dependência de lib) |
| `api` → `bob-engine` | Serviço interno chamando serviço interno | Rede privada do Railway/Render (não exposto à internet) + shared secret simples no header — não precisa de mTLS no estágio atual |
| Futuro parceiro B2B (banco) → `bob-engine` | Terceiro externo | API Key por cliente, com rate limiting, atrás de um API Gateway/reverse proxy (aqui sua ideia de proxy reverso encaixa certo) |

O proxy reverso faz mais sentido como fronteira do B2B futuro, não como mecanismo de auth do usuário comum. Quando chegar a hora de vender o `bob-engine` a bancos, um gateway na frente do `bob-engine` já isolado resolve rate limiting, API keys por cliente e billing de uso — sem tocar no código do motor.

---

## 2. Segurança 🟡

**Decidido:**
- Senha local: 8+ caracteres, numeral, caractere especial, maiúsculas e minúsculas — nota técnica: guidelines atuais do NIST (800-63B) recomendam priorizar comprimento sobre complexidade forçada (regras de complexidade levam a padrões previsíveis tipo "Senha123!"). Mantenho sua regra por ser padrão de mercado reconhecível, registro como ponto revisável.
- 2FA opcional: **decidido na Etapa 5 (jul/2026)** — único método do V1 é código por email; TOTP (app autenticador) fica para trabalho futuro, ainda sem escopo definido (ver Seção 4.9).
- Classificação de dados: tudo tratado como sensível, criptografia em repouso e em trânsito — sensato como default conservador. Marcado como revisável, conforme pedido.
- Compliance: EUA, sem operação de crédito própria no início.

### 2.1 Compliance — o que provavelmente se aplica

Mesmo sem originar crédito, vocês coletam e processam dados financeiros pessoais desde o V1 — isso já aciona obrigações. Pesquisa mais aprofundada (julho de 2026) refinou o que já estava aqui e adicionou um item que não estava mapeado:

- **GLBA (Gramm-Leach-Bliley Act)** — risco mais concreto do que uma menção genérica: a FTC já enquadrou empresas de software que não emprestavam dinheiro, mas cujo serviço "facilitava" operação financeira de terceiro (caso Dealerbuilt), sob a definição ampla de "instituição financeira". O BoB comparando/recomendando crédito se encaixa nesse padrão. Se aplicável, exige programa de segurança da informação por escrito, aviso de privacidade ao consumidor, e notificação de violação à FTC em até 30 dias se 500+ clientes forem afetados.
- **NY SHIELD Act** — não estava mencionado antes; é provavelmente o mais diretamente aplicável desde o V1, já que não depende de limiar de receita ou volume (diferente da CCPA). Exige salvaguardas razoáveis para dado privado de residente de NY, com regime reduzido para pequena empresa (menos de 50 funcionários, menos de US$3M de receita anual, menos de US$5M em ativos) — provavelmente cobre a Artemis agora, mas ainda exige programa documentado.
- **FCRA (Fair Credit Reporting Act)** — condicional: o gatilho não é o BoB calcular a recomendação, é se ela for **fornecida a um terceiro** (banco parceiro) para decisão de crédito dele — cenário da Etapa 2/B2B (decisão 14), não do V1 atual.
- **Licenciamento estadual de correspondente/corretor de crédito** — item novo. Em NY há legislação em tramitação para exigir licença até de quem só divulga (sem originar) empréstimo de terceiro. Na Flórida, arranjar empréstimo não garantido não exige licença de corretor hoje, mas negociar hipoteca exige. Toca direto na comparação de ofertas (decisão 10, seção 4.8).
- **CCPA/CPRA** — correção da nota anterior: provavelmente **não** se aplica ainda. Limiares 2026: receita acima de US$26,625M, OU 100 mil+ consumidores da Califórnia, OU 50%+ da receita de venda de dado. Um estágio inicial focado em NY/Miami dificilmente bate qualquer um agora — reavaliar se/quando expandir para CA.

Briefing completo, organizado por área com perguntas específicas para a reunião, em `compliance-brief-2.1.md` (fora deste documento).

Isso continua não sendo algo para eu resolver sozinho no chat — recomendo revisão com advogado especializado em fintech antes do lançamento, mesmo em beta fechado. O brief acima organiza a conversa; não substitui a revisão profissional. Deixo marcado como pendência formal, não como resolvido.

### 2.2 Segurança de fronteira

Proposta: Cloudflare na frente de tudo (DNS + WAF + proteção DDoS básica, tier gratuito já ajuda) + a separação de rede privada Railway/Render entre `api` e `bob-engine` já decidida em Arquitetura. Cobre a borda sem introduzir um gateway dedicado antes da hora (fica para quando o B2B for real).

### 2.3 Gestão de segredos — em aberto, como pedido

### 2.4 Modelo de ameaças (proposta inicial, V1)

| Ameaça | Vetor | Mitigação proposta |
|---|---|---|
| Credential stuffing / força bruta no login | Login recorrente | Rate limiting por IP+email, bloqueio progressivo, 2FA disponível |
| Vazamento de dados financeiros em repouso | Breach do banco | Criptografia em repouso (nativa Neon/Postgres), least-privilege de acesso ao DB |
| Interceptação em trânsito | MITM | TLS obrigatório ponta a ponta, HSTS |
| Token do Plaid/Open Finance comprometido | Vazamento de credencial de terceiro | Tokens nunca armazenados em texto puro; escopo mínimo de permissão solicitado ao Plaid |
| Abuso de API por parceiro B2B (futuro) | Uso indevido de API key | Rate limiting + monitoramento de uso por cliente no gateway |
| Exposição de dado sensível em logs/analytics | Log acidental de PII financeira | Redação automática de campos sensíveis antes de qualquer log ou evento de analytics |
| Acesso indevido interno (você mesmo, futuro funcionário) | Insider | Acesso a prod restrito, sem acesso direto a dados de produção fora de necessidade operacional |

---

## 3. Infraestrutura 🟡

**Decidido:**
- `web` → Vercel | `api` + `bob-engine` → Railway/Render (serviços separados) | DB → Neon (Postgres, branching por ambiente)
- Ambientes: dev (local/docker-compose) → staging → prod, mapeados em branches de infra e branches de banco
- CI/CD: GitHub Actions + Turborepo (cache remoto via Vercel)
- Segredos: env vars nativas de cada plataforma por ora; Doppler/Vault fica como débito técnico consciente

### 3.1 Observabilidade — proposta

Sentry (erros, front e back — plano gratuito cobre o estágio atual, integração nativa com Vercel) + Better Stack (ex-Logtail) para logs centralizados de `api` e `bob-engine`. Combinação leve, sem operar infraestrutura própria de observabilidade agora.

### 3.2 Backup e disaster recovery — em aberto, como pedido

### 3.3 Estratégia de rollback de deploy — proposta

- `web` (Vercel): rollback instantâneo nativo — Vercel mantém deployments anteriores prontos, é um clique.
- `api` / `bob-engine` (Railway/Render): redeploy do build/imagem anterior via histórico de deploys da plataforma.
- Banco (Neon): regra dura — migrações de schema sempre backward-compatible (nunca remover coluna no mesmo deploy que para de usá-la; sempre dois passos). Isso permite rollback de código sem rollback de banco na maioria dos casos.

---

## 4. Jornadas do Usuário 🟡

### 4.1 Primeiro acesso (cadastro)
Nome, Sobrenome, Email, Telefone, Tipo de negócio (string), Ramo (lista suspensa), Senha, Repetir senha.
Sugestão adicional: checkbox de aceite de Termos de Uso/Privacidade (necessário para compliance) e verificação de email antes de liberar acesso completo.

### 4.2 Login recorrente
Email + senha. Sugestão adicional: fluxo de "esqueci minha senha".

### 4.3 Onboarding — Dados do cliente
Data de nascimento, Endereço residencial (padrão EUA), Estado civil, Filhos?, Nº de pessoas na casa (opcional), Telefone alternativo.

### 4.4 Onboarding — Dados do negócio
Nome do negócio, Endereço do negócio (autofill se igual ao residencial), Anos de negócio, Anos de experiência no ramo, Telefone (opcional), Nº de empregados.

### 4.5 Demonstrativo de Resultados — proposta de estrutura

Ponto central do produto — é o dado que alimenta o BoB. Proposta com separação explícita negócio/pessoal, somando no final (é a soma que reflete capacidade real de pagamento de um microempreendedor, que mistura os dois mundos):

**Bloco Negócio**
- Receitas: Faturamento bruto, Outras receitas do negócio
- Custos diretos: Custo de mercadoria/insumos
- Despesas operacionais: Aluguel do local (se distinto de casa), Mão de obra/salários, Utilidades do negócio, Marketing, Transporte/entrega, Manutenção de equipamentos, Impostos e taxas do negócio, Outras despesas
- Dívidas do negócio: Parcelas de empréstimos/financiamentos
- = Resultado do Negócio

**Bloco Pessoal/Familiar**
- Renda extra: Salário formal paralelo, Outro negócio/freelance, Benefícios/auxílios, Outras rendas
- Gastos pessoais: Moradia (se distinta do negócio), Alimentação, Transporte pessoal, Saúde, Educação, Dívidas pessoais (cartão, empréstimos), Outras despesas
- = Saldo Familiar

**= Saldo Consolidado (Negócio + Pessoal)** — o número que o BoB efetivamente usa para capacidade de pagamento real, não só o resultado do negócio isolado.

Essa jornada fica acessível a qualquer momento via Configurações, como definido.

### 4.6 Tela inicial (Dashboard)
Faturamento mês atual, Acumulado ano (receitas), Despesa mês atual, Acumulado ano (despesas), Variações, Saldo — mantidos.
Indicadores adicionais sugeridos: Margem líquida (%), Índice de endividamento (dívida/receita), Semáforo de saúde financeira (verde/amarelo/vermelho — baixa fricção cognitiva para o ICP).
Chat com o BoB, como definido.

### 4.7 Configurações
Dados Pessoais, Dados do Negócio, Demonstrativo de Resultados, Segurança, Logout — mantidos, com CRUD por seção.
Seções adicionais sugeridas: Instituições conectadas (gerenciar conexões Plaid/Open Finance), Notificações, Privacidade e Dados (exportar/excluir dados — provavelmente exigido por CCPA se aplicável), Idioma (dado o ICP imigrante), Ajuda/Suporte.

### 4.8 Conectar a instituições financeiras
Busca, filtro (online/próximas), ordenação (relevância/menor taxa/A-Z), instituição selecionada, lista com range de taxas — mantidos.
Sugestão: indicador de status por instituição (conectado/pendente/erro) e mensagem explícita de segurança no fluxo (ex: "não guardamos sua senha bancária") — para esse ICP, confiança na conexão bancária é o maior ponto de fricção/abandono.

### 4.9 Pendências e decisões de UX/Fluxo (Etapa 5)

Levantadas durante a implementação das seções 4.1–4.7 (sessão de jul/2026).
Detalhamento técnico e estado exato do código em `etapa5-progress.md` no
repositório.

**Decidido:**
- 2FA (V1): único método é código por email — TOTP (app autenticador) fica
  para trabalho futuro, ainda sem escopo definido. Resolve a ambiguidade da
  nota original da Seção 2 ("código por email ou app autenticador").
- Reenvio de verificação de cadastro: cooldown de 24h entre pedidos, por
  usuário — evita abuso de envio, mesmo canal (stub) da verificação original.
- Validade de sessão pós-2FA: 24h rolantes a partir do momento da
  autenticação, armazenada **por sessão/dispositivo**, nunca como estado
  global do usuário — cada sessão nova (cada login em cada
  dispositivo/navegador) exige o código de 2FA de forma independente, mesmo
  que outro dispositivo do mesmo usuário já esteja autenticado dentro da
  janela de 24h. Evita que um segundo dispositivo herde a autenticação do
  primeiro.

**Em aberto:**
- Texto legal real de Termos de Uso/Política de Privacidade — checkbox de
  aceite funcional (bloqueia submissão de cadastro, validado no servidor),
  mas sem conteúdo jurídico real por trás. **Não bloqueia lançamento em beta
  fechado** — prioridade baixa por ora, foco em técnico/produto; revisar com
  advogado especializado antes do lançamento público (mesma pendência já
  sinalizada na Seção 2.1 para compliance geral).

---

## 5. Design UX/UI 🟢

### 5.1 Paleta de cores e fundamentos visuais (extraído da logo Artemis)

Cores extraídas diretamente dos pixels da logo (não estimativa visual):

| Token | Hex | Papel |
|---|---|---|
| `color-primary` (Navy) | `#004783` | Texto de marca, headers, navegação, botões primários |
| `color-secondary` (Verde) | `#40A142` | Ações positivas, estado "saudável" do semáforo financeiro (seção 4.6) — reaproveita a cor da marca de propósito |
| `color-accent` (Dourado) | `#F8B61A` | CTA/destaque interativo — reservado só para isso, não usar como estado de alerta (ver abaixo) |
| `color-background` | `#FFFEFA` | Fundo principal — off-white, conforme a logo, não branco puro |

**Neutros (não estão na logo, propostos para harmonizar):**

| Token | Hex | Papel |
|---|---|---|
| `color-text-primary` | `#14243A` | Texto principal (navy escurecido, não preto puro — mantém identidade) |
| `color-text-secondary` | `#5C6B7A` | Texto secundário/legendas |
| `color-border` | `#E2E6EA` | Bordas, divisores |
| `color-surface` | `#F7F8FA` | Fundo de cards, sutilmente distinto do fundo geral |

**Estados semânticos (dashboard, formulários, alertas):**

| Token | Hex | Papel |
|---|---|---|
| `state-success` | `#40A142` (= `color-secondary`) | Semáforo "saudável", confirmações |
| `state-warning` | `#D98E2E` | Semáforo "atenção" — **deliberadamente diferente do dourado de CTA** para não confundir "clique aqui" com "cuidado". Uso moderado e pontual (validação, alertas reais) — nunca decorativo ou repetido pela interface |
| `state-danger` | `#C0392B` | Erros, semáforo "crítico" — não existe na marca, proposto para harmonizar com o restante da paleta |
| `state-info` | `#004783` (= `color-primary`) | Avisos neutros |

**Tipografia — ponto de atenção:** a fonte cursiva/script da logo funciona bem só como wordmark (topo do app, tela de login) — é ilegível em texto de interface a tamanhos pequenos. Proposta: uma sans-serif neutra e legível para toda a UI (ex: Inter ou similar), reservando a fonte da logo exclusivamente para o nome "Artemis United" em si.

### 5.2 Princípios de Design

**Decidido:**
- Confiança se ganha explicando o "porquê" no momento do pedido, não nos Termos de Uso — toda coleta de dado sensível tem microcopy visível sem clique extra
- Um bloco de decisão por tela — DRE (4.5) implementado como wizard incremental com salvamento parcial por bloco, não formulário único
- Estado do sistema sempre explícito (loading/salvo/erro), erros em linguagem simples com ação de recuperação clara
- Redundância de sinal: semáforo financeiro (4.6) sempre ícone + cor, nunca cor isolada
- Jargão financeiro (WACC, coverage ratio, ND*) nunca aparece na UI, nem em tooltip — sempre tradução em linguagem cotidiana; evitar CAIXA ALTA em rótulos
- Mobile-first explícito: CTA primário ancorado na zona do polegar em mobile, alvo de toque mínimo 44×44px, zero interação dependente de hover, orçamento de performance consciente de banda limitada
- Regra de contraste de CTA: botão dourado (#F8B61A) sempre com texto navy (#004783) — nunca branco (contraste 1,8:1, falha WCAG AA). Botão verde (#40A142) com texto branco só em texto grande/bold; caso contrário, também navy

### 5.3 Wireframes

**Decidido:**
- 8 telas centrais (cadastro, onboarding-cliente, onboarding-negócio, DRE, dashboard, chat BoB, configurações, conexão bancária) wireframadas e revisadas por acessibilidade, produzidas via Claude Code + Designpowers a partir do brief e DESIGN.md desta seção. Specs completas em `docs/designpowers/wireframes/` no repositório
- Chassi de navegação confirmado: tab bar fixa (Início · BoB · Ofertas · Mais) para telas hub; stepper macro + contador "Bloco X de N" para telas lineares (Cadastro, Onboarding, DRE)
- DRE tem modo de reentrada distinto quando acessado via Configurações — botão primário, sem stepper, nunca reapresenta UI de "cadastro"
- DRE modelado como 6 telas de bloco único + resumo, não formulário agrupado — aplicação literal do princípio "um bloco por tela". Aceito para V1; taxa de abandono real fica para validação em teste de usuário (risco monitorado, não resolvido)
- Wordmark "Artemis United": tratado como asset de imagem vetorial fixo, nunca como fonte de sistema — origem em desenho do fundador, sem correspondência com tipografia licenciada. SVG final gerado (`artemis-logo-wordmark.svg`), cores travadas nos tokens do design system

**Débito de design rastreado:** 4 itens de Configurações (Segurança, Notificações, Privacidade e Dados, Ajuda/Suporte) ainda sem tela própria — fora do escopo desta rodada, entra em planejamento futuro antes de virarem navegação real

### 5.4 Sistema de Componentes

**Decidido:**
- Fundação de tokens e componentes formalizada em `DESIGN.md` (raiz do projeto) — cores, tipografia, espaçamento, arredondamento e componentes-base (button-cta, button-primary, button-success, input-field, card, status-success/warning/danger)
- Regra de contraste do CTA dourado implementada a nível de token (`button-cta.textColor` fixo em navy) — elimina risco de decisão divergente por tela
- Contraste de `text-secondary` (#5C6B7A) verificado: 5,42:1 sobre fundo neutro, 5,14:1 sobre surface — passa AA em ambos
- Voz do BoB no chat definida (calorosa, direta, linguagem simples, não-julgadora)
- Idioma omitido inteiramente de Configurações no V1, não mostrado desabilitado

### 5.5 Idioma e Acessibilidade

**Decidido:**
- V1 lançado apenas em inglês; toda string de UI externalizada via lib de i18n desde o início (arquitetura pronta, sem UI de seleção ainda)
- Espaço de "Idioma" em Configurações (4.7) reservado no wireframe, oculto até V2
- Expansão futura de idioma: escolha manual no primeiro acesso, nunca auto-detecção
- Nível alvo de acessibilidade: WCAG 2.1 AA — contraste mínimo, zoom sem quebra de layout, HTML semântico + labels, navegação por teclado, alt text em ícones funcionais

---

## 6. Critérios de Aceitação 🟡

### 6.1 BoB: caminho de evolução de fórmula para modelo aprendido (revisado)

V1 não é "fórmula para sempre" — é a primeira etapa de um caminho de evolução necessário, porque não existe ML de crédito sem histórico de resultado (outcome), e ninguém tem esse histórico no dia 1.

**Etapa 1 (V1) — fórmula determinística segmentada por setor**
- Motor de cálculo (WACC, coverage ratio, ND* ótimo) aplicado sobre o DRE, com parâmetros/benchmarks que variam por `ramo` — barbearia e padaria não usam os mesmos parâmetros, mesmo com DRE parecido. Isso já captura diferença estrutural de setor sem precisar de ML.
- A camada de "IA" (Claude API) traduz o resultado em linguagem natural no chat — não gera o número.
- Toda recomendação logada com inputs exatos, parâmetros de segmentação usados, e nível de confiança (completude dos dados).

**Etapa 2 (V2, futuro) — modelo aprendido sobre outcome real**
- Assim que houver volume suficiente de `assessment_outcomes` (usuário tomou o crédito? pagou? negócio seguiu ativo?), um modelo estatístico/ML pode aprender pesos reais a partir de resultado real, em vez dos pesos definidos por fórmula/segmentação manual.
- Fatores pessoais (ex: composição familiar) podem, em tese, correlacionar com risco — mas **qualquer fator dessa natureza exige revisão legal específica antes de entrar em produção**: nos EUA, ECOA (Equal Credit Opportunity Act) restringe uso de estado civil/status familiar em decisão de crédito. Tamanho de família como componente de despesa (o que já está no DRE pessoal) é diferente de usar "tem filhos" como fator de risco direto — a linha entre os dois precisa de advogado, não de engenharia.

**Requisito de arquitetura que isso implica**: a tabela `assessment_outcomes` (seção 1.2) precisa existir desde o V1, mesmo vazia — é o que torna a Etapa 2 possível sem redesenho de dados depois.

**Critério de aceitação proposto para a recomendação do BoB (V1):**
- Fórmula determinística e segmentada por setor, documentada e testável (mesmo DRE + mesmo setor = mesmo output, sempre)
- Recomendação sempre acompanhada de nível de confiança, calculado pela completude dos dados informados
- Sistema indica quais dados adicionais aumentariam a confiança
- Toda recomendação logada com inputs, segmentação usada, e hook pronto para registrar outcome futuro

### 6.2 CRUD
Consistência de dados do usuário/negócio entre front, back e banco — mantido como critério.

### 6.3 Outros critérios propostos
- Todo fluxo crítico (cadastro, DRE, conexão bancária, recomendação) tem taxa de erro monitorada e testes automatizados cobrindo caminho feliz + principais casos de borda
- Nenhum dado financeiro sensível trafega ou é logado sem redação/criptografia (rastreável ao modelo de ameaças da seção 2.4)

---

## 7. Dados e Analytics 🟡

**Decidido:**
- Ferramenta: PostHog para analytics comportamental (funil, DAU/MAU, replay), tier gratuito
- Separação operacional/analítica: comportamental via PostHog (nunca toca o Postgres de produção); métricas de negócio (confiança média, distribuição de score) via consulta direta ao schema `bob` no Neon, usando role `metabase_readonly` (somente leitura, sem acesso a `app`) + Metabase local via docker-compose — sem custo de hospedagem adicional neste estágio
- Limites de dado sensível impostos a nível de tipo, não revisão manual: nenhum valor financeiro exato em propriedade de evento (sempre faixa/bracket), nenhum campo de PII (nome, email, endereço — só ID interno), chat do BoB nunca reenviado cru a terceiro
- Pacote `@artemis-united/analytics` implementado — união de eventos tipada + função `track()` — torna estruturalmente impossível o vazamento acima acontecer por engano
- PostHog inicializado em `apps/web`; migration da role `metabase_readonly` escrita (aplicação em staging/prod é passo manual pendente)
- Dois acréscimos à lista de eventos original: tracking por bloco dentro do DRE (`dre_block_completed`/`dre_block_abandoned`, com índice do bloco), e `confidence_level` como propriedade do evento de assessment concluído

**Eventos a rastrear (lista original + sugestões adicionais):**
- Funil de criação de conta (cada etapa do cadastro, com drop-off por etapa)
- DAU/MAU
- Registro de dados (cliente, negócio, DRE completados) — tempo até completar cada bloco, sinal de fricção
- Interações com BoB, categorizadas — dúvida sobre recomendação, pedido de simulação, dúvida geral de produto
- Taxa de sucesso/erro na conexão com instituições financeiras
- Adoção de 2FA
- Recomendação → ação (usuário clicou em alguma oferta/instituição sugerida?)
- Erros por jornada (sinal de UX quebrada, não só bug técnico)
- Captação de sinais qualitativos/subjetivos via chat com o BoB (categorizado, uso futuro em refinamento de modelo — ver 6.1)

**Pendências rastreadas (não bloqueiam o fechamento desta seção):**
- Migration da role `metabase_readonly` ainda não aplicada contra Neon staging/prod
- Eventos ainda não plugados em tela real — `apps/web` só tem o scaffold padrão do Vite; conecta quando as telas da seção 5.3 forem implementadas em código
- `docs/architecture.md` do repositório de código precisa registrar os dois presets de tsconfig (`node.json` vs `browser.json`) — granularidade de implementação, não decisão de produto

---

## 8. Ciclo de Vida do Produto 🔴

**Métricas propostas (originais + adicionais):**
- Quantas integrações geraram recomendação de crédito
- Quantos clientes direcionados a outras instituições
- Retenção 30/60/90 dias
- % de usuários que completam onboarding inteiro (cliente + negócio + DRE)
- Confiança média das recomendações ao longo do tempo (sinal de se a base de dados está melhorando)
- % de instituições sugeridas que o usuário efetivamente conecta

Fases, critérios de saída, roadmap pós-MVP — seguem em aberto (síntese final, feita por último).

---

## Log de decisões (referência rápida)

| # | Decisão | Vertente | Racional resumido |
|---|---|---|---|
| 1 | PWA/web responsivo, não nativo | Arquitetura | Menor fricção de aquisição, ciclo de iteração rápido |
| 2 | `bob-engine` isolado com fronteira de API limpa | Arquitetura | Venda B2B futura vira "trocar quem chama a API", não refactor |
| 3 | Turborepo | Arquitetura | Integração nativa com Vercel, cache remoto, pipeline multi-pacote |
| 4 | Vercel (web) + Railway/Render (api, bob-engine) | Infraestrutura | Gerenciado, rápido de configurar, serviços deployáveis independentemente |
| 5 | Neon em vez de Supabase | Infraestrutura | Postgres puro, sem acoplamento a ecossistema proprietário; branching por ambiente |
| 6 | Segredos: env vars nativas por ora | Infraestrutura | Doppler/Vault só compensa com múltiplos consumidores externos (ex: banco B2B) |
| 7 | REST + OpenAPI, não SOAP | Arquitetura | SOAP é padrão legado; REST/JSON é o que parceiros B2B (bancos) esperam hoje |
| 8 | Auth em 3 camadas (JWT usuário / secret interno / API key B2B) | Arquitetura + Segurança | Cada camada tem ameaça e solução diferentes; misturar gera brecha |
| 9 | Plaid para agregação de contas | Arquitetura | Padrão de mercado nos EUA para o equivalente ao Guiabolso |
| 10 | Comparação de ofertas de terceiros = parceria comercial, não integração simples | Arquitetura | Não existe "Plaid de taxas de crédito" universal — esforço de BD, não só engenharia |
| 11 | BoB V1 = cálculo determinístico, não ML treinado | Critérios de Aceitação | Motor usa fórmulas de finanças corporativas; IA entra só na camada de explicação via chat |
| 12 | Sentry + Better Stack para observabilidade | Infraestrutura | Leve, integração nativa com Vercel/Railway, sem operar infra própria |
| 13 | Plaid confirmado como fora do V1 | Arquitetura | Reduz escopo de integração externa no lançamento; entra depois de tração provada |
| 14 | BoB: fórmula segmentada por setor (V1) → modelo aprendido sobre outcome real (V2) | Critérios de Aceitação + Arquitetura | Não existe ML de crédito sem histórico de resultado; fórmula segmentada já resolve parte da diferenciação por setor sem ML |
| 15 | Tabela `assessment_outcomes` adicionada ao schema `bob` desde o V1 | Arquitetura | Pré-requisito de dado para a evolução a modelo aprendido no futuro, mesmo que vazia no início |
| 16 | Fatores pessoais/familiares em modelo de risco exigem revisão legal (ECOA) antes de implementar | Segurança/Compliance | Uso de status familiar em decisão de crédito é restrito nos EUA; ponto não resolvível só com engenharia |
| 17 | Variáveis subjetivas/heterodoxas como diferencial competitivo do BoB, capturadas via chat | Dados e Analytics + Critérios de Aceitação | Underwriting tradicional não usa esse tipo de sinal; risco de correlação acidental com classe protegida exige atenção redobrada na revisão legal (ver decisão 16) |
| 18 | Autenticação por sessão implementada manualmente (padrão ex-Lucia), sem dependência de lib | Segurança + Arquitetura | Lucia foi descontinuada em 2025 pelo próprio mantenedor, que recomenda implementar o padrão em vez de depender da lib; substitui a proposta original de JWT+refresh por token opaco, mais fácil de revogar |
| 19 | Esqueleto do monorepo escafoldado via Claude Code, push feito ao GitHub (force push, substituindo repo de projeto anterior) | Arquitetura | Escopo apertado (infra apenas, sem UX/telas) para não gerar retrabalho antes da seção 5 fechar |
| 20 | Paleta de cores extraída da logo (Navy #004783, Verde #40A142, Dourado #F8B61A, fundo #FFFEFA) | Design UX/UI | Dourado reservado só para CTA, distinto do âmbar de estado "atenção", para não sobrepor significados |
| 21 | Drizzle ORM em vez de Prisma para schemas app/bob | Arquitetura | Mais leve, tipagem direta em TS, sem engine binária separada; encaixa com isolamento api/bob-engine já decidido |
| 22 | `docs/architecture.md` adicionado ao repositório | Arquitetura | Code inferia schema sem contexto (erro do "BRL" foi sintoma disso); agora sessões futuras partem de decisões documentadas |
| 23 | Correção: campos de auditoria/output adicionados a `bob.assessments` (input_snapshot, sector_segment, recommended_amount, score, confidence_level); currency default corrigido para USD | Arquitetura | Sem esses campos, o critério de aceitação 6.1 (auditoria de recomendação) não era atendido |
| 24 | Migrations aplicadas ao Postgres local — schemas `app` (5 tabelas) e `bob` (4 tabelas) confirmados via `\dt` | Infraestrutura | Primeira validação real de que o desenho de dados funciona de ponta a ponta |
| 25 | Princípios de design formalizados como regras testáveis, não adjetivos | Design UX/UI | "Confiança"/"simplicidade" viram critério verificável por tela |
| 26 | CTA dourado sempre com texto navy, nunca branco | Design UX/UI | Contraste branco/dourado falha WCAG AA (1,8:1); navy/dourado passa (5,25:1) |
| 27 | DRE (4.5) implementado como wizard incremental com salvamento parcial | Design UX/UI | Reduz risco de abandono em formulário longo para ICP com fluência/tempo fragmentados |
| 28 | Regras mobile-first explícitas (zona do polegar, touch target ≥44px, sem hover) | Design UX/UI | "Web responsivo" não garante execução mobile-first; ICP acessa majoritariamente via celular |
| 29 | V1 apenas em inglês, com i18n arquitetado desde o início | Design UX/UI | Reduz escopo de lançamento; evita rewrite quando idiomas adicionais entrarem |
| 30 | Idioma sempre por escolha manual, nunca auto-detecção | Design UX/UI | Controle explícito do usuário é mais alinhado a P1 (confiança) que decisão automática do navegador |
| 31 | Meta de acessibilidade fixada em WCAG 2.1 AA | Design UX/UI | Baseline não-negociável dado o ICP; AAA não se justifica no estágio atual |
| 32 | Chassi de navegação (Hub + Linear + reentrada do DRE) confirmado pelo fundador | Design UX/UI | Resolve a última pendência de 5.3, com adição do modo de reentrada do DRE encontrada em revisão |
| 33 | Wordmark tratado como asset de imagem vetorial, nunca como token de tipografia | Design UX/UI | Origem em desenho do fundador via geração de IA — raster, sem correspondência com fonte licenciada existente |
| 34 | DRE em 6 telas de bloco único + resumo aceito para V1, sem validação real de taxa de abandono | Design UX/UI | Aplicação literal do princípio "um bloco por tela"; risco monitorado, a revisar com dado real de uso |
| 35 | PostHog + Metabase (local via docker-compose) escolhidos para a Seção 7 | Dados e Analytics | Tier gratuito, mesmo padrão leve já usado em observabilidade (Sentry/Better Stack); Metabase local evita custo de hospedagem nesse estágio |
| 36 | Limites de dado sensível em analytics impostos por união de tipos, não revisão manual | Dados e Analytics | Torna estruturalmente impossível vazar PII/valor exato em evento, em vez de depender de disciplina de code review |
| 37 | Role `metabase_readonly` restrita ao schema `bob`, sem acesso a `app` | Dados e Analytics + Segurança | Consistente com a fronteira já decidida entre bob-engine e app (decisão 2); Metabase nunca vê PII por desenho |
| 38 | Tracking por bloco do DRE e `confidence_level` adicionados à lista de eventos | Dados e Analytics | Fecha a lacuna de dado que faltava pra validar o risco monitorado da decisão 34 (abandono no wizard) e alimenta a métrica de confiança já prevista na seção 8 |
| 39 | Preset de tsconfig `browser.json` criado em `packages/config`, separado do `node.json` existente | Arquitetura | NodeNext (pensado pro bob-engine) não é apropriado pra pacote consumido via bundler; correção na raiz em vez de workaround por pacote |
| 40 | 2FA V1 restrito a código por email, TOTP adiado sem escopo definido | Segurança | Resolve a ambiguidade da decisão original (2FA opcional, email OU TOTP) sem comprometer escopo de app autenticador agora |
| 41 | Sessão pós-2FA válida por 24h rolantes, armazenada por sessão/dispositivo, nunca como estado do usuário | Segurança | Evita que um segundo dispositivo herde autenticação de outro; cada sessão nova exige o código de novo, mesmo dentro da janela de outra sessão já válida |
| 42 | Reenvio de verificação de cadastro com cooldown de 24h por usuário | Segurança | Fecha lacuna da Etapa 5 (verificação de email implementada sem reenvio); previne abuso de envio |
| 43 | Recomendação de crédito passa a ser limitada pelo menor entre DSCR-alvo, 2x a receita mensal (parametrizável) e teto absoluto do SBA Microloan (US$50k) | Critérios de Aceitação | DSCR sozinho não tem limitador por escala de receita, e nenhum credor real usa DSCR isoladamente. Campo `recommendationLimiter` registra qual venceu, para auditoria (critério 6.1) |
| 44 | Multiplicador de receita mensal (`REVENUE_MULTIPLIER_CAP`, decisão 43) fixado em 2x | Critérios de Aceitação | Confirmado pelo fundador como valor definitivo; limite superior da faixa de mercado de term loan (1x-2x) — mantido parametrizado (não hardcoded inline) para recalibração futura com dado real de uso |
| 45 | Resend escolhido como provedor de email de produção | Infraestrutura | DX moderna, tier grátis (3k emails/mês), boa deliverability, setup rápido; Ethereal (decisão de sessão anterior) segue como provedor de dev/staging — troca isolada atrás da interface `EmailProvider`, sem tocar nos fluxos de auth |
| 46 | Código de 2FA por email permanece um por usuário, não por dispositivo/sessão | Segurança | Confirmado pelo fundador como comportamento intencional — reduz superfície de força bruta (um único código válido por vez). Segundo dispositivo pedindo código dentro do cooldown de 60s recebe 429, não um código independente |
