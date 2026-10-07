import { addDays, formatDateLong } from '../../domain/time'

interface DateNavProps {
  date: string
  today: string
  onChange: (date: string) => void
}

export function DateNav({ date, today, onChange }: DateNavProps) {
  return (
    <nav className="date-nav" aria-label="Выбор даты">
      <button type="button" className="icon-button" onClick={() => onChange(addDays(date, -1))} aria-label="Предыдущий день">
        ‹
      </button>
      <label className="date-field">
        <span className="visually-hidden">Дата</span>
        <input
          type="date"
          value={date}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          required
        />
      </label>
      <button type="button" className="icon-button" onClick={() => onChange(addDays(date, 1))} aria-label="Следующий день">
        ›
      </button>
      <button type="button" className="secondary" onClick={() => onChange(today)} disabled={date === today}>
        Сегодня
      </button>
      <span className="date-caption" aria-live="polite">
        {date === today ? 'Сегодня, ' : ''}
        {formatDateLong(date)}
      </span>
    </nav>
  )
}
