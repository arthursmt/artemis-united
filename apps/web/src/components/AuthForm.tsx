import { useState } from 'react'
import { login, signup } from '../api/auth'
import { ApiError } from '../api/client'
import type { User } from '../types'

export function AuthForm({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = mode === 'login' ? await login(email, password) : await signup(email, password)
      if (result) {
        onAuthenticated(result.user)
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
