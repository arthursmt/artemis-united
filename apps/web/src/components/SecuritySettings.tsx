import { useEffect, useState } from 'react'
import { track } from '@artemis-united/analytics'
import { changePassword, me, toggleTwoFactor } from '../api/auth'
import { ApiError } from '../api/client'

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [twoFactorLoading, setTwoFactorLoading] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null)
  const [twoFactorToggling, setTwoFactorToggling] = useState(false)

  useEffect(() => {
    let cancelled = false
    me()
      .then((result) => {
        if (cancelled || !result) return
        setTwoFactorEnabled(result.user.twoFactorEnabled ?? false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTwoFactorError(err instanceof ApiError ? err.message : 'Não foi possível carregar o estado do 2FA.')
        }
      })
      .finally(() => {
        if (!cancelled) setTwoFactorLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleTwoFactorChange(nextEnabled: boolean) {
    setTwoFactorError(null)
    setTwoFactorToggling(true)
    try {
      const result = await toggleTwoFactor(nextEnabled)
      if (!result) return
      setTwoFactorEnabled(result.twoFactorEnabled)
      // Só o caminho "ligou" é o evento decidido (seção 7 do plano mestre,
      // Fase 5 do reforço de QA) — desligar não tem evento próprio definido.
      if (result.twoFactorEnabled) {
        track('two_factor_enabled', {})
      }
    } catch (err) {
      setTwoFactorError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o 2FA. Tente de novo.')
    } finally {
      setTwoFactorToggling(false)
    }
  }

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
        {twoFactorLoading ? (
          <p>Carregando...</p>
        ) : (
          <>
            {twoFactorError && <p className="error">{twoFactorError}</p>}
            <div className="field field-checkbox">
              <label htmlFor="two-factor-toggle">
                <input
                  id="two-factor-toggle"
                  type="checkbox"
                  checked={twoFactorEnabled}
                  disabled={twoFactorToggling}
                  onChange={(e) => void handleTwoFactorChange(e.target.checked)}
                />
                Pedir um código por email a cada novo login
              </label>
            </div>
            <span className="help">
              Com o 2FA ativo, cada login em um dispositivo novo exige um código enviado por email, além
              da senha.
            </span>
          </>
        )}
      </div>
    </div>
  )
}
