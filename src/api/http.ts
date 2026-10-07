import type { Booking } from '../domain/booking'

/** Error body returned by the API. */
export interface ApiErrorBody {
  code: string
  message: string
  conflictWith?: Booking
}

export class ApiError extends Error {
  status: number
  code: string
  conflictWith?: Booking

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.conflictWith = body.conflictWith
  }

  get isConflict(): boolean {
    return this.status === 409
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  404: 'Бронь не найдена — возможно, её уже удалили',
  500: 'Ошибка сервера. Попробуйте ещё раз',
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && typeof (value as ApiErrorBody).message === 'string'
}

export function createHttpClient(baseUrl: string) {
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    // Absolute URL: fetch outside the browser (tests, SSR) rejects relative ones.
    const url = new URL(path, baseUrl || window.location.origin)

    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiError(0, { code: 'NETWORK', message: 'Нет связи с сервером. Проверьте интернет' })
    }

    if (response.status === 204) return undefined as T

    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      throw new ApiError(
        response.status,
        isErrorBody(body)
          ? body
          : {
              code: 'HTTP_ERROR',
              message: FALLBACK_MESSAGES[response.status] ?? `Ошибка сервера (${response.status})`,
            },
      )
    }
    return body as T
  }
}
