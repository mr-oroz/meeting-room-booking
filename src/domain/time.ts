/** "HH:mm" → minutes since midnight. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Minutes since midnight → "HH:mm". */
export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Local calendar date as "YYYY-MM-DD".
 * Not toISOString(): that is UTC and gives yesterday's date before 05:00 in UTC+5 and later zones.
 */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

const longDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

export function formatDateLong(key: string): string {
  return longDate.format(parseDateKey(key))
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} мин`
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}
