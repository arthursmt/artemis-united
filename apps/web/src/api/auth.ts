import { apiFetch } from './client'
import type { User } from '../types'

export function signup(email: string, password: string): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function login(email: string, password: string): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function me(): Promise<{ user: User } | undefined> {
  return apiFetch('/auth/me')
}

export function logout(): Promise<undefined> {
  return apiFetch('/auth/logout', { method: 'POST' })
}
