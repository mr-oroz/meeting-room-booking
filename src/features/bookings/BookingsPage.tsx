import { useState } from 'react'
import type { Booking } from '../../domain/booking'
import { toDateKey } from '../../domain/time'
import { BookingForm } from './BookingForm'
import { DateNav } from './DateNav'
import { DaySchedule } from './DaySchedule'
import { blankDraft, draftForSlot, draftFromBooking, type Draft } from './draft'
import { useBookings } from './queries'
import { useNow } from './useNow'

export function BookingsPage() {
  const now = useNow()
  const today = toDateKey(now)
  const [date, setDate] = useState(today)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [focusSignal, setFocusSignal] = useState(0)
  const [notice, setNotice] = useState('')
  const query = useBookings(date)
  const formDraft = draft ?? blankDraft(date, now, query.data)

  function pick(next: Draft) {
    setDraft(next)
    setNotice('')
    setFocusSignal((n) => n + 1)
  }

  function changeDate(next: string) {
    setDate(next)
    setDraft(null)
    setNotice('')
  }

  function handleSaved(booking: Booking, created: boolean) {
    setNotice(`${created ? 'Бронь создана' : 'Бронь изменена'}: ${booking.start}–${booking.end}`)
    setDraft(null)
  }

  function handleDeleted() {
    setNotice('Бронь удалена')
    setDraft(null)
  }

  return (
    <>
      <DateNav date={date} today={today} onChange={changeDate} />
      <p className="notice" role="status" aria-live="polite">
        {notice}
      </p>
      <div className="layout">
        <DaySchedule
          date={date}
          now={now}
          query={query}
          selectedId={formDraft.id}
          onSelectBooking={(booking) => pick(draftFromBooking(booking))}
          onSelectFree={(start, end) => pick(draftForSlot(date, { start, end }))}
        />
        <BookingForm
          draft={formDraft}
          onChange={setDraft}
          bookings={query.data}
          now={now}
          focusSignal={focusSignal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onCancelEdit={() => setDraft(null)}
        />
      </div>
    </>
  )
}
