import { useState } from 'react'
import { submitDre } from '../api/financialStatements'
import { ApiError } from '../api/client'
import type { AssessmentView, MonthlyFinancials } from '../types'

const FIELDS: { key: keyof MonthlyFinancials; label: string; help?: string }[] = [
  { key: 'revenue', label: 'Quanto seu negócio fatura, em média, por mês?' },
  {
    key: 'directCosts',
    label: 'Quanto você gasta em mercadoria/insumos por mês?',
  },
  {
    key: 'operatingExpenses',
    label:
      'Quanto são suas outras despesas do negócio por mês? (aluguel, mão de obra, utilidades, marketing, etc.)',
  },
  {
    key: 'currentDebtService',
    label: 'Quanto você paga por mês, no total, em dívidas e empréstimos?',
  },
  {
    key: 'personalExtraIncome',
    label: 'Você tem outra renda além do negócio? (salário paralelo, outro negócio, benefícios)',
  },
  {
    key: 'personalExpenses',
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

export function DreForm({ onSubmitted }: { onSubmitted: (result: AssessmentView) => void }) {
  const [values, setValues] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

  return (
    <div>
      <h1>DRE mínimo</h1>
      <p>Responda com valores mensais médios — não precisa ser exato.</p>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        {FIELDS.map((field) => (
          <div className="field" key={field.key}>
            <label htmlFor={field.key}>{field.label}</label>
            {field.help && <span className="help">{field.help}</span>}
            <input
              id={field.key}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              required
            />
          </div>
        ))}
        <button className="primary" type="submit" disabled={submitting}>
          Calcular
        </button>
      </form>
    </div>
  )
}
