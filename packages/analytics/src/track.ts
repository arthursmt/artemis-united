import posthog from 'posthog-js'
import type { AnalyticsEvent } from './events'

export function track(event: AnalyticsEvent) {
  posthog.capture(event.name, event.properties)
}
