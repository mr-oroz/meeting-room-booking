import { delay, http, HttpResponse } from 'msw'
import type { ApiErrorBody } from '../api/http'
import type { Booking, BookingInput } from '../domain/booking'
import { findConflict, isLocked, validateBooking } from '../domain/rules'
import { db } from './db'
import { getDemo, updateDemo } from './demo'

const MAX_TITLE = 100

function fail(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

/** Latency and a forced 500 from the demo panel; returns a response to short-circuit with. */
async function simulateNetwork() {
  const demo = getDemo()
  if (demo.latency) await delay(demo.latency)
  if (demo.failNext) {
    updateDemo({ failNext: false })
    return fail(500, { code: 'SERVER_ERROR', message: 'Сервер временно недоступен. Попробуйте ещё раз' })
  }
  return null
}

function readInput(body: unknown, base?: Booking): BookingInput | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = { ...base, ...(body as Record<string, unknown>) }
  const { date, start, end, title } = raw
  if (typeof date !== 'string' || typeof start !== 'string' || typeof end !== 'string') return null
  if (title !== undefined && title !== null && typeof title !== 'string') return null
  const trimmed = typeof title === 'string' ? title.trim().slice(0, MAX_TITLE) : ''
  return { date, start, end, ...(trimmed ? { title: trimmed } : {}) }
}

/** Demo switch for rule 8: someone else takes the slot right before this request lands. */
function maybeLoseRace(input: BookingInput, ignoreId?: string) {
  if (!getDemo().conflictNext) return
  updateDemo({ conflictNext: false })
  if (!findConflict(input, db.byDate(input.date), ignoreId)) {
    db.insert({ date: input.date, start: input.start, end: input.end, title: 'Бронь другого сотрудника' })
  }
}

/** Rule violations become 422, an overlap with another booking becomes 409. */
function checkRules(input: BookingInput, ignoreId?: string) {
  const violations = validateBooking(input, { bookings: db.byDate(input.date), now: new Date(), ignoreId })
  const rule = violations.find((v) => v.code !== 'OVERLAP')
  if (rule) return fail(422, { code: rule.code, message: rule.message })
  const overlap = violations.find((v) => v.code === 'OVERLAP')
  if (overlap) {
    return fail(409, {
      code: 'CONFLICT',
      message: 'Это время уже занято. Список броней обновлён — выберите другое время',
      conflictWith: overlap.conflictWith,
    })
  }
  return null
}

const locked = () =>
  fail(422, { code: 'LOCKED', message: 'Прошедшую или уже начавшуюся бронь изменить нельзя' })
const notFound = () => fail(404, { code: 'NOT_FOUND', message: 'Бронь не найдена — возможно, её уже удалили' })
const badRequest = () => fail(400, { code: 'BAD_REQUEST', message: 'Некорректные данные брони' })

export const handlers = [
  http.get('*/api/bookings', async ({ request }) => {
    const failed = await simulateNetwork()
    if (failed) return failed
    const date = new URL(request.url).searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail(400, { code: 'BAD_REQUEST', message: 'Параметр date обязателен (YYYY-MM-DD)' })
    }
    const list = [...db.byDate(date)].sort((a, b) => a.start.localeCompare(b.start))
    return HttpResponse.json(list)
  }),

  http.post('*/api/bookings', async ({ request }) => {
    const failed = await simulateNetwork()
    if (failed) return failed
    const input = readInput(await request.json().catch(() => null))
    if (!input) return badRequest()

    maybeLoseRace(input)
    const rejected = checkRules(input)
    if (rejected) return rejected
    return HttpResponse.json(db.insert(input), { status: 201 })
  }),

  http.patch('*/api/bookings/:id', async ({ request, params }) => {
    const failed = await simulateNetwork()
    if (failed) return failed
    const existing = db.get(String(params.id))
    if (!existing) return notFound()
    if (isLocked(existing, new Date())) return locked()

    const input = readInput(await request.json().catch(() => null), existing)
    if (!input) return badRequest()

    maybeLoseRace(input, existing.id)
    const rejected = checkRules(input, existing.id)
    if (rejected) return rejected
    const updated: Booking = { id: existing.id, ...input }
    db.replace(updated)
    return HttpResponse.json(updated)
  }),

  http.delete('*/api/bookings/:id', async ({ params }) => {
    const failed = await simulateNetwork()
    if (failed) return failed
    const existing = db.get(String(params.id))
    if (!existing) return notFound()
    if (isLocked(existing, new Date())) return locked()
    db.delete(existing.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
