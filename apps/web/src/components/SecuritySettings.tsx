import { useEffect, useState } from 'react'
import { track } from '@artemis-united/analytics'
import { changePassword, me, requestTwoFactorConfirmationCode, toggleTwoFactor } from '../api/auth'
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

  // Fase 1 do reforço de QA (2026-07-24): ligar/desligar 2FA exige
  // reconfirmação — senha atual sempre, ou um código por email como
  // alternativa quando o usuário já tem 2FA ativo (não existe código pra
  // provar posse de algo que nunca foi ligado). `pendingEnabled` é o valor
  // que o usuário pediu, ainda não confirmado — o checkbox continua
  // refletindo o estado real do servidor (`twoFactorEnabled`) até a
  // confirmação ter sucesso.
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [requestingCode, setRequestingCode] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

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

  function startToggle(nextEnabled: boolean) {
    setPendingEnabled(nextEnabled)
    setConfirmPassword('')
    setConfirmCode('')
    setCodeRequested(false)
    setConfirmError(null)
  }

  function cancelToggle() {
    setPendingEnabled(null)
    setConfirmPassword('')
    setConfirmCode('')
    setCodeRequested(false)
    setConfirmError(null)
  }

  async function handleRequestCode() {
    setConfirmError(null)
    setRequestingCode(true)
    try {
      const result = await requestTwoFactorConfirmationCode()
      if (result) setCodeRequested(true)
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Não foi possível enviar o código. Tente de novo.')
    } finally {
      setRequestingCode(false)
    }
  }

  async function handleConfirmToggle(e: React.FormEvent) {
    e.preventDefault()
    if (pendingEnabled === null) return
    setConfirmError(null)
    setConfirming(true)
    try {
      const proof = confirmCode.trim() !== '' ? { code: confirmCode.trim() } : { password: confirmPassword }
      const result = await toggleTwoFactor(pendingEnabled, proof)
      if (!result) return
      setTwoFactorEnabled(result.twoFactorEnabled)
      // Só o caminho "ligou" é o evento decidido (seção 7 do plano mestre,
      // Fase 5 do reforço de QA) — desligar não tem evento próprio definido.
      if (result.twoFactorEnabled) {
        track('two_factor_enabled', {})
      }
      cancelToggle()
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Senha ou código incorretos.')
    } finally {
      setConfirming(false)
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
                  disabled={pendingEnabled !== null}
                  onChange={(e) => startToggle(e.target.checked)}
                />
                Pedir um código por email a cada novo login
              </label>
            </div>
            <span className="help">
              Com o 2FA ativo, cada login em um dispositivo novo exige um código enviado por email, além
              da senha.
            </span>

            {pendingEnabled !== null && (
              <form onSubmit={(e) => void handleConfirmToggle(e)} className="card">
                <p>
                  {pendingEnabled
                    ? 'Confirme sua senha atual pra ativar o 2FA.'
                    : 'Confirme sua senha atual ou um código por email pra desativar o 2FA.'}
                </p>
                {confirmError && <p className="error">{confirmError}</p>}
                <div className="field">
                  <label htmlFor="confirm-two-factor-password">Senha atual</label>
                  <input
                    id="confirm-two-factor-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setConfirmCode('')
                    }}
                    autoComplete="current-password"
                  />
                </div>
                {!pendingEnabled &&
                  (codeRequested ? (
                    <div className="field">
                      <label htmlFor="confirm-two-factor-code">Ou o código recebido por email</label>
                      <input
                        id="confirm-two-factor-code"
                        type="text"
                        inputMode="numeric"
                        value={confirmCode}
                        onChange={(e) => {
                          setConfirmCode(e.target.value)
                          setConfirmPassword('')
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      className="link"
                      type="button"
                      disabled={requestingCode}
                      onClick={() => void handleRequestCode()}
                    >
                      Ou usar um código por email
                    </button>
                  ))}
                <button className="primary" type="submit" disabled={confirming}>
                  Confirmar
                </button>
                {' · '}
                <button className="link" type="button" onClick={cancelToggle}>
                  Cancelar
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
