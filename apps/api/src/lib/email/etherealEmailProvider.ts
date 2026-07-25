import nodemailer, { type Transporter, type SentMessageInfo, type TestAccount } from 'nodemailer'
import { redactEmail } from '@artemis-united/logging'
import type { EmailMessage, EmailProvider } from './EmailProvider.js'

// Ethereal Email (https://ethereal.email, mantido pela equipe do Nodemailer) —
// escolhido para dev/staging em vez de Mailtrap porque a conta de teste é
// criada por API (createTestAccount), sem cadastro manual nem token de conta
// de terceiro para configurar. O trade-off: como não existe delivery real,
// verificar o CONTEÚDO da mensagem em teste automatizado exige buscar via
// IMAP com as mesmas credenciais da conta de teste (ver
// etherealInbox.ts/testSupport), não uma API REST de inbox como a do
// Mailtrap. A conta é recriada a cada boot do processo (efêmera, de
// propósito — não é destino de produção).
//
// Escolha do provedor final de PRODUÇÃO continua em aberto — decisão
// separada, não tomada aqui (ver docs/architecture.md).

let testAccountPromise: Promise<TestAccount> | null = null
let transporterPromise: Promise<Transporter<SentMessageInfo>> | null = null

export async function getEtherealTestAccount(): Promise<TestAccount> {
  if (!testAccountPromise) {
    testAccountPromise = nodemailer.createTestAccount()
  }
  return testAccountPromise
}

async function getTransporter(): Promise<Transporter<SentMessageInfo>> {
  if (!transporterPromise) {
    transporterPromise = getEtherealTestAccount().then((account) =>
      nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
    )
  }
  return transporterPromise
}

export class EtherealEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const [transporter, account] = await Promise.all([getTransporter(), getEtherealTestAccount()])

    const info = await transporter.sendMail({
      from: `"Artemis United" <${account.user}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })

    // Mesmo padrão de log estruturado do stub anterior e de
    // bob-engine/lib/observability.ts — só que agora com uma mensagem SMTP
    // real por trás (previewUrl deixa o conteúdo inspecionável sem precisar
    // de IMAP).
    console.log(
      JSON.stringify({
        event: 'email.sent',
        provider: 'ethereal',
        to: redactEmail(message.to),
        subject: message.subject,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
        timestamp: new Date().toISOString(),
      }),
    )
  }
}
