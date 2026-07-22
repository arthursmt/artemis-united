export interface User {
  id: string
  email: string
}

export interface Business {
  id: string
  ownerUserId: string
  name: string
  sectorSegment: string
  taxId: string | null
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
  sectorFound: boolean
  noi: number
  dscrTarget: number
  monthlyNewDebtCapacity: number
}
