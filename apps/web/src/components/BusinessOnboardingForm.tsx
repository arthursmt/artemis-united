import { useState } from 'react'
import { OUTRO_SEGMENT, SECTOR_SEGMENT_OPTIONS } from '@artemis-united/shared-types'
import { createBusiness } from '../api/businesses'
import { ApiError } from '../api/client'
import type { Business } from '../types'

export function BusinessOnboardingForm({ onCreated }: { onCreated: (business: Business) => void }) {
  const [name, setName] = useState('')
  const [sectorSegment, setSectorSegment] = useState(SECTOR_SEGMENT_OPTIONS[0].slug as string)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await createBusiness(name, sectorSegment)
      if (result) {
        onCreated(result.business)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Sobre o seu negócio</h1>
      <p>Antes de avaliar sua capacidade de crédito, conte um pouco sobre o seu negócio.</p>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label htmlFor="business-name">Nome do negócio</label>
          <input id="business-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="sector-segment">Setor</label>
          <select id="sector-segment" value={sectorSegment} onChange={(e) => setSectorSegment(e.target.value)}>
            {SECTOR_SEGMENT_OPTIONS.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
            <option value={OUTRO_SEGMENT}>Outro</option>
          </select>
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          Continuar
        </button>
      </form>
    </div>
  )
}
