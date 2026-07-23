import { useState } from 'react'
import { askBob } from '../api/chat'
import { ApiError } from '../api/client'

interface ChatMessage {
  role: 'user' | 'bob'
  text: string
}

export function ChatScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const message = input.trim()
    if (message === '') return

    setError(null)
    setMessages((prev) => [...prev, { role: 'user', text: message }])
    setInput('')
    setSending(true)
    try {
      const result = await askBob(message)
      if (!result) return
      if (!result.configured) {
        setNotConfigured(true)
        return
      }
      setMessages((prev) => [...prev, { role: 'bob', text: result.reply }])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="top-bar">
        <h1>Chat com BoB</h1>
      </div>
      <div className="back-row">
        <button className="link" type="button" onClick={onBack}>
          ← Voltar ao painel
        </button>
      </div>

      {notConfigured && (
        <div className="card">
          <p>
            O chat com o BoB ainda não está configurado neste ambiente (falta{' '}
            <code>ANTHROPIC_API_KEY</code>). Isso não é um erro do seu lado — é uma pendência de
            configuração do servidor.
          </p>
        </div>
      )}

      {!notConfigured && (
        <>
          <div className="card">
            {messages.length === 0 && <p className="help">Pergunte algo ao BoB sobre sua avaliação.</p>}
            {messages.map((m, i) => (
              <p key={i}>
                <strong>{m.role === 'user' ? 'Você' : 'BoB'}:</strong> {m.text}
              </p>
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="chat-input">Sua pergunta</label>
              <input
                id="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button className="primary" type="submit" disabled={sending}>
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  )
}
