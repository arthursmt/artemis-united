import { apiFetch } from './client'

export type AskBobResult = { configured: false; reply?: undefined } | { configured: true; reply: string }

export function askBob(message: string): Promise<AskBobResult | undefined> {
  return apiFetch('/chat', { method: 'POST', body: JSON.stringify({ message }) })
}
