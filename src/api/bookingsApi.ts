import type { Booking, BookingInput, BookingPatch } from '../domain/booking'
import { createHttpClient } from './http'

/** What the UI needs from the backend. Swap the implementation to change the transport. */
export interface BookingsApi {
  list(date: string, signal?: AbortSignal): Promise<Booking[]>
  create(input: BookingInput): Promise<Booking>
  update(id: string, patch: BookingPatch): Promise<Booking>
  remove(id: string): Promise<void>
}

export function createBookingsApi(baseUrl = ''): BookingsApi {
  const request = createHttpClient(baseUrl)
  return {
    list: (date, signal) => request<Booking[]>(`/api/bookings?date=${encodeURIComponent(date)}`, { signal }),
    create: (input) => request<Booking>('/api/bookings', { method: 'POST', body: JSON.stringify(input) }),
    update: (id, patch) =>
      request<Booking>(`/api/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id) => request<void>(`/api/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}

/** VITE_API_URL points the app at a real backend; empty means same origin (mock API in the demo). */
export const bookingsApi = createBookingsApi(import.meta.env.VITE_API_URL ?? '')
