import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getEtherealTestAccount } from '../lib/email/index.js'

// Helper de TESTE, não código de produção. Busca a mensagem mais recente
// endereçada a `to` na mesma conta de teste Ethereal usada pelo app
// (etherealEmailProvider.ts cacheia a conta a nível de processo — dentro de
// um mesmo `vitest run`, app e teste enxergam a mesma caixa). Existe porque
// a Fase 3 exige verificar o CONTEÚDO real da mensagem entregue, não apenas
// que send() foi chamado.
export async function fetchLatestEmailTo(
  to: string,
  timeoutMs = 15_000,
): Promise<{ subject: string; text: string; html: string }> {
  const account = await getEtherealTestAccount()
  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: { user: account.user, pass: account.pass },
    logger: false,
  })

  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const deadline = Date.now() + timeoutMs
      // Poll curto — a entrega no Ethereal é quase instantânea, mas não é
      // síncrona com o retorno de transporter.sendMail() no lado do app.
      while (Date.now() < deadline) {
        const uids = await client.search({ to }, { uid: true })
        if (uids && uids.length > 0) {
          const uid = uids[uids.length - 1]
          const message = await client.fetchOne(uid, { source: true }, { uid: true })
          if (message && message.source) {
            const parsed = await simpleParser(message.source)
            return {
              subject: parsed.subject ?? '',
              text: parsed.text ?? '',
              html: typeof parsed.html === 'string' ? parsed.html : '',
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      throw new Error(`nenhum email encontrado para ${to} dentro de ${timeoutMs}ms`)
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}
