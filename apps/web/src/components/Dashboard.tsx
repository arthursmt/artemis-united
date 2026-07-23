import { useEffect, useState } from 'react'
import { getLatestAssessment } from '../api/assessments'
import { logout } from '../api/auth'
import { ApiError } from '../api/client'
import type { AssessmentView, Business } from '../types'

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

function formatMoney(value: string | number | null): string {
  if (value === null) return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })
}

export function Dashboard({
  business,
  onOpenDreForm,
  onOpenSettings,
  onLoggedOut,
}: {
  business: Business
  onOpenDreForm: () => void
  onOpenSettings: () => void
  onLoggedOut: () => void
}) {
  const [assessment, setAssessment] = useState<AssessmentView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getLatestAssessment()
      .then((result) => {
        if (!cancelled) setAssessment(result ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setAssessment(null)
        } else {
          setError(err instanceof ApiError ? err.message : 'Não foi possível carregar sua avaliação.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <div className="top-bar">
        <h1>{business.name}</h1>
        <div>
          <button className="link" type="button" onClick={onOpenSettings}>
            Configurações
          </button>
          {' · '}
          <button
            className="link"
            type="button"
            onClick={() => {
              void logout().then(onLoggedOut)
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {loading && <p>Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !assessment && (
        <div className="card">
          <p>Você ainda não tem uma avaliação. Preencha o DRE mínimo pra ver sua capacidade de crédito.</p>
          <button className="primary" type="button" onClick={onOpenDreForm}>
            Preencher DRE
          </button>
        </div>
      )}

      {!loading && assessment && (
        <>
          <div className="card">
            <p>Valor recomendado</p>
            <div className="headline">{formatMoney(assessment.recommendedAmount)}</div>
            <div className="metric">
              <span>Confiança</span>
              <span className="value">{CONFIDENCE_LABEL[assessment.confidenceLevel ?? ''] ?? '—'}</span>
            </div>
            {assessment.exceedsMicroloanCeiling && (
              <p className="error">Esse valor passa do teto do produto de crédito de referência (microloan).</p>
            )}
          </div>

          <div className="card">
            <h2>Detalhes do cálculo</h2>
            <div className="metric">
              <span>Resultado operacional líquido (NOI)</span>
              <span className="value">{formatMoney(assessment.noi)}</span>
            </div>
            <div className="metric">
              <span>DSCR-alvo</span>
              <span className="value">{assessment.dscrTarget.toFixed(2)}</span>
            </div>
            <div className="metric">
              <span>Capacidade mensal de nova dívida</span>
              <span className="value">{formatMoney(assessment.monthlyNewDebtCapacity)}</span>
            </div>
          </div>

          <button className="primary" type="button" onClick={onOpenDreForm}>
            Nova avaliação
          </button>
        </>
      )}
    </div>
  )
}
