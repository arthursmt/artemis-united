import { apiFetch } from './client'
import type { User } from '../types'

export function signup(
  email: string,
  password: string,
  acceptedTerms: boolean,
): Promise<{ user: User; verificationRequired: true } | undefined> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, acceptedTerms }),
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

export function logout(): Promise<undefined> {
  return apiFetch('/auth/logout', { method: 'POST' })
}
