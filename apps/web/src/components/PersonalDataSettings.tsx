import { useEffect, useState } from 'react'
import { US_STATES } from '@artemis-united/shared-types'
import { ApiError } from '../api/client'
import { getMyCustomerProfile, updateCustomerProfile } from '../api/customerProfile'
import type { MaritalStatus } from '../types'

const MARITAL_STATUS_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: 'single', label: 'Solteiro(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed', label: 'Viúvo(a)' },
  { value: 'separated', label: 'Separado(a)' },
]

export function PersonalDataSettings() {
  const [loading, setLoading] = useState(true)
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
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyCustomerProfile()
      .then((result) => {
        if (cancelled || !result) return
        const p = result.profile
        setDateOfBirth(p.dateOfBirth)
        setAddressLine1(p.addressLine1)
        setAddressLine2(p.addressLine2 ?? '')
        setCity(p.city)
        setState(p.state)
        setZipCode(p.zipCode)
        setMaritalStatus(p.maritalStatus)
        setHasChildren(p.hasChildren ? 'yes' : 'no')
        setHouseholdSize(p.householdSize !== null ? String(p.householdSize) : '')
        setAlternatePhone(p.alternatePhone)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar seus dados.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSubmitting(true)
    try {
      await updateCustomerProfile({
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
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p>Carregando...</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}
      {saved && <p className="help">Dados salvos.</p>}
      <div className="field">
        <label htmlFor="settings-dob">Data de nascimento</label>
        <input
          id="settings-dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="settings-address1">Endereço</label>
        <input
          id="settings-address1"
          type="text"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="settings-address2">Complemento (opcional)</label>
        <input
          id="settings-address2"
          type="text"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="settings-city">Cidade</label>
        <input id="settings-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="settings-state">Estado</label>
        <select id="settings-state" value={state} onChange={(e) => setState(e.target.value)}>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="settings-zip">CEP (ZIP code)</label>
        <input
          id="settings-zip"
          type="text"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="settings-marital">Estado civil</label>
        <select
          id="settings-marital"
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
        <label htmlFor="settings-children">Tem filhos?</label>
        <select
          id="settings-children"
          value={hasChildren}
          onChange={(e) => setHasChildren(e.target.value as 'yes' | 'no')}
        >
          <option value="no">Não</option>
          <option value="yes">Sim</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="settings-household">Nº de pessoas na casa (opcional)</label>
        <input
          id="settings-household"
          type="number"
          min={1}
          step={1}
          value={householdSize}
          onChange={(e) => setHouseholdSize(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="settings-phone">Telefone alternativo</label>
        <input
          id="settings-phone"
          type="tel"
          value={alternatePhone}
          onChange={(e) => setAlternatePhone(e.target.value)}
          required
        />
      </div>
      <button className="primary" type="submit" disabled={submitting}>
        Salvar
      </button>
    </form>
  )
}
