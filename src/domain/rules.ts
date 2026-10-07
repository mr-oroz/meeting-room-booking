import type { Booking, BookingInput } from './booking'
import { fromMinutes, minutesOfDay, toDateKey, toMinutes } from './time'

export const WORK_START = '09:00'
export const WORK_END = '18:00'
export const MIN_DURATION = 30
export const MAX_DURATION = 120
export const TIME_STEP = 15

export type RuleCode =
  | 'INVALID_FORMAT'
  | 'PAST_DATE'
  | 'OUTSIDE_WORKDAY'
  | 'START_NOT_BEFORE_END'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'START_IN_PAST'
  | 'OVERLAP'

export interface RuleViolation {
  code: RuleCode
  message: string
  conflictWith?: Booking
}

export interface RuleContext {
  bookings: Booking[]
  now: Date
  ignoreId?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

interface Interval {
  start: string
  end: string
}

/** Touching intervals (10:00–11:00 and 11:00–12:00) do not overlap. */
export function overlaps(a: Interval, b: Interval): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)
}

export function findConflict(
  input: Pick<BookingInput, 'date' | 'start' | 'end'>,
  bookings: Booking[],
  ignoreId?: string,
): Booking | undefined {
  return bookings.find((b) => b.id !== ignoreId && b.date === input.date && overlaps(b, input))
}

export function isPastDate(date: string, now: Date): boolean {
  return date < toDateKey(now)
}

/**
 * A booking that has started or ended is read-only: moving it would either rewrite
 * history or require a start in the past, which rule 6 forbids.
 */
export function isLocked(booking: Booking, now: Date): boolean {
  const today = toDateKey(now)
  if (booking.date !== today) return booking.date < today
  return toMinutes(booking.start) < minutesOfDay(now)
}

export function hasEnded(booking: Booking, now: Date): boolean {
  const today = toDateKey(now)
  if (booking.date !== today) return booking.date < today
  return toMinutes(booking.end) <= minutesOfDay(now)
}

/**
 * Checks the business rules and returns every violation, most fundamental first.
 * Shared by the form (instant feedback) and the mock server (source of truth).
 */
export function validateBooking(input: BookingInput, context: RuleContext): RuleViolation[] {
  if (!DATE_RE.test(input.date) || !TIME_RE.test(input.start) || !TIME_RE.test(input.end)) {
    return [{ code: 'INVALID_FORMAT', message: 'Дата или время в неверном формате' }]
  }
  if (isPastDate(input.date, context.now)) {
    return [{ code: 'PAST_DATE', message: 'Нельзя бронировать прошедшую дату' }]
  }

  const violations: RuleViolation[] = []
  const start = toMinutes(input.start)
  const end = toMinutes(input.end)

  if (start < toMinutes(WORK_START) || end > toMinutes(WORK_END)) {
    violations.push({
      code: 'OUTSIDE_WORKDAY',
      message: `Бронь должна быть в пределах рабочего дня ${WORK_START}–${WORK_END}`,
    })
  }

  if (start >= end) {
    violations.push({ code: 'START_NOT_BEFORE_END', message: 'Время начала должно быть раньше окончания' })
  } else if (end - start < MIN_DURATION) {
    violations.push({ code: 'TOO_SHORT', message: `Минимальная длительность — ${MIN_DURATION} минут` })
  } else if (end - start > MAX_DURATION) {
    violations.push({ code: 'TOO_LONG', message: `Максимальная длительность — ${MAX_DURATION / 60} часа` })
  }

  if (input.date === toDateKey(context.now) && start < minutesOfDay(context.now)) {
    violations.push({ code: 'START_IN_PAST', message: 'Время начала уже прошло' })
  }

  const conflict = findConflict(input, context.bookings, context.ignoreId)
  if (conflict) {
    violations.push({
      code: 'OVERLAP',
      message: `Пересекается с бронью ${conflict.start}–${conflict.end}${conflict.title ? ` «${conflict.title}»` : ''}`,
      conflictWith: conflict,
    })
  }

  return violations
}

/** All times from `from` to `to` inclusive, every TIME_STEP minutes. */
export function timeOptions(from: string, to: string): string[] {
  const options: string[] = []
  for (let m = toMinutes(from); m <= toMinutes(to); m += TIME_STEP) options.push(fromMinutes(m))
  return options
}

export function roundUpToStep(minutes: number): number {
  return Math.ceil(minutes / TIME_STEP) * TIME_STEP
}

/** Earliest bookable start on a date, or null when nothing can be booked any more. */
export function earliestStart(date: string, now: Date): string | null {
  const today = toDateKey(now)
  if (date < today) return null
  let minutes = toMinutes(WORK_START)
  if (date === today) minutes = Math.max(minutes, roundUpToStep(minutesOfDay(now)))
  return minutes + MIN_DURATION <= toMinutes(WORK_END) ? fromMinutes(minutes) : null
}

/** End times allowed for a start: MIN_DURATION…MAX_DURATION later, not past the end of the day. */
export function endOptions(start: string): string[] {
  const first = toMinutes(start) + MIN_DURATION
  const last = Math.min(toMinutes(start) + MAX_DURATION, toMinutes(WORK_END))
  return first > last ? [] : timeOptions(fromMinutes(first), fromMinutes(last))
}

/** A sensible end for a start: one hour, or less if the day or a free gap ends sooner. */
export function defaultEnd(start: string, limit: string = WORK_END): string {
  const end = Math.min(toMinutes(start) + 60, toMinutes(limit), toMinutes(WORK_END))
  return fromMinutes(Math.max(end, toMinutes(start) + MIN_DURATION))
}

export type DaySegment =
  | { kind: 'booking'; start: string; end: string; booking: Booking }
  | { kind: 'free'; start: string; end: string }
  | { kind: 'past'; start: string; end: string }

/**
 * The working day as consecutive segments: bookings, free gaps and — for today —
 * the part of the free time that has already passed.
 */
export function daySegments(date: string, bookings: Booking[], now: Date): DaySegment[] {
  const sorted = bookings
    .filter((b) => b.date === date)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))

  const today = toDateKey(now)
  const pastUntil =
    date < today ? toMinutes(WORK_END) : date === today ? Math.min(minutesOfDay(now), toMinutes(WORK_END)) : 0

  const segments: DaySegment[] = []
  const pushGap = (from: number, to: number) => {
    if (from >= to) return
    const split = Math.min(Math.max(pastUntil, from), to)
    if (split > from) segments.push({ kind: 'past', start: fromMinutes(from), end: fromMinutes(split) })
    if (to > split) segments.push({ kind: 'free', start: fromMinutes(split), end: fromMinutes(to) })
  }

  let cursor = toMinutes(WORK_START)
  for (const booking of sorted) {
    pushGap(cursor, toMinutes(booking.start))
    segments.push({ kind: 'booking', start: booking.start, end: booking.end, booking })
    cursor = Math.max(cursor, toMinutes(booking.end))
  }
  pushGap(cursor, toMinutes(WORK_END))
  return segments
}

/** Where a booking could start inside a free gap, or null if the gap is shorter than the minimum. */
export function bookableStart(gap: { start: string; end: string }): string | null {
  const start = roundUpToStep(toMinutes(gap.start))
  return start + MIN_DURATION <= toMinutes(gap.end) ? fromMinutes(start) : null
}

/** The first free interval of the day long enough to book, as a ready start/end pair. */
export function suggestSlot(date: string, bookings: Booking[], now: Date): { start: string; end: string } | null {
  for (const segment of daySegments(date, bookings, now)) {
    if (segment.kind !== 'free') continue
    const start = bookableStart(segment)
    if (start) return { start, end: defaultEnd(start, segment.end) }
  }
  return null
}
