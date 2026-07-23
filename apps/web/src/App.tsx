import { useEffect, useState } from 'react'
import { me, verifyEmail } from './api/auth'
import { getMyBusiness } from './api/businesses'
import { ApiError } from './api/client'
import { getMyCustomerProfile } from './api/customerProfile'
import { AuthForm } from './components/AuthForm'
import { BusinessOnboardingForm } from './components/BusinessOnboardingForm'
import { CustomerOnboardingForm } from './components/CustomerOnboardingForm'
import { Dashboard } from './components/Dashboard'
import { DreForm } from './components/DreForm'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { VerifyEmailPending } from './components/VerifyEmailPending'
import type { Business, User } from './types'
import './App.css'

type View =
  | { name: 'loading' }
  | { name: 'auth' }
  | { name: 'forgot-password' }
  | { name: 'reset-password'; token: string }
  | { name: 'verify-pending'; email: string }
  | { name: 'verify-error'; message: string }
  | { name: 'customer-onboarding' }
  | { name: 'business-onboarding' }
  | { name: 'dashboard' }
  | { name: 'dre-form' }

function App() {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [, setUser] = useState<User | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)

  // Usado tanto no restore de sessão (mount) quanto logo após um login/signup/
  // confirmação de email/reset de senha — em todos os casos precisamos decidir
  // entre onboarding-cliente, onboarding-negócio ou dashboard, nessa ordem
  // (perfil pessoal antes de negócio).
  async function routeAfterAuth() {
    const profileResult = await getMyCustomerProfile().catch(() => undefined)
    if (!profileResult) {
      setView({ name: 'customer-onboarding' })
      return
    }

    const businessResult = await getMyBusiness().catch(() => undefined)
    if (!businessResult) {
      setView({ name: 'business-onboarding' })
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
      const resetToken = params.get('reset')

      if (verifyToken || resetToken) {
        window.history.replaceState({}, '', window.location.pathname)
      }

      if (verifyToken) {
        await handleEmailVerificationLink(verifyToken)
        return
      }

      // Reset de senha não é consumido automaticamente — só mostra o
      // formulário; o POST acontece quando o usuário envia a nova senha.
      if (resetToken) {
        setView({ name: 'reset-password', token: resetToken })
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
        onForgotPassword={() => setView({ name: 'forgot-password' })}
      />
    )
  }

  if (view.name === 'forgot-password') {
    return <ForgotPasswordForm onBackToLogin={() => setView({ name: 'auth' })} />
  }

  if (view.name === 'reset-password') {
    return (
      <ResetPasswordForm
        token={view.token}
        onReset={(resetUser) => {
          setUser(resetUser)
          void routeAfterAuth()
        }}
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

  if (view.name === 'customer-onboarding') {
    return <CustomerOnboardingForm onCreated={() => setView({ name: 'business-onboarding' })} />
  }

  if (view.name === 'business-onboarding') {
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
