import { apiFetch } from './client'
import type { CustomerProfile, MaritalStatus } from '../types'

export interface CustomerProfileInput {
  dateOfBirth: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  maritalStatus: MaritalStatus
  hasChildren: boolean
  householdSize: number | null
  alternatePhone: string
}

export function createCustomerProfile(
  input: CustomerProfileInput,
): Promise<{ profile: CustomerProfile } | undefined> {
  return apiFetch('/customer-profile', { method: 'POST', body: JSON.stringify(input) })
}

export function getMyCustomerProfile(): Promise<{ profile: CustomerProfile } | undefined> {
  return apiFetch('/customer-profile/me')
}
