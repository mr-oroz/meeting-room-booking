import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBookingsApi } from '../api/bookingsApi'
import { ApiError } from '../api/http'
import { db } from './db'
import { resetDemo, updateDemo } from './demo'

const api = createBookingsApi('http://localhost')
const TODAY = '2026-10-07'
const TOMORROW = '2026-10-08'

async function apiError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 10, 20))
  resetDemo({ latency: 0 })
  db.reset([
    { id: 'a', date: TOMORROW, start: '10:00', end: '11:00', title: 'Планёрка' },
    { id: 'now', date: TODAY, start: '10:00', end: '11:00' },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mock bookings API', () => {
  it('lists the bookings of one date, sorted by start', async () => {
    await api.create({ date: TOMORROW, start: '09:00', end: '09:30' })
    const list = await api.list(TOMORROW)
    expect(list.map((b) => b.start)).toEqual(['09:00', '10:00'])
  })

  it('creates a booking that touches another one', async () => {
    const booking = await api.create({ date: TOMORROW, start: '11:00', end: '12:00', title: '  Созвон  ' })
    expect(booking).toMatchObject({ date: TOMORROW, start: '11:00', end: '12:00', title: 'Созвон' })
  })

  it('answers 409 with the conflicting booking on overlap', async () => {
    const error = await apiError(api.create({ date: TOMORROW, start: '10:30', end: '11:30' }))
    expect(error.status).toBe(409)
    expect(error.conflictWith?.id).toBe('a')
  })

  it('answers 422 when a business rule is broken', async () => {
    const error = await apiError(api.create({ date: TOMORROW, start: '12:00', end: '15:00' }))
    expect(error.status).toBe(422)
    expect(error.code).toBe('TOO_LONG')
  })

  it('rejects bookings in the past', async () => {
    expect((await apiError(api.create({ date: TODAY, start: '09:00', end: '09:30' }))).code).toBe('START_IN_PAST')
    expect((await apiError(api.create({ date: '2026-10-06', start: '12:00', end: '13:00' }))).code).toBe('PAST_DATE')
  })

  it('lets an edited booking keep overlapping its own old time', async () => {
    const updated = await api.update('a', { end: '11:30' })
    expect(updated).toMatchObject({ id: 'a', start: '10:00', end: '11:30', title: 'Планёрка' })
  })

  it('refuses to change or delete a booking that has already started', async () => {
    expect((await apiError(api.update('now', { end: '11:30' }))).code).toBe('LOCKED')
    expect((await apiError(api.remove('now'))).code).toBe('LOCKED')
  })

  it('deletes a booking and reports 404 for a missing one', async () => {
    await api.remove('a')
    expect(await api.list(TOMORROW)).toEqual([])
    expect((await apiError(api.remove('a'))).status).toBe(404)
  })

  it('demo: the next save loses the race to another user', async () => {
    updateDemo({ conflictNext: true })
    const error = await apiError(api.create({ date: TOMORROW, start: '12:00', end: '13:00' }))
    expect(error.status).toBe(409)
    const list = await api.list(TOMORROW)
    expect(list.map((b) => b.title)).toContain('Бронь другого сотрудника')
  })

  it('demo: the next request fails with 500, the one after works', async () => {
    updateDemo({ failNext: true })
    expect((await apiError(api.list(TOMORROW))).status).toBe(500)
    await expect(api.list(TOMORROW)).resolves.toHaveLength(1)
  })
})
