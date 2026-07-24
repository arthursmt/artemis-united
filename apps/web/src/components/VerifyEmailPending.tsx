export function VerifyEmailPending({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
  return (
    <div>
      <h1>Verifique seu email</h1>
      <p>
        Enviamos um link de confirmação para <strong>{email}</strong>. Abra o email e clique no link
        para ativar sua conta.
      </p>
      <p className="help">
        Não recebeu? Confira a caixa de spam. (Ambiente de desenvolvimento: o email sai de verdade via
        Ethereal, um provedor de teste — não chega numa caixa de entrada real. O link de confirmação
        aparece no log do servidor, junto com um link de preview para inspecionar a mensagem.)
      </p>
      <button className="link" type="button" onClick={onBackToLogin}>
        Voltar para o login
      </button>
    </div>
  )
}
