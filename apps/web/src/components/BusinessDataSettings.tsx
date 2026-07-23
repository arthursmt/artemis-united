import { useEffect, useState } from 'react'
import { US_STATES } from '@artemis-united/shared-types'
import { getMyBusiness, updateBusinessDetails } from '../api/businesses'
import { ApiError } from '../api/client'

export function BusinessDataSettings() {
  const [loading, setLoading] = useState(true)
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
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyBusiness()
      .then((result) => {
        if (cancelled || !result) return
        const b = result.business
        setAddressLine1(b.addressLine1 ?? '')
        setAddressLine2(b.addressLine2 ?? '')
        setCity(b.city ?? '')
        setState(b.state ?? (US_STATES[0].code as string))
        setZipCode(b.zipCode ?? '')
        setYearsInBusiness(b.yearsInBusiness !== null ? String(b.yearsInBusiness) : '')
        setYearsOfIndustryExperience(
          b.yearsOfIndustryExperience !== null ? String(b.yearsOfIndustryExperience) : '',
        )
        setPhone(b.phone ?? '')
        setNumberOfEmployees(b.numberOfEmployees !== null ? String(b.numberOfEmployees) : '')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dados.')
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
      // updateBusinessDetails (PUT /v1/businesses/me) só edita o negócio já
      // existente do usuário — nunca cria um segundo (trava de 1-negócio-por-
      // usuário da Etapa 4 continua intacta, esta tela não recria nada).
      await updateBusinessDetails({
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
        <label htmlFor="biz-settings-address1">Endereço do negócio</label>
        <input
          id="biz-settings-address1"
          type="text"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-address2">Complemento (opcional)</label>
        <input
          id="biz-settings-address2"
          type="text"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-city">Cidade</label>
        <input
          id="biz-settings-city"
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-state">Estado</label>
        <select id="biz-settings-state" value={state} onChange={(e) => setState(e.target.value)}>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="biz-settings-zip">CEP (ZIP code)</label>
        <input
          id="biz-settings-zip"
          type="text"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-years-business">Anos de negócio</label>
        <input
          id="biz-settings-years-business"
          type="number"
          min={0}
          step={1}
          value={yearsInBusiness}
          onChange={(e) => setYearsInBusiness(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-years-experience">Anos de experiência no ramo</label>
        <input
          id="biz-settings-years-experience"
          type="number"
          min={0}
          step={1}
          value={yearsOfIndustryExperience}
          onChange={(e) => setYearsOfIndustryExperience(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-phone">Telefone do negócio (opcional)</label>
        <input
          id="biz-settings-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="biz-settings-employees">Nº de empregados</label>
        <input
          id="biz-settings-employees"
          type="number"
          min={0}
          step={1}
          value={numberOfEmployees}
          onChange={(e) => setNumberOfEmployees(e.target.value)}
          required
        />
      </div>
      <button className="primary" type="submit" disabled={submitting}>
        Salvar
      </button>
    </form>
  )
}
