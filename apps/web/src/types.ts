export interface User {
  id: string
  email: string
  // Só GET /auth/me garante esse campo — login/signup/verify-email/
  // reset-password retornam um User mais enxuto no backend (não incluem
  // twoFactorEnabled). SecuritySettings sempre busca o estado real via
  // me(), não confia num User recebido de outro endpoint pra isso.
  twoFactorEnabled?: boolean
}

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'separated'

export interface CustomerProfile {
  id: string
  userId: string
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
  createdAt: string
  updatedAt: string
}

export interface Business {
  id: string
  ownerUserId: string
  name: string
  sectorSegment: string
  taxId: string | null
  // Preenchidos no segundo passo do onboarding de negócio (Etapa 5, seção 4.4)
  // — null até o usuário passar por PUT /v1/businesses/me.
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  yearsInBusiness: number | null
  yearsOfIndustryExperience: number | null
  phone: string | null
  numberOfEmployees: number | null
  createdAt: string
  updatedAt: string
}

// Mesmo formato de services/bob-engine/src/domain/assessment.ts — não importado de lá
// de propósito (bob-engine é um serviço interno, não uma lib compartilhada;
// apps/web nem fala com ele diretamente, só via apps/api).
export interface MonthlyFinancials {
  revenue: number
  directCosts: number
  operatingExpenses: number
  currentDebtService: number
  personalExtraIncome: number
  personalExpenses: number
}

export interface AssessmentView {
  id: string
  businessId: string
  sectorSegment: string
  status: string
  currency: string
  requestedAmount: string | null
  recommendedAmount: string | null
  confidenceLevel: string | null
  score: string | null
  exceedsMicroloanCeiling: boolean
  marginSanityTriggered: boolean
  recommendationLimiter: 'dscr' | 'revenue_multiple' | 'microloan_ceiling' | null
  sectorFound: boolean
  noi: number
  dscrTarget: number
  monthlyNewDebtCapacity: number
}
