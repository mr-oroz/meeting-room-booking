import type { UseQueryResult } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import type { Booking } from '../../domain/booking'
import {
  bookableStart,
  daySegments,
  hasEnded,
  isLocked,
  MIN_DURATION,
  WORK_END,
  WORK_START,
  type DaySegment,
} from '../../domain/rules'
import { formatDuration, toMinutes } from '../../domain/time'

interface DayScheduleProps {
  date: string
  now: Date
  query: UseQueryResult<Booking[]>
  selectedId?: string
  onSelectBooking: (booking: Booking) => void
  onSelectFree: (start: string, end: string) => void
}

const minutes = (segment: DaySegment) => toMinutes(segment.end) - toMinutes(segment.start)

export function DaySchedule({ date, now, query, selectedId, onSelectBooking, onSelectFree }: DayScheduleProps) {
  return (
    <section className="panel" aria-labelledby="schedule-title" aria-busy={query.isFetching}>
      <header className="panel-header">
        <h2 id="schedule-title">Расписание</h2>
        <span className="muted">
          {WORK_START}–{WORK_END}
        </span>
        {query.isFetching && !query.isPending && <span className="muted refreshing">Обновление…</span>}
      </header>
      <ScheduleBody
        date={date}
        now={now}
        query={query}
        selectedId={selectedId}
        onSelectBooking={onSelectBooking}
        onSelectFree={onSelectFree}
      />
    </section>
  )
}

function ScheduleBody({ date, now, query, selectedId, onSelectBooking, onSelectFree }: DayScheduleProps) {
  if (query.isPending) {
    return (
      <ul className="skeleton" aria-label="Загрузка броней">
        {[60, 90, 40, 120].map((height, i) => (
          <li key={i} style={{ height }} />
        ))}
      </ul>
    )
  }

  if (query.isError) {
    return (
      <div className="state state-error" role="alert">
        <p>Не удалось загрузить брони: {query.error.message}</p>
        <button type="button" className="secondary" onClick={() => void query.refetch()}>
          Повторить
        </button>
      </div>
    )
  }

  const bookings = query.data
  const segments = daySegments(date, bookings, now)

  return (
    <>
      {bookings.length === 0 && <p className="state">На эту дату броней нет.</p>}
      <ol className="timeline">
        {segments.map((segment) => (
          <li
            key={`${segment.kind}-${segment.start}`}
            className={`segment segment-${segment.kind}`}
            style={{ '--minutes': minutes(segment) } as CSSProperties}
          >
            <Segment
              segment={segment}
              now={now}
              selected={segment.kind === 'booking' && segment.booking.id === selectedId}
              onSelectBooking={onSelectBooking}
              onSelectFree={onSelectFree}
            />
          </li>
        ))}
      </ol>
    </>
  )
}

interface SegmentProps {
  segment: DaySegment
  now: Date
  selected: boolean
  onSelectBooking: (booking: Booking) => void
  onSelectFree: (start: string, end: string) => void
}

function Segment({ segment, now, selected, onSelectBooking, onSelectFree }: SegmentProps) {
  const time = `${segment.start}–${segment.end}`

  if (segment.kind === 'past') {
    return (
      <div className="segment-body">
        <span className="segment-time">{time}</span>
        <span className="muted">Прошедшее время</span>
      </div>
    )
  }

  if (segment.kind === 'free' && !bookableStart(segment)) {
    return (
      <div className="segment-body too-short">
        <span className="segment-time">{time}</span>
        <span>Свободно · {formatDuration(minutes(segment))}</span>
        <span className="muted segment-action">меньше {MIN_DURATION} мин — не забронировать</span>
      </div>
    )
  }

  if (segment.kind === 'free') {
    return (
      <button
        type="button"
        className="segment-body"
        onClick={() => onSelectFree(segment.start, segment.end)}
        aria-label={`Свободно ${time}. Забронировать`}
      >
        <span className="segment-time">{time}</span>
        <span>Свободно · {formatDuration(minutes(segment))}</span>
        <span className="segment-action">Забронировать</span>
      </button>
    )
  }

  const { booking } = segment
  const title = booking.title ?? 'Без названия'
  const locked = isLocked(booking, now)
  const content = (
    <>
      <span className="segment-time">{time}</span>
      <span className="segment-title">{title}</span>
      {locked ? (
        <span className="badge">{hasEnded(booking, now) ? 'Прошла' : 'Идёт'}</span>
      ) : (
        <span className="segment-action">{selected ? 'Редактируется' : 'Изменить'}</span>
      )}
    </>
  )

  if (locked) return <div className="segment-body">{content}</div>
  return (
    <button
      type="button"
      className={`segment-body${selected ? ' selected' : ''}`}
      onClick={() => onSelectBooking(booking)}
      aria-pressed={selected}
      aria-label={`Бронь ${time} «${title}». Изменить`}
    >
      {content}
    </button>
  )
}

