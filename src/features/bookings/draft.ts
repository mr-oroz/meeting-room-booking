import type { Booking, BookingInput } from '../../domain/booking'
import { bookableStart, defaultEnd, earliestStart, suggestSlot, WORK_START } from '../../domain/rules'

/** What the form edits. Kept by the page, so a failed save never loses it. */
export interface Draft {
  /** Set when editing an existing booking. */
  id?: string
  date: string
  start: string
  end: string
  title: string
}

/** A new booking in the first free slot of the day, so the form never opens on a conflict. */
export function blankDraft(date: string, now: Date, bookings: Booking[] = []): Draft {
  const slot = suggestSlot(date, bookings, now)
  if (slot) return { date, ...slot, title: '' }
  const start = earliestStart(date, now) ?? WORK_START
  return { date, start, end: defaultEnd(start), title: '' }
}

/** A new booking in a free gap picked in the schedule; the start snaps to the time step. */
export function draftForSlot(date: string, gap: { start: string; end: string }): Draft {
  const start = bookableStart(gap) ?? gap.start
  return { date, start, end: defaultEnd(start, gap.end), title: '' }
}

export function draftFromBooking(booking: Booking): Draft {
  return { id: booking.id, date: booking.date, start: booking.start, end: booking.end, title: booking.title ?? '' }
}

export function draftToInput(draft: Draft): BookingInput {
  const title = draft.title.trim()
  return { date: draft.date, start: draft.start, end: draft.end, ...(title ? { title } : {}) }
}
