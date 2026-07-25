import { redactEmail } from '@artemis-united/logging'
import { EtherealEmailProvider } from './etherealEmailProvider.js'
import { ResendEmailProvider } from './resendEmailProvider.js'
import type { EmailMessage, EmailProvider } from './EmailProvider.js'

// Resend é o provedor de PRODUÇÃO (decisão fechada, ver Log de decisões do
// plano mestre). Seleção por presença de credencial, mesmo padrão de
// SENTRY_DSN/ANTHROPIC_API_KEY: com RESEND_API_KEY configurada, usa Resend;
// sem ela (dev local, por padrão), cai para Ethereal — nenhum ambiente sem
// a chave fica sem conseguir enviar/inspecionar email.
let provider: EmailProvider | null = null

function getEmailProvider(): EmailProvider {
  if (!provider) {
    const resendApiKey = process.env.RESEND_API_KEY
    provider = resendApiKey ? new ResendEmailProvider(resendApiKey) : new EtherealEmailProvider()
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
        to: redactEmail(message.to),
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
