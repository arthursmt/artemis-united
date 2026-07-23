import { useState } from 'react'
import { US_STATES } from '@artemis-united/shared-types'
import { createCustomerProfile } from '../api/customerProfile'
import { ApiError } from '../api/client'
import type { CustomerProfile, MaritalStatus } from '../types'

const MARITAL_STATUS_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: 'single', label: 'Solteiro(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed', label: 'Viúvo(a)' },
  { value: 'separated', label: 'Separado(a)' },
]

export function CustomerOnboardingForm({ onCreated }: { onCreated: (profile: CustomerProfile) => void }) {
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState(US_STATES[0].code as string)
  const [zipCode, setZipCode] = useState('')
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>('single')
  const [hasChildren, setHasChildren] = useState<'yes' | 'no'>('no')
  const [householdSize, setHouseholdSize] = useState('')
  const [alternatePhone, setAlternatePhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await createCustomerProfile({
        dateOfBirth,
        addressLine1,
        addressLine2: addressLine2.trim() === '' ? null : addressLine2,
        city,
        state,
        zipCode,
        maritalStatus,
        hasChildren: hasChildren === 'yes',
        householdSize: householdSize.trim() === '' ? null : Number(householdSize),
        alternatePhone,
      })
      if (result) {
        onCreated(result.profile)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Sobre você</h1>
      <p>Precisamos de mais algumas informações antes de continuar.</p>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label htmlFor="date-of-birth">Data de nascimento</label>
          <input
            id="date-of-birth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="address-line1">Endereço</label>
          <input
            id="address-line1"
            type="text"
            placeholder="Rua e número"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="address-line2">Complemento (opcional)</label>
          <input
            id="address-line2"
            type="text"
            placeholder="Apto, unidade, etc."
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="city">Cidade</label>
          <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="state">Estado</label>
          <select id="state" value={state} onChange={(e) => setState(e.target.value)}>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="zip-code">CEP (ZIP code)</label>
          <input
            id="zip-code"
            type="text"
            placeholder="12345"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="marital-status">Estado civil</label>
          <select
            id="marital-status"
            value={maritalStatus}
            onChange={(e) => setMaritalStatus(e.target.value as MaritalStatus)}
          >
            {MARITAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="has-children">Tem filhos?</label>
          <select
            id="has-children"
            value={hasChildren}
            onChange={(e) => setHasChildren(e.target.value as 'yes' | 'no')}
          >
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="household-size">Nº de pessoas na casa (opcional)</label>
          <input
            id="household-size"
            type="number"
            min={1}
            step={1}
            value={householdSize}
            onChange={(e) => setHouseholdSize(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="alternate-phone">Telefone alternativo</label>
          <input
            id="alternate-phone"
            type="tel"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            required
          />
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          Continuar
        </button>
      </form>
    </div>
  )
}
