import { apiFetch } from './client'
import type { User } from '../types'

export function signup(
  email: string,
  password: string,
  confirmPassword: string,
  acceptedTerms: boolean,
): Promise<{ user: User; verificationRequired: true } | undefined> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, confirmPassword, acceptedTerms }),
  })
}

export function verifyEmail(token: string): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}

export function login(email: string, password: string): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function forgotPassword(email: string): Promise<{ message: string } | undefined> {
  return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

export function resetPassword(token: string, newPassword: string): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) })
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string } | undefined> {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function me(): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/me')
}

// Fase 1 do reforço de QA (2026-07-24): reconfirmação obrigatória — senha
// atual OU código de 2FA atual (só quando já ativo), nunca os dois vazios.
export function toggleTwoFactor(
  enabled: boolean,
  proof: { password: string } | { code: string },
): Promise<{ twoFactorEnabled: boolean } | undefined> {
  return apiFetch('/auth/two-factor/toggle', { method: 'POST', body: JSON.stringify({ enabled, ...proof }) })
}

export function requestTwoFactorConfirmationCode(): Promise<{ sent: true } | undefined> {
  return apiFetch('/auth/two-factor/request-code', { method: 'POST' })
}

export function logout(): Promise<undefined> {
  return apiFetch('/auth/logout', { method: 'POST' })
}
