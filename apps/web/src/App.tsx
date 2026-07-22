import { useEffect, useState } from 'react'
import { me } from './api/auth'
import { getMyBusiness } from './api/businesses'
import { AuthForm } from './components/AuthForm'
import { BusinessOnboardingForm } from './components/BusinessOnboardingForm'
import { Dashboard } from './components/Dashboard'
import { DreForm } from './components/DreForm'
import type { Business, User } from './types'
import './App.css'

type View =
  | { name: 'loading' }
  | { name: 'auth' }
  | { name: 'onboarding' }
  | { name: 'dashboard' }
  | { name: 'dre-form' }

function App() {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [, setUser] = useState<User | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)

  // Usado tanto no restore de sessão (mount) quanto logo após um login/signup —
  // nos dois casos precisamos saber se o usuário já tem negócio antes de decidir
  // entre onboarding e dashboard.
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

    async function restoreSession() {
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
      />
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
