// Corpo das mensagens dos 3 fluxos que disparam email (confirmação de
// cadastro/reenvio, 2FA por login/reenvio, reset de senha). Texto simples é
// o formato canônico (sempre presente); HTML é só uma versão formatada do
// mesmo conteúdo, não a fonte da verdade — testes de integração devem
// asserir sobre o texto.
interface EmailContent {
  subject: string
  text: string
  html: string
}

export function verificationEmail(verificationUrl: string): EmailContent {
  return {
    subject: 'Confirme seu email — Artemis United',
    text: `Confirme seu email acessando o link a seguir: ${verificationUrl}`,
    html: `<p>Confirme seu email acessando o link a seguir: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
  }
}

export function twoFactorCodeEmail(code: string): EmailContent {
  return {
    subject: 'Seu código de acesso — Artemis United',
    text: `Seu código de acesso é: ${code} (expira em 10 minutos)`,
    html: `<p>Seu código de acesso é: <strong>${code}</strong> (expira em 10 minutos)</p>`,
  }
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  return {
    subject: 'Redefinir sua senha — Artemis United',
    text: `Redefina sua senha acessando o link a seguir: ${resetUrl}`,
    html: `<p>Redefina sua senha acessando o link a seguir: <a href="${resetUrl}">${resetUrl}</a></p>`,
  }
}
