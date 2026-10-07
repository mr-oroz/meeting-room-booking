import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/http'
import type { Booking } from '../../domain/booking'
import {
  defaultEnd,
  earliestStart,
  endOptions,
  isPastDate,
  MIN_DURATION,
  timeOptions,
  validateBooking,
  WORK_END,
  WORK_START,
  type RuleCode,
  type RuleViolation,
} from '../../domain/rules'
import { formatDuration, fromMinutes, toMinutes } from '../../domain/time'
import { draftToInput, type Draft } from './draft'
import { useDeleteBooking, useSaveBooking } from './queries'

interface BookingFormProps {
  draft: Draft
  onChange: (draft: Draft) => void
  /** Bookings of the draft's date; undefined while they are loading. */
  bookings: Booking[] | undefined
  now: Date
  /** Changes when a slot or booking is picked in the schedule, to move focus here. */
  focusSignal: number
  onSaved: (booking: Booking, created: boolean) => void
  onDeleted: () => void
  onCancelEdit: () => void
}

const START_FIELD: RuleCode[] = ['START_IN_PAST', 'OUTSIDE_WORKDAY']
const END_FIELD: RuleCode[] = ['START_NOT_BEFORE_END', 'TOO_SHORT', 'TOO_LONG']
const LAST_START = fromMinutes(toMinutes(WORK_END) - MIN_DURATION)

export function BookingForm(props: BookingFormProps) {
  const { draft, onChange, bookings, now, focusSignal, onSaved, onDeleted, onCancelEdit } = props
  const save = useSaveBooking()
  const remove = useDeleteBooking()
  const [confirmDeleteOf, setConfirmDeleteOf] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const ids = { start: useId(), end: useId(), title: useId(), startError: useId(), endError: useId() }

  useEffect(() => {
    if (focusSignal > 0) titleRef.current?.focus()
  }, [focusSignal])

  // Another slot, booking or date was picked: errors of the previous one no longer apply.
  // (The delete confirmation is tied to draft.id, so it resets by itself.)
  const { reset: resetSave } = save
  const { reset: resetRemove } = remove
  useEffect(() => {
    resetSave()
    resetRemove()
  }, [focusSignal, draft.date, draft.id, resetSave, resetRemove])

  const editing = Boolean(draft.id)
  const confirmingDelete = editing && confirmDeleteOf === draft.id
  const earliest = earliestStart(draft.date, now)
  const closed = isPastDate(draft.date, now) || (!editing && earliest === null)
  const violations = closed
    ? []
    : validateBooking(draftToInput(draft), { bookings: bookings ?? [], now, ignoreId: draft.id })
  const startError = violations.find((v) => START_FIELD.includes(v.code))
  const endError = violations.find((v) => END_FIELD.includes(v.code))
  const generalErrors = violations.filter((v) => v !== startError && v !== endError)

  const busy = save.isPending || remove.isPending
  const canSubmit = !closed && bookings !== undefined && violations.length === 0 && !busy

  function update(patch: Partial<Draft>) {
    // A server error describes the previous attempt; once the user edits, it is stale.
    save.reset()
    remove.reset()
    onChange({ ...draft, ...patch })
  }

  function changeStart(start: string) {
    const ends = endOptions(start)
    update({ start, end: ends.includes(draft.end) ? draft.end : defaultEnd(start) })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    // Pin the values: an untouched form follows the suggested free slot, which moves when the
    // list is refetched after a conflict — and rule 8 says the user's input must survive that.
    onChange(draft)
    save.mutate(
      { id: draft.id, input: draftToInput(draft) },
      { onSuccess: (booking) => onSaved(booking, !draft.id) },
    )
  }

  function confirmDelete() {
    if (!draft.id) return
    remove.mutate({ id: draft.id, ...draftToInput(draft) }, { onSuccess: onDeleted })
  }

  const starts = timeOptions(WORK_START, LAST_START)
  const ends = withCurrent(endOptions(draft.start), draft.end)
  const duration = toMinutes(draft.end) - toMinutes(draft.start)
  const serverError = save.error ?? remove.error

  return (
    <section className="panel" aria-labelledby="form-title">
      <header className="panel-header">
        <h2 id="form-title">{editing ? 'Изменить бронь' : 'Новая бронь'}</h2>
      </header>

      {closed ? (
        <p className="state">
          {isPastDate(draft.date, now)
            ? 'Это прошедшая дата — создать бронь нельзя.'
            : 'На сегодня свободного времени для брони не осталось. Выберите другую дату.'}
        </p>
      ) : (
        <form className="booking-form" onSubmit={submit} noValidate aria-busy={busy}>
          <div className="field">
            <label htmlFor={ids.title}>
              Название <span className="muted">(необязательно)</span>
            </label>
            <input
              id={ids.title}
              ref={titleRef}
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              maxLength={100}
              placeholder="Например, планёрка"
              disabled={busy}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor={ids.start}>Начало</label>
              <select
                id={ids.start}
                value={draft.start}
                onChange={(event) => changeStart(event.target.value)}
                aria-invalid={Boolean(startError)}
                aria-describedby={startError ? ids.startError : undefined}
                disabled={busy}
              >
                {starts.map((time) => (
                  <option key={time} value={time} disabled={earliest !== null && time < earliest}>
                    {time}
                  </option>
                ))}
              </select>
              <FieldError id={ids.startError} violation={startError} />
            </div>

            <div className="field">
              <label htmlFor={ids.end}>Окончание</label>
              <select
                id={ids.end}
                value={draft.end}
                onChange={(event) => update({ end: event.target.value })}
                aria-invalid={Boolean(endError)}
                aria-describedby={endError ? ids.endError : undefined}
                disabled={busy}
              >
                {ends.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
              <FieldError id={ids.endError} violation={endError} />
            </div>
          </div>

          <p className="muted hint">
            {duration > 0 ? `Длительность: ${formatDuration(duration)}. ` : ''}
            От 30 минут до 2 часов, с {WORK_START} до {WORK_END}.
          </p>

          {generalErrors.map((violation) => (
            <p key={violation.code} className="form-error" role="alert">
              {violation.message}
            </p>
          ))}

          {serverError && <ServerError error={serverError} />}

          <div className="actions">
            <button type="submit" className="primary" disabled={!canSubmit}>
              {save.isPending ? 'Сохранение…' : editing ? 'Сохранить' : 'Забронировать'}
            </button>
            {editing && (
              <button type="button" className="secondary" onClick={onCancelEdit} disabled={busy}>
                Отмена
              </button>
            )}
            {editing && !confirmingDelete && (
              <button type="button" className="danger-link" onClick={() => setConfirmDeleteOf(draft.id ?? null)} disabled={busy}>
                Удалить
              </button>
            )}
          </div>

          {editing && confirmingDelete && (
            <div className="confirm" role="group" aria-label="Подтверждение удаления">
              <span>Удалить бронь {draft.start}–{draft.end}?</span>
              <button type="button" className="danger" onClick={confirmDelete} disabled={busy}>
                {remove.isPending ? 'Удаление…' : 'Да, удалить'}
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmDeleteOf(null)} disabled={busy}>
                Нет
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  )
}

function FieldError({ id, violation }: { id: string; violation?: RuleViolation }) {
  if (!violation) return null
  return (
    <p id={id} className="field-error">
      {violation.message}
    </p>
  )
}

function ServerError({ error }: { error: Error }) {
  const conflict = error instanceof ApiError && error.isConflict
  return (
    <div className={`server-error${conflict ? ' conflict' : ''}`} role="alert">
      <strong>{conflict ? 'Время только что заняли' : 'Не удалось сохранить'}</strong>
      <p>{error.message}</p>
      {conflict && <p className="muted">Введённые данные сохранены в форме — поменяйте время и попробуйте снова.</p>}
    </div>
  )
}

/** Keeps the current value selectable even if it is no longer a valid option. */
function withCurrent(options: string[], current: string): string[] {
  return options.includes(current) ? options : [...options, current].sort()
}
