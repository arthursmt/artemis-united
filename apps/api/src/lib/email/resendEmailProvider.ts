import { Resend } from 'resend'
import { redactEmail } from '@artemis-united/logging'
import type { EmailMessage, EmailProvider } from './EmailProvider.js'

// Provedor de PRODUÇÃO — decisão fechada com o fundador (ver Log de decisões
// do plano mestre). Só é selecionado quando RESEND_API_KEY está presente
// (index.ts) — sem a chave, o app cai para EtherealEmailProvider, mesmo
// padrão de "sem credencial = fallback seguro" já usado em SENTRY_DSN
// (bob-engine) e ANTHROPIC_API_KEY (chat).
const DEFAULT_FROM_ADDRESS = 'Artemis United <onboarding@resend.dev>'

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend
  private readonly fromAddress: string

  constructor(apiKey: string, fromAddress: string = process.env.RESEND_FROM_ADDRESS ?? DEFAULT_FROM_ADDRESS) {
    this.client = new Resend(apiKey)
    this.fromAddress = fromAddress
  }

  async send(message: EmailMessage): Promise<void> {
    const result = await this.client.emails.send({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? message.text,
    })

    if (result.error) {
      throw new Error(`Resend: ${result.error.message}`)
    }

    console.log(
      JSON.stringify({
        event: 'email.sent',
        provider: 'resend',
        to: redactEmail(message.to),
        subject: message.subject,
        messageId: result.data?.id,
        timestamp: new Date().toISOString(),
      }),
    )
  }
}
