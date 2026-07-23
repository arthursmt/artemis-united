import { useEffect, useState } from 'react'
import { US_STATES } from '@artemis-united/shared-types'
import { updateBusinessDetails } from '../api/businesses'
import { ApiError } from '../api/client'
import { getMyCustomerProfile } from '../api/customerProfile'
import type { Business, CustomerProfile } from '../types'

export function BusinessDetailsForm({ onSaved }: { onSaved: (business: Business) => void }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [sameAsHome, setSameAsHome] = useState(false)
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState(US_STATES[0].code as string)
  const [zipCode, setZipCode] = useState('')
  const [yearsInBusiness, setYearsInBusiness] = useState('')
  const [yearsOfIndustryExperience, setYearsOfIndustryExperience] = useState('')
  const [phone, setPhone] = useState('')
  const [numberOfEmployees, setNumberOfEmployees] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getMyCustomerProfile()
      .then((result) => setProfile(result?.profile ?? null))
      .catch(() => setProfile(null))
  }, [])

  function handleSameAsHomeChange(checked: boolean) {
    setSameAsHome(checked)
    if (checked && profile) {
      setAddressLine1(profile.addressLine1)
      setAddressLine2(profile.addressLine2 ?? '')
      setCity(profile.city)
      setState(profile.state)
      setZipCode(profile.zipCode)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await updateBusinessDetails({
        addressLine1,
        addressLine2: addressLine2.trim() === '' ? null : addressLine2,
        city,
        state,
        zipCode,
        yearsInBusiness: Number(yearsInBusiness),
        yearsOfIndustryExperience: Number(yearsOfIndustryExperience),
        phone: phone.trim() === '' ? null : phone,
        numberOfEmployees: Number(numberOfEmployees),
      })
      if (result) {
        onSaved(result.business)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Mais sobre o seu negócio</h1>
      <p>Só mais algumas informações antes de continuar.</p>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}

        {profile && (
          <div className="field field-checkbox">
            <label htmlFor="same-as-home">
              <input
                id="same-as-home"
                type="checkbox"
                checked={sameAsHome}
                onChange={(e) => handleSameAsHomeChange(e.target.checked)}
              />
              Endereço do negócio é o mesmo da minha residência
            </label>
          </div>
        )}

        <div className="field">
          <label htmlFor="biz-address-line1">Endereço do negócio</label>
          <input
            id="biz-address-line1"
            type="text"
            placeholder="Rua e número"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            readOnly={sameAsHome}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="biz-address-line2">Complemento (opcional)</label>
          <input
            id="biz-address-line2"
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            readOnly={sameAsHome}
          />
        </div>
        <div className="field">
          <label htmlFor="biz-city">Cidade</label>
          <input
            id="biz-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            readOnly={sameAsHome}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="biz-state">Estado</label>
          <select
            id="biz-state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            disabled={sameAsHome}
          >
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="biz-zip">CEP (ZIP code)</label>
          <input
            id="biz-zip"
            type="text"
            placeholder="12345"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            readOnly={sameAsHome}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="years-in-business">Anos de negócio</label>
          <input
            id="years-in-business"
            type="number"
            min={0}
            step={1}
            value={yearsInBusiness}
            onChange={(e) => setYearsInBusiness(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="years-experience">Anos de experiência no ramo</label>
          <input
            id="years-experience"
            type="number"
            min={0}
            step={1}
            value={yearsOfIndustryExperience}
            onChange={(e) => setYearsOfIndustryExperience(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="biz-phone">Telefone do negócio (opcional)</label>
          <input id="biz-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="employee-count">Nº de empregados</label>
          <input
            id="employee-count"
            type="number"
            min={0}
            step={1}
            value={numberOfEmployees}
            onChange={(e) => setNumberOfEmployees(e.target.value)}
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
