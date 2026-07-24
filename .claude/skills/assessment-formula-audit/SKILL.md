---
name: assessment-formula-audit
description: Audita a fórmula de cálculo de crédito do bob-engine (services/bob-engine/src/domain/assessment.ts e sectors.ts) contra a especificação documentada em docs/bob-engine-parametros-setoriais.md antes de aceitar qualquer mudança nesses arquivos como correta. Use sempre que assessment.ts ou sectors.ts forem alterados, quando o usuário pedir revisão do cálculo de crédito/recomendação/NOI/DSCR, ou quando um resultado de avaliação (recommendedAmount) parecer implausível em teste manual.
---

# Auditoria da fórmula do bob-engine

Este projeto já teve um bug real (não hipotético) exatamente nesta área:
`NOI` calculado só a partir do resultado do negócio, ignorando
`personalExtraIncome`/`personalExpenses` — dado coletado, validado e
persistido corretamente em todas as camadas, mas silenciosamente descartado
no cálculo final. Passou despercebido porque ninguém comparou o código linha
a linha com a especificação. Esta skill existe pra isso não se repetir.

## Antes de mexer em qualquer coisa

Leia, nesta ordem:
1. `docs/bob-engine-parametros-setoriais.md`, Seção 3 (fórmula de capacidade
   de dívida via DSCR-alvo — substitui WACC, decisão fechada, não reabrir),
   Seção 4 (parâmetros transversais: DSCR por tipo de credor, custo de
   dívida, risco por setor), Seção 7 (como cada peça é usada no motor,
   incluindo regra de `confidence_level`).
2. `services/bob-engine/src/domain/assessment.ts` — a implementação atual.
3. `services/bob-engine/src/domain/sectors.ts` — dado de segmentação por
   setor (risco, confiança, faixa de margem).

## Checklist de conferência (linha a linha, não por inspeção visual)

- **NOI vem do Saldo Consolidado, não só do negócio.** Formula esperada:
  `NOI = (revenue - directCosts - operatingExpenses) + (personalExtraIncome - personalExpenses)`.
  Se `personalExtraIncome`/`personalExpenses` aparecem na interface
  `MonthlyFinancials` mas não aparecem na expressão que calcula `noi`, é bug
  — confirme rastreando esses dois campos até `apps/api` (schema, rota
  `financialStatements.ts`, `bobEngineClient.ts`) pra garantir que o dado
  realmente chega até aqui antes de escrever o fix.
- **DSCR-alvo por setor/risco.** `computeDscrTarget` deve usar
  `DSCR_BASE + DSCR_HIGH_RISK_ADJUSTMENT` só quando `sector.riskTier ===
  'alto'`, sempre dentro de `[DSCR_MIN, DSCR_MAX]`. Confira contra a Seção
  4.1 (piso 1,15x, padrão de mercado SBA 7(a) 1,25x) e a Seção 4.3 (quais
  setores são "alto risco" — restaurante, salão de unhas, barbearia, etc.,
  não é intuitivo, está na tabela).
- **Sem mistura de janela mensal/anual.** Todo o cálculo (`noi`,
  `currentDebtService`, `monthlyNewDebtCapacity`, e a anuidade em
  `monthlyCapacityToPrincipal`) precisa estar em base mensal, consistente.
  Erro clássico: taxa anual sem dividir por 12 em algum ponto do cálculo.
- **Sanity-check de margem existe e desce o nível de confiança**, não
  rejeita o dado (Seção 7, item 1). Confira `marginDistanceFromRange` e
  `computeConfidenceLevel` — setor sem parâmetro ou fonte fraca = `low`;
  gatilho de sanity-check sempre desce um degrau (`high`→`medium`→`low`).
- **`findSector` nunca inventa parâmetro pra setor desconhecido** — regra de
  fallback da Seção 1. `sectorFound: false` deve seguir pro cálculo mesmo
  assim, sem lançar erro, com confiança `low`.
- **Nenhum campo de `customer_profiles` (onboarding-cliente) entra nesta
  conta.** Fronteira ECOA — ver skill `guardrail-check`.

## Depois de corrigir

1. Rode `npm run test` em `services/bob-engine` (vitest configurado desde a
   correção do bug de NOI — `src/domain/assessment.test.ts` é o arquivo de
   referência de como estruturar um novo teste).
2. Se a mudança altera o *valor* de uma recomendação, adicione um teste
   cobrindo o caso específico que motivou a mudança — não só o caminho
   feliz. Use inputs realistas (não zerados), porque cenários com custos
   perto de zero tendem a gerar números implausíveis mesmo com a fórmula
   correta (ver nota abaixo).
3. Rode `npx turbo run typecheck lint --filter=@artemis-united/bob-engine`.

## Se o resultado ainda parecer implausível depois da fórmula estar certa

Não é necessariamente bug. Não existe, em nenhum dos dois documentos de
referência (`bob-engine-parametros-setoriais.md` nem o plano mestre), um
teto absoluto vinculado à escala do próprio faturamento (ex: "recomendação
≤ N meses de faturamento") — só o piso de coverage ratio (DSCR) e o teto
fixo do produto de referência (`MICROLOAN_CEILING`). Com custos/dívida
reportados muito baixos relativos ao faturamento, a fórmula documentada
pode legitimamente produzir um múltiplo grande do faturamento mensal. Isso é
uma lacuna de modelagem/critério de aceitação, não um bug de implementação
— documente o cenário exato (inputs e outputs) e devolva como achado pro
fundador decidir, não implemente um teto novo por conta própria.
