import { useEffect, useState } from 'react'
import { toMoneyBracket, track } from '@artemis-united/analytics'
import type { SectorSegmentOrOutro } from '@artemis-united/shared-types'
import { me, verifyEmail } from './api/auth'
import { getMyBusiness } from './api/businesses'
import { ApiError } from './api/client'
import { getMyCustomerProfile } from './api/customerProfile'
import { AuthForm } from './components/AuthForm'
import { BusinessDetailsForm } from './components/BusinessDetailsForm'
import { BusinessOnboardingForm } from './components/BusinessOnboardingForm'
import { ChatScreen } from './components/ChatScreen'
import { CustomerOnboardingForm } from './components/CustomerOnboardingForm'
import { Dashboard } from './components/Dashboard'
import { DreForm } from './components/DreForm'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { SettingsScreen } from './components/SettingsScreen'
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
  | { name: 'business-details-onboarding' }
  | { name: 'route-error'; message: string }
  | { name: 'dashboard' }
  | { name: 'settings' }
  | { name: 'chat' }
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
    // 404 é o único caso que legitimamente significa "ainda não existe, manda
    // pro onboarding" — qualquer outro erro (rede, 500, etc.) NÃO pode ser
    // tratado da mesma forma, senão um usuário que já tem perfil/negócio
    // acaba sendo mandado de volta pro onboarding por causa de uma falha
    // transitória, e a segunda tentativa de criar esbarra num 409 sem
    // caminho pra frente (bug real encontrado em teste manual).
    let profileResult: Awaited<ReturnType<typeof getMyCustomerProfile>>
    try {
      profileResult = await getMyCustomerProfile()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setView({ name: 'customer-onboarding' })
        return
      }
      setView({
        name: 'route-error',
        message: err instanceof ApiError ? err.message : 'Não foi possível carregar seus dados. Tente novamente.',
      })
      return
    }
    if (!profileResult) {
      setView({ name: 'customer-onboarding' })
      return
    }

    let businessResult: Awaited<ReturnType<typeof getMyBusiness>>
    try {
      businessResult = await getMyBusiness()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setView({ name: 'business-onboarding' })
        return
      }
      setView({
        name: 'route-error',
        message: err instanceof ApiError ? err.message : 'Não foi possível carregar seu negócio. Tente novamente.',
      })
      return
    }
    if (!businessResult) {
      setView({ name: 'business-onboarding' })
      return
    }
    setBusiness(businessResult.business)
    // addressLine1 null = negócio criado (nome+setor, Etapa 4) mas ainda não
    // passou pelo segundo passo do onboarding (Etapa 5, seção 4.4).
    if (businessResult.business.addressLine1 === null) {
      setView({ name: 'business-details-onboarding' })
      return
    }
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
    // Reusa routeAfterAuth() em vez de assumir "próxima tela = business-onboarding":
    // a decisão de qual tela vem a seguir precisa ser sempre derivada do estado
    // real do servidor (perfil recém-criado pode não ser a única coisa que
    // mudou), não de uma suposição fixa de "próximo passo do fluxo linear".
    return <CustomerOnboardingForm onCreated={() => void routeAfterAuth()} />
  }

  if (view.name === 'business-onboarding') {
    return (
      <BusinessOnboardingForm
        onCreated={(createdBusiness) => {
          setBusiness(createdBusiness)
          setView({ name: 'business-details-onboarding' })
        }}
        // 409 aqui significa "o negócio que você tentou criar já existe" — não é
        // um erro terminal. Reusa routeAfterAuth() pra decidir a tela certa a
        // partir do negócio que já existe de verdade (pode já ter passado do
        // segundo passo do onboarding, indo direto pro dashboard).
        onAlreadyExists={() => void routeAfterAuth()}
      />
    )
  }

  if (view.name === 'business-details-onboarding') {
    return (
      <BusinessDetailsForm
        onSaved={(updatedBusiness) => {
          setBusiness(updatedBusiness)
          setView({ name: 'dre-form' })
        }}
      />
    )
  }

  if (view.name === 'route-error') {
    return (
      <div>
        <h1>Não foi possível carregar sua conta</h1>
        <p className="error">{view.message}</p>
        <button className="primary" type="button" onClick={() => void routeAfterAuth()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  if (view.name === 'dre-form') {
    return (
      <DreForm
        onSubmitted={(result) => {
          // Confidence_level/sectorSegment vêm do bob-engine (ConfidenceLevel
          // e SectorSegmentOrOutro lá são a fonte da verdade) — a interface
          // AssessmentView aqui só não preserva o literal type na travessia
          // HTTP, o valor em runtime já é garantido pelo produtor.
          if (result.confidenceLevel && result.recommendedAmount !== null) {
            track('assessment_completed', {
              confidence_level: result.confidenceLevel as 'low' | 'medium' | 'high',
              sector_segment: result.sectorSegment as SectorSegmentOrOutro,
              recommended_amount_bracket: toMoneyBracket(Number(result.recommendedAmount)),
            })
          }
          setView({ name: 'dashboard' })
        }}
        onCancel={() => setView({ name: 'dashboard' })}
      />
    )
  }

  if (view.name === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setView({ name: 'dashboard' })}
        onLoggedOut={() => {
          setUser(null)
          setBusiness(null)
          setView({ name: 'auth' })
        }}
      />
    )
  }

  if (view.name === 'chat') {
    return <ChatScreen onBack={() => setView({ name: 'dashboard' })} />
  }

  if (!business) {
    // Não deveria acontecer — dashboard só é alcançável com negócio já carregado.
    return <p>Algo deu errado. Recarregue a página.</p>
  }

  return (
    <Dashboard
      business={business}
      onOpenDreForm={() => setView({ name: 'dre-form' })}
      onOpenSettings={() => setView({ name: 'settings' })}
      onOpenChat={() => setView({ name: 'chat' })}
      onLoggedOut={() => {
        setUser(null)
        setBusiness(null)
        setView({ name: 'auth' })
      }}
    />
  )
}

export default App
