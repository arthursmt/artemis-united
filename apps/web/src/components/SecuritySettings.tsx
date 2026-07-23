import { useState } from 'react'
import { changePassword } from '../api/auth'
import { ApiError } from '../api/client'

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2>Trocar senha</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        {saved && <p className="help">Senha alterada.</p>}
        <div className="field">
          <label htmlFor="current-password">Senha atual</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label htmlFor="new-password-settings">Nova senha</label>
          <input
            id="new-password-settings"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <span className="help">Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</span>
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          Trocar senha
        </button>
      </form>

      <div className="card">
        <h2>Autenticação em duas etapas (2FA)</h2>
        <p className="help">
          Ainda não implementado nesta sessão — ficou como sub-item de prioridade menor dentro da tarefa
          de Segurança. Ver <code>etapa5-progress.md</code> para o registro dessa pendência.
        </p>
      </div>
    </div>
  )
}
