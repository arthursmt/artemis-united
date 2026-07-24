# Parâmetros de Segmentação por Setor — Referência para o `bob-engine`

> Documento de apoio à Etapa 3 do Walking Skeleton (DRE mínimo → `bob-engine` → resultado real) e ao critério de aceitação 6.1 do plano mestre ("fórmula determinística segmentada por setor"). Contém levantamento de dados de fontes públicas **e** as decisões de produto fechadas com o fundador em cima desse levantamento (Seção 9) — pronto para orientar a implementação da Etapa 3.
>
> Status: 🟢 Levantamento e decisões de escopo fechados para os 14 setores prioritários do ICP · 🟡 Uso futuro como diferencial de negócio (base de dados proprietária de underwriting) sinalizado para o projeto de ecossistema, não decidido aqui

---

## 1. Propósito e como usar este documento

O plano mestre (seção 6.1) descreve o motor V1 do BoB como "fórmula determinística segmentada por setor" usando WACC, coverage ratio e ND* ótimo — mas nenhum desses parâmetros estava definido em `docs/architecture.md`, `DESIGN.md` ou no próprio plano mestre. Este documento preenche essa lacuna com dados de fontes públicas, filtrados para excluir benchmarks de macroeconomia ou de grandes empresas (ex: dados de empresas listadas em bolsa, índices setoriais agregados por capitalização de mercado) — o pedido explícito foi por parâmetros de **pequenos e microempreendedores**, que é o ICP real do produto.

**O que este documento não é**: não é a fórmula do `bob-engine`, não é código, não é decisão fechada. É a matéria-prima para a conversa que precisa acontecer antes da Etapa 3 do walking skeleton — decidir, com o fundador, quais desses números entram na V1 e com que grau de confiança.

**Regra de fallback (conforme solicitado)**: onde a pesquisa não encontrou parâmetro de referência confiável para um setor, o `bob-engine` deve calcular sem esse parâmetro de segmentação — não inventar um valor. Isso é tratado como parte do aprendizado do sistema (fica registrado no `confidence_level` do assessment, como já previsto na seção 6.1 do plano mestre), não como falha a ser mascarada.

---

## 2. Metodologia e limitações (leia antes de usar os números)

- **Fontes usadas**: agregadores de benchmark voltado a operadores de pequenos negócios (ex: calculadoras/guias setoriais de fornecedores de software para PMEs, relatórios de associações de indústria — National Restaurant Association, NAHB, NALP —, dados de transação da BizBuySell para valuation de pequenos negócios, e reportagens que citam RMA Annual Statement Studies e IBISWorld sem reproduzir a tabela original).
- **Fonte que existe mas não foi acessada diretamente**: a **RMA Annual Statement Studies** é, de longe, a referência mais rigorosa para exatamente este caso de uso — 100+ anos de dados vindos diretamente de demonstrativos financeiros de clientes de bancos membros, cobrindo 700+ indústrias por porte de ativo/faturamento. É paga e licenciada (não há acesso público gratuito), então os números abaixo vêm de fontes secundárias que a citam, não da tabela primária. **Se o orçamento permitir, licenciar a RMA é o upgrade de qualidade mais alto disponível para este dado** — muito acima de refinar os números abaixo.
- **Deliberadamente excluído**: dados tipo Damodaran (NYU Stern) de WACC/beta por setor — são construídos a partir de empresas de capital aberto e não representam a estrutura de capital de um microempreendedor sem acesso a mercado de ações. Também excluídos: índices de commodities, dados de PIB setorial, e qualquer benchmark que misture pequenas e grandes empresas sem segmentar por porte.
- **Qualidade dos dados**: os números abaixo são majoritariamente autodeclarados por operadores ou consolidados por fornecedores de software/consultoria do setor — não são amostra estatística controlada como a RMA. Onde múltiplas fontes convergiam, uso a faixa de consenso; onde divergiam muito, registro a dispersão em vez de forçar um número único.
- **Sem recorte geográfico Nova York/Miami**: benchmark público neste nível de detalhe (margem líquida por setor, por cidade) essencially não existe de forma gratuita — os números são nacionais (EUA). Custo de aluguel/mão de obra em NY e Miami tende a ser acima da média nacional, o que pressiona margem para baixo relativo a esses números — mas não há como quantificar isso por fonte pública sem um estudo próprio.

---

## 3. Achado estrutural: "WACC" não tem dado público disponível para microempresa — e provavelmente não é o insumo certo para o V1

Isto é o achado mais importante deste levantamento, não apenas um item de tabela.

WACC pondera custo de dívida e custo de capital próprio pela estrutura de capital da empresa. Para uma empresa de capital aberto, o custo de capital próprio vem de dados observáveis de mercado (beta, prêmio de risco de mercado). **Para um microempreendedor — o ICP da Artemis — não existe equivalente público**: não há mercado de ações, não há prêmio de risco observável, e a "estrutura de capital" tipicamente não separa dívida de patrimônio na forma como a teoria de finanças corporativas pressupõe (o "capital próprio" de um microempreendedor é, na prática, trabalho e poupança pessoal, não uma classe de ativo precificada).

O que **existe** publicamente e é utilizável:

| Peça da fórmula | Dado disponível | Fonte |
|---|---|---|
| Custo de dívida (proxy de Kd) | Taxas de empréstimo SBA/bancário, ver Seção 4 | SBA, bancos |
| Coverage ratio (piso de aceitação) | DSCR mínimo por tipo de credor, ver Seção 4 | SBA, bancos |
| Sinal de risco por setor (proxy indireto de prêmio de risco) | Taxa de default/inadimplência SBA por setor, ver Seção 4 | Dados agregados de empréstimos SBA |
| Margem líquida típica por setor (capacidade de geração de caixa) | Ver Seção 5, por setor | Múltiplas |

O que **não existe** publicamente e precisa de decisão de produto, não de mais pesquisa:

- Custo de capital próprio por setor para microempresa
- WACC pronto por setor para microempresa
- ND* (nível ótimo de dívida) documentado — isso é tipicamente *saída* de um cálculo de otimização, não um dado de referência publicado. Nenhuma fonte encontrada calcula isso para pequenos negócios; é uma decisão de modelagem interna do BoB, não um benchmark a buscar.

**Decisão fechada (ver Seção 9)**: a V1 não implementa WACC no sentido estrito de finanças corporativas — não há dado público para isso em microempresa, em nenhuma fonte. Adotada a alternativa: **capacidade de dívida derivada de DSCR-alvo por setor**: `capacidade de nova dívida = (NOI projetado do Saldo Consolidado ÷ DSCR-alvo do setor) − serviço de dívida atual`.

**Nota de visão de negócio (não é decisão de arquitetura, é contexto para quem ler este documento depois)**: a ausência de dado público de custo de capital próprio para microempresa não é só uma limitação a contornar — é precisamente a lacuna de mercado que torna o wedge de underwriting da Artemis valioso (tese registrada no documento de contexto do ecossistema, seção 2). Ninguém publicou essa base porque ninguém a construiu na escala de microempreendedor. O caminho de `assessment_outcomes` (decisão #15 do plano mestre) capturando resultado real desde o V1 é o que permite à Artemis, no futuro, ser a própria fonte primária desse dado — ver Seção 9.3.

---

## 4. Parâmetros transversais (não específicos de setor)

### 4.1 Coverage ratio — DSCR mínimo por tipo de credor

| Tipo de credor | DSCR mínimo típico | Observação |
|---|---|---|
| SBA (piso regulatório) | 1,15x | SBA não fixa um número obrigatório único, mas 1,15x é o piso citado com mais consistência entre credores SBA |
| SBA 7(a), padrão de mercado | 1,25x | Faixa mais usada por credores SBA na prática, acima do piso regulatório |
| Banco convencional | 1,25x – 1,35x | Padrão para empréstimo comercial a prazo |
| Banco conservador / prazos longos / setor de risco | 1,35x – 1,50x | |
| Linha de crédito não garantida | ~1,50x | Risco maior para o credor exige colchão maior |
| Credor alternativo/online | 1,00x – 1,10x | Aceita DSCR mais baixo, compensado por crédito forte, garantias ou taxa mais alta |

Setores com receita mais volátil (construção, hotelaria/turismo, agricultura) tendem a receber exigência de DSCR mais alta ou prazo mais curto por parte dos credores — é ajuste qualitativo aplicado por cima do piso, não um número único publicado por setor.

### 4.2 Custo de dívida (proxy para Kd) — taxas correntes (jul/2026)

| Produto | Taxa (jul/2026) |
|---|---|
| SBA 7(a), taxa fixa | 9,75% – 14,75% |
| SBA 7(a), taxa variável | ~8,75% – 9,50% + spread (prime rate 6,75%) |
| SBA 504 | 5% – 7% (ligado a Treasury 10 anos) |
| SBA Microloan (até US$50k) | 8% – 13% |
| Banco convencional (empresa estabelecida) | 7% – 10% |
| Imóvel comercial convencional | 7% – 8,5% |

### 4.3 Sinal de risco por setor — taxa de inadimplência/charge-off SBA

Usado como proxy indireto de prêmio de risco (não existe prêmio de risco de capital próprio publicado por setor para microempresa, ver Seção 3).

| Setor | Taxa de charge-off/default SBA | Observação |
|---|---|---|
| Restaurante / food service | 12% – 15% em condições normais | Consistentemente o setor de maior risco na carteira SBA — margem fina (3-9%) some com qualquer choque |
| Portfólio SBA 7(a) geral (todos os setores) | 2% – 6% histórico médio (contado por dólar); ~12% contado por número de empréstimos | Grande dispersão por setor; números "por dólar" e "por contagem de empréstimo" divergem bastante — cuidado ao citar um único número |
| Empréstimos abaixo de US$150k (qualquer setor) | Taxa de default sensivelmente mais alta que empréstimos maiores | Relevante porque o ICP da Artemis provavelmente pede valores nessa faixa |
| Varejo, serviços pessoais | Acima da média geral | Consistente com margem apertada e alta rotatividade de negócio |

---

## 5. Parâmetros por setor

Todos os números são **nacionais (EUA)**, sem recorte NY/Miami (ver limitação na Seção 2). Onde há "margem líquida" e "margem bruta", ambas vêm de levantamentos distintos — não tratar como par calculado de uma fonte única.

### 5.1 Restaurante — serviço completo (full-service)
- Margem líquida: **3% – 9%**, a maioria dos operadores independentes na ponta inferior; mediana citada com frequência em 3-5%
- Custo de insumos (food cost): 28% – 35% da receita
- Mão de obra: 25% – 35% da receita (mediana ~34-36% em operações "profitable")
- Risco: setor de maior taxa de default SBA (12-15%) — ver 4.3

### 5.2 Restaurante — quick-service / fast-casual
- Margem líquida: **4% – 12%**, geralmente melhor que full-service pela menor folha de mão de obra por transação

### 5.3 Padaria
- Margem líquida: **5% – 15%**, consenso de mediana entre fontes em torno de 7-12%
- Margem bruta: 60% – 80%
- Segmentação relevante: padaria artesanal/especialidade tende a margem líquida maior (20-35% em algumas fontes) que padaria comercial de volume (10-20%)

### 5.4 Barbearia
- Margem líquida: **8% – 20%**, bem administrada tipicamente 12-16%
- Produtos de varejo (retail) dentro da barbearia: margem bruta 40-60%, 15-20% da receita total

### 5.5 Salão de cabelo / beleza (geral)
- Margem líquida: **~8%** como referência mais citada, variando 2% (operação com custo alto) a 15%+ (operação eficiente)
- Margem bruta de serviço: 60% – 65%
- Nota: número mais baixo que barbearia nas fontes consultadas — provavelmente reflete estrutura de custo diferente (mais produto, mais especialização de serviço)

### 5.6 Loja de conveniência / mercearia de bairro / bodega
- Loja de conveniência individual: margem líquida **~5%**; rede com múltiplas lojas, até ~10%
- Mercearia/supermercado independente pequeno: margem líquida **1% – 3%**, estrutura de custo muito mais apertada que conveniência
- Margem bruta de conveniência: 25% – 45%
- Este é o setor de menor margem líquida entre os levantados — relevante para calibrar expectativa de capacidade de pagamento

### 5.7 Limpeza (residencial e comercial)
- Residencial: margem líquida **10% – 15%** (algumas fontes de operador chegam a 20-35% em operação enxuta unipessoal)
- Comercial/janitorial: margem líquida **15% – 20%**
- Especializada (carpete, pós-obra): até **25% – 28%**
- Setor com uma das faixas mais favoráveis entre os levantados, mas com grande dispersão entre fontes — tratar o range como amplo, não como número fechado

### 5.8 Construção / reforma residencial (contratante geral e especializado)
- Contratante geral: margem líquida média de mercado **5% – 6%**; faixa saudável visada 8-12%; "best in class" 10-12%
- Contratante especializado (elétrica, HVAC): **6,9% – 8,5%**, geralmente acima do contratante geral
- Remodelador residencial (dado NAHB, a fonte mais rigorosa deste grupo): margem bruta 29,9%, margem líquida **6,3%** (2024)
- Setor de receita volátil — credores tendem a exigir DSCR mais alto (ver 4.1)

### 5.9 Paisagismo / jardinagem (landscaping / lawn care)
- Margem líquida: **10% – 20%**, mediana citada com frequência em ~13%
- Manutenção/corte de grama: margem mais apertada dentro do setor (10-20% líquido, apesar de bruta de 25-35%)
- Projetos de design/instalação: margem líquida mais alta, 25-40%

### 5.10 Food truck
- Margem líquida: **6% – 15%**; operação com funcionários tende a 6-9%, operador único (dono trabalhando no próprio caminhão) até 15% ou mais
- Custo de insumos: 25% – 35% da receita
- Setor citado consistentemente como mais rentável em % que restaurante fixo equivalente, por menor custo fixo (aluguel/imóvel)

### 5.11 Oficina mecânica (auto repair)
- Margem líquida: dispersão muito grande entre fontes — média setorial ampla citada em **6% – 7%**; oficina bem administrada, **15% – 20%+**
- Margem bruta: 50% – 60%
- Nota: esta é a maior distância entre "média do setor" e "operação bem administrada" de todos os setores levantados — parâmetro de segmentação aqui precisaria distinguir porte/gestão, não só ramo, para ser útil

### 5.12 Salão de unhas (nail salon)
- Margem líquida: **15% – 25%**, bem localizado até 30-40%
- Uma fonte isolada citou 43% de margem — tratado como outlier, não incorporado à faixa de consenso

### 5.13 Creche / cuidado infantil (daycare)
- Margem líquida: faixa muito dispersa entre fontes — **5% a 25%**, com números pontuais chegando a 40%+ em operações de alta ocupação
- **Confiabilidade baixa** deste setor especificamente: nenhuma fonte com rigor equivalente a RMA/NAHB encontrada; forte dependência de subsídio governamental e taxa de ocupação torna o número muito sensível ao caso individual
- Se este setor entrar na segmentação do V1, marcar `confidence_level` mais baixo por padrão

### 5.14 Lavanderia self-service (laundromat)
- Margem líquida: **25% – 35%** quando otimizada — uma única fonte, não triangulada com outras. Tratar como indicativo, não como consenso

---

## 6. Setores do ICP não cobertos nesta rodada

Não pesquisados por prioridade/tempo, mas prováveis de aparecer no cadastro dado o ICP (imigrantes, negócios informais, NY/Miami): salão de manicure combinado com spa, loja de roupas/boutique de bairro, serviço de transporte/entrega autônomo, costura/alfaiataria, mercado de produtos étnicos. Para estes, seguir a regra de fallback da Seção 1 até que entrem numa rodada futura de levantamento.

---

## 7. Uso no `bob-engine` (decidido — pronto para orientar implementação da Etapa 3)

1. **Margem líquida por setor** (Seção 5) → sanity-check do DRE informado pelo usuário. Se o Resultado do Negócio implica margem muito fora da faixa do setor, é sinal para o BoB pedir mais dado ou reduzir `confidence_level` — não para rejeitar o dado do usuário.
2. **DSCR-alvo** (Seção 4.1) → piso de coverage ratio usado no cálculo de capacidade de dívida (fórmula da Seção 3), com ajuste por setor de risco: setores de maior risco (Seção 4.3) usam DSCR-alvo mais próximo do teto da faixa do tipo de credor correspondente, o que reduz a capacidade de dívida calculada, o valor de parcela sustentável, e pode subir a taxa de referência usada na simulação — não é só um ajuste de confiança, é um ajuste do próprio número recomendado.
3. **Taxa de default SBA por setor** (Seção 4.3) → alimenta o ajuste do item 2 (DSCR-alvo mais conservador para setores de maior risco).
4. **Custo de dívida corrente** (Seção 4.2) → usado para estimar custo de serviço da dívida nova recomendada, dado o tipo de produto de crédito mais provável (SBA microloan é o mais realista para o ICP, dado o porte de faturamento esperado).
5. **WACC/ND\***: substituído pela capacidade de dívida via DSCR-alvo (Seção 3) — decisão fechada, não reabrir sem justificativa nova.
6. **Regra de `confidence_level` por setor** (implementada como enum `low` / `medium` / `high` no schema, não como escala numérica 1–10 — a intenção original abaixo foi traduzida mecanicamente para os três níveis do banco):
   - Setor **sem parâmetro de segmentação** (fallback da Seção 1) → confiança moderada-baixa por padrão, nível **`low`**.
   - Setor **com fonte de triangulação fraca** (Creche 5.13, Lavanderia 5.14) → mesmo nível do fallback (**`low`**), mesmo tendo parâmetro, porque o parâmetro em si tem baixa robustez.
   - Setor **com fonte mais forte e triangulada** (ex: Construção via NAHB, DSCR via SBA/bancos) → nível **`high`** — o motor deve diferenciar setores por qualidade de fonte, não tratar todo setor "com parâmetro" como equivalente.
   - Demais setores com parâmetro triangulado (a maioria dos 14) → nível intermediário **`medium`**; a calibração fina de quais setores merecem `high` vs. `medium` fica para quando houver dado real de uso (mesma lógica já prevista para o risco monitorado da decisão #34 do plano mestre).
   - Gatilho de sanity-check de margem (item 1 acima) → desce um nível (`high`→`medium`, `medium`→`low`), tradução direta do "-2" original agora que a escala é ordinal de 3 níveis, não numérica de 10.
7. **Teto de plausibilidade por múltiplo de receita + teto absoluto de microloan** (adicionado após achado da rodada de QA da Etapa 5 — DSCR-alvo sozinho não tem limitador por escala de receita, nenhum credor real usa DSCR como único limitador). `recommendedAmount` passa a ser o **menor** entre três candidatos:
   - Capacidade via DSCR-alvo (item 2 acima, fórmula da Seção 3 inalterada);
   - `REVENUE_MULTIPLIER_CAP` × receita mensal consolidada — parâmetro configurável em `domain/assessment.ts`, **ponto de partida 2x, não decisão fechada** (ver tabela de benchmark abaixo);
   - Teto absoluto do SBA Microloan, US$50.000 (item 4 acima).

   Benchmark de mercado usado como referência (credores reais dos EUA, 2026):

   | Tipo de crédito | Regra de mercado |
   |---|---|
   | Empréstimo a prazo (term loan) | 1x – 2x a receita bruta mensal |
   | Linha de crédito | 10% – 30% da receita mensal |
   | MCA | Exige piso de ~US$10.000–15.000/mês de receita para elegibilidade |
   | SBA Microloan | Teto de US$50.000; média nacional real de US$16.131 (FY2025) |

   2x é o limite superior da faixa de term loan (a mais generosa das quatro) — calibração fina do valor exato fica para quando houver dado real de uso, mesma lógica do item 6 acima. Quando um destes dois tetos novos é o limitador ativo, `confidence_level` desce um nível, mesmo padrão do item 6. O campo `recommendationLimiter` (`dscr` | `revenue_multiple` | `microloan_ceiling`) registra qual dos três venceu, para auditoria da recomendação (critério de aceitação 6.1 do plano mestre).

---

## 8. Setores fora do escopo desta rodada

Os 5 setores da Seção 6 (manicure/spa combinado, boutique de bairro, transporte/entrega autônomo, costura/alfaiataria, mercado de produtos étnicos) seguem fora do V1 por ora — não foram peça de decisão nesta rodada, ficam para uma futura ampliação de cobertura setorial, usando a mesma regra de fallback até lá.

---

## 9. Decisões fechadas nesta rodada — pronto para registrar no Log de decisões do plano mestre

| Decisão | Racional resumido |
|---|---|
| WACC clássico substituído por capacidade de dívida via DSCR-alvo por setor (fórmula na Seção 3) | Não existe dado público de custo de capital próprio para microempresa em nenhuma fonte pesquisada; DSCR e custo de dívida (Seção 4) têm dado real e público, WACC não |
| V1 cobre os 14 setores do documento (Seção 5), sem redução de escopo | Fundador optou por cobertura ampla desde o V1 em vez de subconjunto reduzido |
| Creche e Lavanderia entram no V1 com ressalva de confiança rebaixada (mesmo patamar do fallback), não ficam de fora | Fonte fraca não é motivo de exclusão, mas precisa ser sinalizada ao usuário via `confidence_level` |
| Regra de `confidence_level` por qualidade de fonte definida (fallback e fonte fraca = `low`; fonte forte = `high`; demais = `medium`) — implementado como enum de 3 níveis no schema, não escala numérica | Comportamento de produto explícito, evita ficar a critério da implementação decidir isso sozinha |
| Setor de maior risco (Seção 4.3) ajusta DSCR-alvo, valor de parcela recomendado e taxa de referência da simulação — não só a confiança exibida | Fundador definiu que risco setorial deve mudar o número da recomendação, não só um rótulo de confiança ao lado dele |
| Taxa de juros efetiva tomada, prazo, garantia e capital próprio aportado **não são inputs necessários para o cálculo do V1** — são *outputs* que o BoB apresenta ao usuário (ex: comparação com mercado) e, depois, *outcomes* a capturar em `assessment_outcomes` para aprendizado futuro | Reformulação do fundador: o BoB informa esses dados ao usuário, não depende deles como pré-requisito; o gap real é garantir que `assessment_outcomes` tenha campo para registrar o que o usuário efetivamente tomou, para comparação futura com a recomendação — ver nota abaixo |
| RMA Annual Statement Studies não será licenciada agora | V1 segue com as fontes públicas secundárias já consolidadas neste documento; decisão revisitável no futuro |
| Construção de base de dados proprietária de underwriting (via `assessment_outcomes`) é reconhecida como diferencial de negócio futuro, mas licenciamento/comercialização dessa base é decisão de modelo de negócio — pertence ao projeto de ecossistema, não a este | Sinalização conforme regra da seção 0 do documento de contexto deste projeto |

**Nota técnica aberta (não é decisão de produto, é checagem de schema a fazer na Etapa 3 ou antes)**: a reformulação acima confirma que `assessment_outcomes` (schema `bob`, decisão #15) precisa ter campo para capturar, quando disponível, a taxa/prazo/garantia/capital próprio do crédito efetivamente tomado pelo usuário — não porque o cálculo do V1 dependa disso, mas porque é o dado de comparação entre a recomendação do BoB e o resultado real, que é a base da Etapa 2 (modelo aprendido, decisão #14). Vale confirmar se o desenho atual da tabela em `docs/architecture.md` já contempla esses campos antes de Claude Code implementar a Etapa 3, para não gerar migração depois.
