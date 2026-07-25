import { describe, expect, it } from 'vitest'
import { hashId, redactEmail, toAmountBracket } from './redact.js'

describe('redactEmail', () => {
  it('mantém o domínio e a primeira letra, mascara o resto do local-part', () => {
    expect(redactEmail('arthurtms@hotmail.com')).toBe('a***@hotmail.com')
  })

  it('nunca deixa o endereço completo aparecer no resultado', () => {
    const email = 'qa.2fa-manual-test@example.com'
    expect(redactEmail(email)).not.toContain(email)
    expect(redactEmail(email)).toBe('q***@example.com')
  })

  it('entrada sem "@" vira só ***', () => {
    expect(redactEmail('nao-e-um-email')).toBe('***')
  })
})

describe('toAmountBracket', () => {
  it('classifica valores nas faixas do teto do microloan (decisão #36)', () => {
    expect(toAmountBracket(0)).toBe('0-4999')
    expect(toAmountBracket(4999)).toBe('0-4999')
    expect(toAmountBracket(5000)).toBe('5000-14999')
    expect(toAmountBracket(14999)).toBe('5000-14999')
    expect(toAmountBracket(15000)).toBe('15000-29999')
    expect(toAmountBracket(29999)).toBe('15000-29999')
    expect(toAmountBracket(30000)).toBe('30000-49999')
    expect(toAmountBracket(49999)).toBe('30000-49999')
    expect(toAmountBracket(50000)).toBe('50000+')
    expect(toAmountBracket(1_000_000)).toBe('50000+')
  })
})

describe('hashId', () => {
  it('é determinístico — o mesmo id sempre produz o mesmo hash', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    expect(hashId(id)).toBe(hashId(id))
  })

  it('nunca deixa o id original aparecer no resultado', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    expect(hashId(id)).not.toContain(id)
  })

  it('ids diferentes produzem hashes diferentes', () => {
    const a = hashId('11111111-1111-1111-1111-111111111111')
    const b = hashId('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
  })
})
