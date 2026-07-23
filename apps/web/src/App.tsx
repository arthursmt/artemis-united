import { useEffect, useState } from 'react'
import { me, verifyEmail } from './api/auth'
import { getMyBusiness } from './api/businesses'
import { ApiError } from './api/client'
import { AuthForm } from './components/AuthForm'
import { BusinessOnboardingForm } from './components/BusinessOnboardingForm'
import { Dashboard } from './components/Dashboard'
import { DreForm } from './components/DreForm'
import { VerifyEmailPending } from './components/VerifyEmailPending'
import type { Business, User } from './types'
import './App.css'

type View =
  | { name: 'loading' }
  | { name: 'auth' }
  | { name: 'verify-pending'; email: string }
  | { name: 'verify-error'; message: string }
  | { name: 'onboarding' }
  | { name: 'dashboard' }
  | { name: 'dre-form' }

function App() {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [, setUser] = useState<User | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)

  // Usado tanto no restore de sessão (mount) quanto logo após um login/signup/
  // confirmação de email — nos três casos precisamos saber se o usuário já tem
  // negócio antes de decidir entre onboarding e dashboard.
  async function routeAfterAuth() {
    const businessResult = await getMyBusiness().catch(() => undefined)
    if (!businessResult) {
      setView({ name: 'onboarding' })
      return
    }
    setBusiness(businessResult.business)
    setView({ name: 'dashboard' })
  }

  useEffect(() => {
    let cancelled = false

    // Link de confirmação de email aponta pra cá com ?verify=<token> (ver
    // apps/api/src/routes/auth.ts). Sem router — lê a query string direto e
    // limpa a URL depois, pra não reconsumir o token num F5.
    async function handleEmailVerificationLink(token: string) {
      window.history.replaceState({}, '', window.location.pathname)
      try {
        const result = await verifyEmail(token)
        if (cancelled || !result) return
        setUser(result.user)
        await routeAfterAuth()
      } catch (err) {
        if (cancelled) return
        setView({
          name: 'verify-error',
          message: err instanceof ApiError ? err.message : 'Não foi possível confirmar o email.',
        })
      }
    }

    async function restoreSession() {
      const params = new URLSearchParams(window.location.search)
      const verifyToken = params.get('verify')
      if (verifyToken) {
        await handleEmailVerificationLink(verifyToken)
        return
      }

      const meResult = await me().catch(() => undefined)
      if (cancelled) return
      if (!meResult) {
        setView({ name: 'auth' })
        return
      }
      setUser(meResult.user)
      if (cancelled) return
      await routeAfterAuth()
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  if (view.name === 'loading') {
    return <p>Carregando...</p>
  }

  if (view.name === 'auth') {
    return (
      <AuthForm
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser)
          void routeAfterAuth()
        }}
        onSignupRequiresVerification={(email) => setView({ name: 'verify-pending', email })}
      />
    )
  }

  if (view.name === 'verify-pending') {
    return <VerifyEmailPending email={view.email} onBackToLogin={() => setView({ name: 'auth' })} />
  }

  if (view.name === 'verify-error') {
    return (
      <div>
        <h1>Não foi possível confirmar seu email</h1>
        <p className="error">{view.message}</p>
        <button className="link" type="button" onClick={() => setView({ name: 'auth' })}>
          Voltar para o login
        </button>
      </div>
    )
  }

  if (view.name === 'onboarding') {
    return (
      <BusinessOnboardingForm
        onCreated={(createdBusiness) => {
          setBusiness(createdBusiness)
          setView({ name: 'dre-form' })
        }}
      />
    )
  }

  if (view.name === 'dre-form') {
    return <DreForm onSubmitted={() => setView({ name: 'dashboard' })} />
  }

  if (!business) {
    // Não deveria acontecer — dashboard só é alcançável com negócio já carregado.
    return <p>Algo deu errado. Recarregue a página.</p>
  }

  return (
    <Dashboard
      business={business}
      onOpenDreForm={() => setView({ name: 'dre-form' })}
      onLoggedOut={() => {
        setUser(null)
        setBusiness(null)
        setView({ name: 'auth' })
      }}
    />
  )
}

export default App
