import { useState } from 'react'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import type { User } from '../types'

export function ResetPasswordForm({
  token,
  onReset,
}: {
  token: string
  onReset: (user: User) => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await resetPassword(token, newPassword)
      if (result) {
        onReset(result.user)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Redefinir senha</h1>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <span className="help">Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</span>
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          Redefinir senha
        </button>
      </form>
    </div>
  )
}
