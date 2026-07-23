// Placeholder shared types. Once the OpenAPI contract exists, this file will
// re-export generated types from `src/generated/api.ts` (see the `generate` script).

export interface HealthStatus {
  status: 'ok'
  service: string
}

export * from './sectors.js'
export * from './usStates.js'
