import { apiFetch } from './client'
import type { Business } from '../types'

export function createBusiness(name: string, sectorSegment: string): Promise<{ business: Business } | undefined> {
  return apiFetch('/businesses', { method: 'POST', body: JSON.stringify({ name, sectorSegment }) })
}

export function getMyBusiness(): Promise<{ business: Business } | undefined> {
  return apiFetch('/businesses/me')
}
