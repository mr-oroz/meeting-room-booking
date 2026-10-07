export interface Booking {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  start: string
  /** HH:mm */
  end: string
  title?: string
}

export type BookingInput = Omit<Booking, 'id'>

export type BookingPatch = Partial<BookingInput>
