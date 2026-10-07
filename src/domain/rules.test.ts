import { describe, expect, it } from 'vitest'
import type { Booking } from './booking'
import {
  bookableStart,
  daySegments,
  suggestSlot,
  earliestStart,
  endOptions,
  hasEnded,
  isLocked,
  overlaps,
  validateBooking,
  type RuleCode,
} from './rules'
import { toDateKey } from './time'

// Wednesday, 7 October 2026, 10:20 local time.
const now = new Date(2026, 9, 7, 10, 20)
const TODAY = '2026-10-07'
const TOMORROW = '2026-10-08'
const YESTERDAY = '2026-10-06'

const planning: Booking = { id: 'a', date: TOMORROW, start: '10:00', end: '11:00', title: 'Планёрка' }

function codes(start: string, end: string, date = TOMORROW, bookings: Booking[] = [planning], ignoreId?: string) {
  return validateBooking({ date, start, end }, { bookings, now, ignoreId }).map((v) => v.code)
}

describe('overlaps', () => {
  it('treats touching intervals as free', () => {
    expect(overlaps({ start: '10:00', end: '11:00' }, { start: '11:00', end: '12:00' })).toBe(false)
    expect(overlaps({ start: '11:00', end: '12:00' }, { start: '10:00', end: '11:00' })).toBe(false)
  })

  it('detects partial and full overlaps', () => {
    expect(overlaps({ start: '10:00', end: '11:00' }, { start: '10:30', end: '11:30' })).toBe(true)
    expect(overlaps({ start: '10:00', end: '12:00' }, { start: '10:30', end: '11:00' })).toBe(true)
  })
})

describe('validateBooking', () => {
  it('accepts a booking that follows every rule', () => {
    expect(codes('11:00', '12:00')).toEqual([])
  })

  it.each<[string, string, RuleCode]>([
    ['08:30', '09:30', 'OUTSIDE_WORKDAY'],
    ['17:30', '18:30', 'OUTSIDE_WORKDAY'],
    ['12:00', '12:00', 'START_NOT_BEFORE_END'],
    ['13:00', '12:00', 'START_NOT_BEFORE_END'],
    ['12:00', '12:20', 'TOO_SHORT'],
    ['12:00', '14:30', 'TOO_LONG'],
    ['10:30', '11:30', 'OVERLAP'],
    ['09:30', '12:00', 'OVERLAP'],
  ])('%s–%s → %s', (start, end, code) => {
    expect(codes(start, end)).toContain(code)
  })

  it('accepts exactly the minimum and maximum duration', () => {
    expect(codes('12:00', '12:30')).toEqual([])
    expect(codes('12:00', '14:00')).toEqual([])
  })

  it('allows a booking that ends where another starts or starts where it ends', () => {
    expect(codes('09:00', '10:00')).toEqual([])
    expect(codes('11:00', '11:30')).toEqual([])
  })

  it('rejects past dates entirely', () => {
    expect(codes('11:00', '12:00', YESTERDAY)).toEqual(['PAST_DATE'])
  })

  it('rejects a start that has already passed today, but not one later today', () => {
    expect(codes('10:15', '11:00', TODAY, [])).toEqual(['START_IN_PAST'])
    expect(codes('10:30', '11:00', TODAY, [])).toEqual([])
  })

  it('does not let an edited booking conflict with itself', () => {
    expect(codes('10:00', '11:30', TOMORROW, [planning], planning.id)).toEqual([])
    expect(codes('10:00', '11:30', TOMORROW, [planning])).toContain('OVERLAP')
  })

  it('ignores bookings on other dates', () => {
    expect(codes('10:00', '11:00', TODAY.replace('07', '09'), [planning])).toEqual([])
  })

  it('names the booking it conflicts with', () => {
    const [violation] = validateBooking({ date: TOMORROW, start: '10:30', end: '11:30' }, { bookings: [planning], now })
    expect(violation.conflictWith).toBe(planning)
    expect(violation.message).toContain('10:00–11:00 «Планёрка»')
  })

  it('rejects malformed input before anything else', () => {
    expect(codes('9:00', '10:00')).toEqual(['INVALID_FORMAT'])
    expect(codes('10:00', '11:00', '07.10.2026')).toEqual(['INVALID_FORMAT'])
  })
})

describe('earliestStart', () => {
  it('rounds the current time up to the next step today', () => {
    expect(earliestStart(TODAY, now)).toBe('10:30')
  })

  it('starts at the beginning of the day for future dates', () => {
    expect(earliestStart(TOMORROW, now)).toBe('09:00')
  })

  it('is null for past dates and when less than the minimum is left today', () => {
    expect(earliestStart(YESTERDAY, now)).toBeNull()
    expect(earliestStart(TODAY, new Date(2026, 9, 7, 17, 40))).toBeNull()
  })

  it('uses the local date, not UTC', () => {
    const lateEvening = new Date(2026, 9, 7, 23, 30)
    expect(toDateKey(lateEvening)).toBe(TODAY)
  })
})

describe('endOptions', () => {
  it('offers 30 minutes to 2 hours after the start', () => {
    const ends = endOptions('10:00')
    expect(ends[0]).toBe('10:30')
    expect(ends.at(-1)).toBe('12:00')
  })

  it('stops at the end of the working day', () => {
    expect(endOptions('17:00')).toEqual(['17:30', '17:45', '18:00'])
  })
})

describe('isLocked / hasEnded', () => {
  it('locks bookings that have started or are in the past', () => {
    expect(isLocked({ ...planning, date: TODAY }, now)).toBe(true)
    expect(hasEnded({ ...planning, date: TODAY }, now)).toBe(false)
    expect(isLocked({ ...planning, date: TODAY, start: '11:00', end: '12:00' }, now)).toBe(false)
    expect(isLocked({ ...planning, date: YESTERDAY }, now)).toBe(true)
    expect(hasEnded({ ...planning, date: YESTERDAY }, now)).toBe(true)
  })
})

describe('suggestSlot / bookableStart', () => {
  it('suggests the first free gap long enough, skipping booked time', () => {
    const standup = { ...planning, date: TODAY }
    expect(suggestSlot(TODAY, [standup], now)).toEqual({ start: '11:00', end: '12:00' })
  })

  it('shortens the suggestion to fit a short gap', () => {
    const bookings: Booking[] = [
      { id: 'x', date: TOMORROW, start: '09:00', end: '10:00' },
      { id: 'y', date: TOMORROW, start: '10:45', end: '12:00' },
    ]
    expect(suggestSlot(TOMORROW, bookings, now)).toEqual({ start: '10:00', end: '10:45' })
  })

  it('returns null when no gap fits the minimum', () => {
    const full: Booking[] = [{ id: 'x', date: TODAY, start: '10:30', end: '12:00' }]
    expect(suggestSlot(TODAY, full, new Date(2026, 9, 7, 17, 40))).toBeNull()
  })

  it('snaps a gap start to the time step and rejects gaps under 30 minutes', () => {
    expect(bookableStart({ start: '13:53', end: '15:00' })).toBe('14:00')
    expect(bookableStart({ start: '13:53', end: '14:00' })).toBeNull()
    expect(bookableStart({ start: '13:53', end: '14:29' })).toBeNull()
  })
})

describe('daySegments', () => {
  it('splits today into past time, bookings and free time', () => {
    const at = new Date(2026, 9, 7, 12, 10)
    const segments = daySegments(TODAY, [{ ...planning, date: TODAY }], at)
    expect(segments.map((s) => `${s.kind} ${s.start}–${s.end}`)).toEqual([
      'past 09:00–10:00',
      'booking 10:00–11:00',
      'past 11:00–12:10',
      'free 12:10–18:00',
    ])
  })

  it('shows a future day without bookings as one free segment', () => {
    expect(daySegments(TOMORROW, [], now)).toEqual([{ kind: 'free', start: '09:00', end: '18:00' }])
  })

  it('shows a past day as past time', () => {
    expect(daySegments(YESTERDAY, [], now)).toEqual([{ kind: 'past', start: '09:00', end: '18:00' }])
  })
})
