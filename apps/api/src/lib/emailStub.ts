// Nenhum provedor de email real foi configurado nesta sessão (sem credencial
// real, sem SMTP, sem Postmark/Resend/SES). Mesmo padrão do SENTRY_DSN vazio em
// services/bob-engine: sem credencial, a ação vira log estruturado em vez de
// falhar ou simular sucesso silenciosamente. Trocar por um provedor real é o
// único ponto a mexer quando isso for decidido — a assinatura da função não
// muda.
export function sendStubEmail(to: string, subject: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      event: 'email.stub_sent',
      to,
      subject,
      ...data,
      timestamp: new Date().toISOString(),
    }),
  )
}
