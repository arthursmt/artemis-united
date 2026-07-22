import { apiFetch } from './client'
import type { AssessmentView, MonthlyFinancials } from '../types'

export function submitDre(monthly: MonthlyFinancials): Promise<AssessmentView | undefined> {
  return apiFetch('/financial-statements', { method: 'POST', body: JSON.stringify(monthly) })
}
