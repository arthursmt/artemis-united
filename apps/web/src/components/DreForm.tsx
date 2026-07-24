import { useEffect, useRef, useState } from 'react'
import { toTimeSpentBracket, track } from '@artemis-united/analytics'
import type { DreBlock } from '@artemis-united/analytics'
import { submitDre } from '../api/financialStatements'
import { ApiError } from '../api/client'
import type { AssessmentView, MonthlyFinancials } from '../types'

// Wizard de 6 blocos + resumo (decisões #27/#34 do plano mestre, confirmadas
// e implementadas na Fase de reforço de QA de 2026-07-24 — antes desta
// versão, o DRE era um formulário único de 6 campos numa tela só, sem
// wizard nem salvamento parcial, contradizendo as decisões já fechadas).
// "Salvamento parcial" aqui é em memória entre os blocos do wizard (o
// usuário não perde o que já respondeu ao ir/voltar de bloco) — não é
// persistido no servidor por bloco; a submissão continua sendo um único
// POST /financial-statements no final, no bloco de resumo. Não muda o
// contrato do backend nem a regra de "nunca sobrescrever" (cada POST já
// gera uma linha nova versionada, ver financial_statements).
interface FieldDef {
  key: keyof MonthlyFinancials
  block: DreBlock
  blockIndex: 0 | 1 | 2 | 3 | 4 | 5
  label: string
  help?: string
}

const FIELDS: FieldDef[] = [
  {
    key: 'revenue',
    block: 'revenue',
    blockIndex: 0,
    label: 'Quanto seu negócio fatura, em média, por mês?',
  },
  {
    key: 'directCosts',
    block: 'direct_costs',
    blockIndex: 1,
    label: 'Quanto você gasta em mercadoria/insumos por mês?',
  },
  {
    key: 'operatingExpenses',
    block: 'operating_expenses',
    blockIndex: 2,
    label:
      'Quanto são suas outras despesas do negócio por mês? (aluguel, mão de obra, utilidades, marketing, etc.)',
  },
  {
    key: 'currentDebtService',
    block: 'business_debt',
    blockIndex: 3,
    label: 'Quanto você paga por mês, no total, em dívidas e empréstimos?',
  },
  {
    key: 'personalExtraIncome',
    block: 'personal_income',
    blockIndex: 4,
    label: 'Você tem outra renda além do negócio? (salário paralelo, outro negócio, benefícios)',
  },
  {
    key: 'personalExpenses',
    block: 'personal_expenses',
    blockIndex: 5,
    label:
      'Quanto você gasta por mês com moradia, alimentação, saúde, etc. — sem contar dívidas, já perguntamos isso acima',
    help: 'Não conte dívida pessoal aqui de novo — isso já entrou na pergunta anterior. Contar duas vezes deixa o número final errado.',
  },
]

const EMPTY: Record<keyof MonthlyFinancials, string> = {
  revenue: '',
  directCosts: '',
  operatingExpenses: '',
  currentDebtService: '',
  personalExtraIncome: '',
  personalExpenses: '',
}

const SUMMARY_STEP = FIELDS.length

export function DreForm({
  onSubmitted,
  onCancel,
}: {
  onSubmitted: (result: AssessmentView) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState(EMPTY)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const blockEnteredAt = useRef(Date.now())

  useEffect(() => {
    blockEnteredAt.current = Date.now()
  }, [step])

  const isSummary = step === SUMMARY_STEP
  const currentField = FIELDS[step]

  function trackAbandonIfMidBlock() {
    if (isSummary) return
    const secondsSpent = (Date.now() - blockEnteredAt.current) / 1000
    track('dre_block_abandoned', {
      block: currentField.block,
      block_index: currentField.blockIndex,
      time_spent_bracket: toTimeSpentBracket(secondsSpent),
    })
  }

  function handleCancel() {
    trackAbandonIfMidBlock()
    onCancel()
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    track('dre_block_completed', { block: currentField.block, block_index: currentField.blockIndex })
    setStep((s) => s + 1)
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const monthly = {} as MonthlyFinancials
      for (const field of FIELDS) {
        monthly[field.key] = Number(values[field.key])
      }
      const result = await submitDre(monthly)
      if (result) {
        onSubmitted(result)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isSummary) {
    return (
      <div>
        <h1>Revise antes de calcular</h1>
        <p className="help">Confira os valores — você pode voltar e ajustar qualquer bloco antes de calcular.</p>
        {error && <p className="error">{error}</p>}
        {FIELDS.map((field) => (
          <div className="metric" key={field.key}>
            <span>{field.label}</span>
            <span className="value">{values[field.key] === '' ? '—' : values[field.key]}</span>
          </div>
        ))}
        <button className="primary" type="button" disabled={submitting} onClick={() => void handleSubmit()}>
          Calcular
        </button>
        <div className="back-row">
          <button className="link" type="button" onClick={handleBack}>
            ← Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1>DRE mínimo</h1>
      <p className="help">
        Bloco {step + 1} de {FIELDS.length} — responda com valores mensais médios, não precisa ser exato.
      </p>
      <form onSubmit={handleNext}>
        <div className="field" key={currentField.key}>
          <label htmlFor={currentField.key}>{currentField.label}</label>
          {currentField.help && <span className="help">{currentField.help}</span>}
          <input
            id={currentField.key}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={values[currentField.key]}
            onChange={(e) => setValues((v) => ({ ...v, [currentField.key]: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <button className="primary" type="submit">
          Continuar
        </button>
      </form>
      <div className="back-row">
        {step > 0 && (
          <>
            <button className="link" type="button" onClick={handleBack}>
              ← Voltar
            </button>
            {' · '}
          </>
        )}
        <button className="link" type="button" onClick={handleCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
