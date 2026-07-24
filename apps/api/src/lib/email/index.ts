import { EtherealEmailProvider } from './etherealEmailProvider.js'
import type { EmailMessage, EmailProvider } from './EmailProvider.js'

// Nenhum provedor de PRODUÇÃO foi escolhido ainda (decisão de infra em
// aberto, ver docs/architecture.md) — Ethereal é a única implementação hoje,
// usada em qualquer ambiente. Quando um provedor de produção for decidido,
// este é o único ponto a mexer para selecionar entre implementações (por
// NODE_ENV, por exemplo).
let provider: EmailProvider | null = null

function getEmailProvider(): EmailProvider {
  if (!provider) {
    provider = new EtherealEmailProvider()
  }
  return provider
}

// Falha de envio nunca deve travar o fluxo de auth que a disparou — a conta
// já foi criada, o código de 2FA já foi gravado, etc. antes deste ponto;
// "mandar email" é best-effort, mesmo padrão do stub que isto substitui.
// Falha vira log estruturado, não erro 500 pro cliente. Os endpoints de
// reenvio (resend-verification, resend-2fa) existem justamente para dar uma
// segunda chance quando isso acontece.
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await getEmailProvider().send(message)
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'email.send_failed',
        to: message.to,
        subject: message.subject,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    )
  }
}

export { getEtherealTestAccount } from './etherealEmailProvider.js'
export * from './templates.js'
export type { EmailMessage, EmailProvider } from './EmailProvider.js'
