export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | undefined> {
  const response = await fetch(`/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (response.status === 204) {
    return undefined
  }

  const body: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `request failed with status ${response.status}`
    throw new ApiError(response.status, message)
  }

  return body as T
}
