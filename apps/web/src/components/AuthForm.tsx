import { useState } from 'react'
import { login, signup } from '../api/auth'
import { ApiError } from '../api/client'
import type { User } from '../types'

export function AuthForm({
  onAuthenticated,
  onSignupRequiresVerification,
  onForgotPassword,
}: {
  onAuthenticated: (user: User) => void
  onSignupRequiresVerification: (email: string) => void
  onForgotPassword: () => void
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const result = await login(email, password)
        if (result) {
          onAuthenticated(result.user)
        }
      } else {
        const result = await signup(email, password, acceptedTerms)
        if (result) {
          onSignupRequiresVerification(result.user.email)
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Artemis United</h1>
      <form onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {mode === 'signup' && (
          <div className="field field-checkbox">
            <label htmlFor="accepted-terms">
              <input
                id="accepted-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
              />
              Li e aceito os Termos de Uso e a Política de Privacidade
            </label>
          </div>
        )}
        <button className="primary" type="submit" disabled={submitting}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <div className="toggle-row">
        {mode === 'login' ? (
          <>
            Não tem conta?{' '}
            <button className="link" type="button" onClick={() => setMode('signup')}>
              Criar conta
            </button>
            {' · '}
            <button className="link" type="button" onClick={onForgotPassword}>
              Esqueci minha senha
            </button>
          </>
        ) : (
          <>
            Já tem conta?{' '}
            <button className="link" type="button" onClick={() => setMode('login')}>
              Entrar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
