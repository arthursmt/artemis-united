// Contrato único pros dois fluxos que dependem de email (confirmação de
// cadastro/reenvio, 2FA por login, reset de senha — ver auth/routes/auth.ts).
// Trocar de provedor (dev/staging -> produção) é implementar esta interface
// de novo, sem tocar nos call-sites em auth.ts.
export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>
}
