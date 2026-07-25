import { afterEach, describe, expect, it } from 'vitest'
import { checkLoginLockout, clearLoginAttempts, recordFailedLogin } from './loginRateLimit.js'

function uniqueEmail(label: string): string {
  return `qa.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

const cleanupKeys: Array<{ ip: string; email: string }> = []
afterEach(async () => {
  for (const { ip, email } of cleanupKeys.splice(0)) {
    await clearLoginAttempts(ip, email)
  }
})

describe('loginRateLimit', () => {
  it('não bloqueia antes do limiar de falhas livres', async () => {
    const email = uniqueEmail('below-threshold')
    cleanupKeys.push({ ip: '1.2.3.4', email })

    for (let i = 0; i < 4; i++) {
      await recordFailedLogin('1.2.3.4', email)
    }

    expect((await checkLoginLockout('1.2.3.4', email)).locked).toBe(false)
  })

  it('bloqueia depois do limiar, com duração progressiva crescente', async () => {
    const email = uniqueEmail('progressive')
    cleanupKeys.push({ ip: '1.2.3.4', email })

    for (let i = 0; i < 5; i++) {
      await recordFailedLogin('1.2.3.4', email)
    }
    const first = await checkLoginLockout('1.2.3.4', email)
    expect(first.locked).toBe(true)
    if (!first.locked) throw new Error('unreachable')

    await recordFailedLogin('1.2.3.4', email)
    const second = await checkLoginLockout('1.2.3.4', email)
    expect(second.locked).toBe(true)
    if (!second.locked) throw new Error('unreachable')

    expect(second.retryAfterSeconds).toBeGreaterThan(first.retryAfterSeconds)
  })

  it('IP diferente com o mesmo email não herda o bloqueio de outro IP', async () => {
    const email = uniqueEmail('ip-isolation')
    cleanupKeys.push({ ip: '1.1.1.1', email }, { ip: '2.2.2.2', email })

    for (let i = 0; i < 6; i++) {
      await recordFailedLogin('1.1.1.1', email)
    }

    expect((await checkLoginLockout('1.1.1.1', email)).locked).toBe(true)
    expect((await checkLoginLockout('2.2.2.2', email)).locked).toBe(false)
  })

  it('mesmo IP com email diferente não herda o bloqueio de outra conta', async () => {
    const emailA = uniqueEmail('email-isolation-a')
    const emailB = uniqueEmail('email-isolation-b')
    cleanupKeys.push({ ip: '9.9.9.9', email: emailA }, { ip: '9.9.9.9', email: emailB })

    for (let i = 0; i < 6; i++) {
      await recordFailedLogin('9.9.9.9', emailA)
    }

    expect((await checkLoginLockout('9.9.9.9', emailA)).locked).toBe(true)
    expect((await checkLoginLockout('9.9.9.9', emailB)).locked).toBe(false)
  })

  it('clearLoginAttempts remove o bloqueio por completo', async () => {
    const email = uniqueEmail('clear')
    cleanupKeys.push({ ip: '5.5.5.5', email })

    for (let i = 0; i < 6; i++) {
      await recordFailedLogin('5.5.5.5', email)
    }
    expect((await checkLoginLockout('5.5.5.5', email)).locked).toBe(true)

    await clearLoginAttempts('5.5.5.5', email)
    expect((await checkLoginLockout('5.5.5.5', email)).locked).toBe(false)
  })
})
