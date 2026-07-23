import { useState } from 'react'
import { logout } from '../api/auth'
import { PersonalDataSettings } from './PersonalDataSettings'

type SettingsTab = 'personal' | 'business' | 'security'

export function SettingsScreen({
  onBack,
  onLoggedOut,
}: {
  onBack: () => void
  onLoggedOut: () => void
}) {
  const [tab, setTab] = useState<SettingsTab>('personal')

  return (
    <div>
      <div className="top-bar">
        <h1>Configurações</h1>
        <button
          className="link"
          type="button"
          onClick={() => {
            void logout().then(onLoggedOut)
          }}
        >
          Sair
        </button>
      </div>

      <div className="back-row">
        <button className="link" type="button" onClick={onBack}>
          ← Voltar ao painel
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'personal' ? 'tab active' : 'tab'}
          onClick={() => setTab('personal')}
        >
          Dados Pessoais
        </button>
        <button
          type="button"
          className={tab === 'business' ? 'tab active' : 'tab'}
          onClick={() => setTab('business')}
        >
          Dados do Negócio
        </button>
        <button
          type="button"
          className={tab === 'security' ? 'tab active' : 'tab'}
          onClick={() => setTab('security')}
        >
          Segurança
        </button>
      </div>

      {tab === 'personal' && <PersonalDataSettings />}
      {tab === 'business' && <p>Em construção — chega em breve.</p>}
      {tab === 'security' && <p>Em construção — chega em breve.</p>}
    </div>
  )
}
