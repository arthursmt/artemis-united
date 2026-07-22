import { apiFetch } from './client'
import type { AssessmentView } from '../types'

export function getLatestAssessment(): Promise<AssessmentView | undefined> {
  return apiFetch('/assessments/latest')
}
