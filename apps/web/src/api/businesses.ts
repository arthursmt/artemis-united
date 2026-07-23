import { apiFetch } from './client'
import type { Business } from '../types'

export function createBusiness(name: string, sectorSegment: string): Promise<{ business: Business } | undefined> {
  return apiFetch('/businesses', { method: 'POST', body: JSON.stringify({ name, sectorSegment }) })
}

export function getMyBusiness(): Promise<{ business: Business } | undefined> {
  return apiFetch('/businesses/me')
}

export interface BusinessDetailsInput {
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  yearsInBusiness: number
  yearsOfIndustryExperience: number
  phone: string | null
  numberOfEmployees: number
}

export function updateBusinessDetails(
  input: BusinessDetailsInput,
): Promise<{ business: Business } | undefined> {
  return apiFetch('/businesses/me', { method: 'PUT', body: JSON.stringify(input) })
}
