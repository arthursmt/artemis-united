import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DreForm } from './DreForm'
import { submitDre } from '../api/financialStatements'

// track() chama posthog.capture direto (packages/analytics/src/track.ts) —
// mockado aqui pra isolar o teste de comportamento de wizard do SDK real do
// PostHog (sem posthog.init() nesse ambiente de teste, não é o que está sob
// teste).
vi.mock('@artemis-united/analytics', () => ({
  track: vi.fn(),
  toTimeSpentBracket: () => '0-10',
}))

vi.mock('../api/financialStatements', () => ({
  submitDre: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function fillCurrentBlock(user: ReturnType<typeof userEvent.setup>, value: string) {
  const input = screen.getByRole('spinbutton')
  await user.clear(input)
  await user.type(input, value)
}

// "Bloco {n} de 6" é renderizado como texto quebrado em nós separados pela
// interpolação JSX (`Bloco {step + 1} de {FIELDS.length}`) — getByText com
// string exata não bate contra um único nó de texto, precisa checar o
// textContent normalizado do parágrafo inteiro.
function expectBlockNumber(n: number) {
  expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.startsWith(`Bloco ${n} de 6`) === true)).toBeInTheDocument()
}

describe('DreForm — salvamento parcial em memória entre blocos', () => {
  it('preserva o valor de um bloco ao avançar e depois voltar pra ele', async () => {
    const user = userEvent.setup()
    render(<DreForm onSubmitted={vi.fn()} onCancel={vi.fn()} />)

    await fillCurrentBlock(user, '5000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // bloco 2 — outro campo, tela nova
    expectBlockNumber(2)

    await user.click(screen.getByRole('button', { name: '← Voltar' }))

    // de volta ao bloco 1 — o valor digitado antes continua lá, não zerou
    expectBlockNumber(1)
    expect(screen.getByRole('spinbutton')).toHaveValue(5000)
  })

  it('preserva valores de vários blocos até a tela de resumo', async () => {
    const user = userEvent.setup()
    render(<DreForm onSubmitted={vi.fn()} onCancel={vi.fn()} />)

    const values = ['1000', '200', '300', '50', '0', '400']
    for (const value of values) {
      await fillCurrentBlock(user, value)
      await user.click(screen.getByRole('button', { name: 'Continuar' }))
    }

    expect(screen.getByText('Revise antes de calcular')).toBeInTheDocument()
    for (const value of values) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
  })
})

describe('DreForm — cancelamento sem submissão', () => {
  it('cancelar no meio do wizard chama onCancel e nunca submete', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSubmitted = vi.fn()
    render(<DreForm onSubmitted={onSubmitted} onCancel={onCancel} />)

    await fillCurrentBlock(user, '1234')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmitted).not.toHaveBeenCalled()
    expect(submitDre).not.toHaveBeenCalled()
  })

  it('voltar da tela de resumo e cancelar em seguida também não submete (resumo não tem botão Cancelar próprio)', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSubmitted = vi.fn()
    render(<DreForm onSubmitted={onSubmitted} onCancel={onCancel} />)

    for (let i = 0; i < 6; i++) {
      await fillCurrentBlock(user, '100')
      await user.click(screen.getByRole('button', { name: 'Continuar' }))
    }
    expect(screen.getByText('Revise antes de calcular')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Voltar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(submitDre).not.toHaveBeenCalled()
  })
})
