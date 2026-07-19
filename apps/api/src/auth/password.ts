import argon2 from 'argon2'

// 8+ caracteres, com ao menos uma minuscula, uma maiuscula, um numeral e um caractere especial.
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\dA-Za-z]).{8,}$/

export function isPasswordValid(password: string): boolean {
  return PASSWORD_POLICY.test(password)
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}
