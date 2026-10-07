import type { Booking } from '../domain/booking'
import { addDays, toDateKey } from '../domain/time'

const STORAGE_KEY = 'meeting-room.bookings'

function seed(now: Date): Booking[] {
  const today = toDateKey(now)
  const tomorrow = addDays(today, 1)
  return [
    { id: 'seed-1', date: today, start: '10:00', end: '11:00', title: 'Планёрка' },
    { id: 'seed-2', date: today, start: '14:00', end: '15:30', title: 'Созвон с клиентом' },
    { id: 'seed-3', date: tomorrow, start: '09:30', end: '10:30', title: 'Собеседование' },
    { id: 'seed-4', date: tomorrow, start: '16:00', end: '17:00' },
  ]
}

function load(): Booking[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Booking[]) : null
  } catch {
    return null
  }
}

function persist(bookings: Booking[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings))
  } catch {
    // Demo data simply won't survive a reload.
  }
}

let bookings: Booking[] = load() ?? seed(new Date())
let counter = 0

/** In-memory store behind the mock API, saved to localStorage so the demo survives a reload. */
export const db = {
  all: (): Booking[] => bookings,
  byDate: (date: string): Booking[] => bookings.filter((b) => b.date === date),
  get: (id: string): Booking | undefined => bookings.find((b) => b.id === id),

  insert(data: Omit<Booking, 'id'>): Booking {
    const booking = { ...data, id: `b-${Date.now().toString(36)}-${++counter}` }
    bookings = [...bookings, booking]
    persist(bookings)
    return booking
  },

  replace(booking: Booking) {
    bookings = bookings.map((b) => (b.id === booking.id ? booking : b))
    persist(bookings)
  },

  delete(id: string) {
    bookings = bookings.filter((b) => b.id !== id)
    persist(bookings)
  },

  reset(data: Booking[] = seed(new Date())) {
    bookings = data
    persist(bookings)
  },
}
