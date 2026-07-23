import { useState } from 'react'
import { forgotPassword } from '../api/auth'
import { ApiError } from '../api/client'

export function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div>
        <h1>Verifique seu email</h1>
        <p>Se <strong>{email}</strong> estiver cadastrado, enviamos um link para redefinir sua senha.</p>
        <p className="help">
          Ambiente de desenvolvimento: o envio de email é um stub — o link aparece no log do servidor.
        </p>
        <button className="link" type="button" onClick={onBackToLogin}>
          Voltar para o login
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1>Esqueci minha senha</h1>
      <p>Informe seu email — enviaremos um link para redefinir sua senha.</p>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          Enviar link
        </button>
      </form>
      <div className="toggle-row">
        <button className="link" type="button" onClick={onBackToLogin}>
          Voltar para o login
        </button>
      </div>
    </div>
  )
}
