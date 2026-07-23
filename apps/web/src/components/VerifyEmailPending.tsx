export function VerifyEmailPending({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
  return (
    <div>
      <h1>Verifique seu email</h1>
      <p>
        Enviamos um link de confirmação para <strong>{email}</strong>. Abra o email e clique no link
        para ativar sua conta.
      </p>
      <p className="help">
        Não recebeu? Confira a caixa de spam. (Ambiente de desenvolvimento: o envio de email é um stub
        — o link aparece no log do servidor, não é enviado de verdade.)
      </p>
      <button className="link" type="button" onClick={onBackToLogin}>
        Voltar para o login
      </button>
    </div>
  )
}
