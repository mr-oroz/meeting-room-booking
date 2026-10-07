import { getResponse } from 'msw'
import { handlers } from './handlers'

/**
 * Fallback when the Service Worker can't be registered (Firefox private windows, some embedded
 * browsers): answer /api/ requests with the same mock handlers by wrapping window.fetch.
 * The app's network layer stays unchanged — it still just calls fetch.
 */
export function installFetchFallback() {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    if (new URL(request.url).pathname.startsWith('/api/')) {
      const response = await getResponse(handlers, request)
      if (response) return response
    }
    return originalFetch(input, init)
  }
}
