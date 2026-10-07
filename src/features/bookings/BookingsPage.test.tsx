import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../mocks/db'
import { resetDemo, updateDemo } from '../../mocks/demo'
import { BookingsPage } from './BookingsPage'

const TODAY = '2026-10-07'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BookingsPage />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

const schedule = () => screen.getByRole('region', { name: 'Расписание' })
const form = () => screen.getByRole('region', { name: /бронь/i })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 10, 20))
  resetDemo({ latency: 0 })
  db.reset([
    { id: 'standup', date: TODAY, start: '10:00', end: '11:00', title: 'Планёрка' },
    { id: 'call', date: TODAY, start: '14:00', end: '15:30', title: 'Созвон' },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BookingsPage', () => {
  it('opens the form on the first free slot, not on a conflict', async () => {
    renderPage()
    await within(schedule()).findByText('Созвон')
    expect(screen.getByLabelText('Начало')).toHaveProperty('value', '11:00')
    expect(screen.getByLabelText('Окончание')).toHaveProperty('value', '12:00')
    expect(screen.queryByText(/Пересекается/)).toBeNull()
  })

  it('books a free slot picked in the schedule', async () => {
    const user = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Свободно 11:00–14:00. Забронировать' }))
    expect(screen.getByLabelText('Начало')).toHaveProperty('value', '11:00')
    expect(screen.getByLabelText('Окончание')).toHaveProperty('value', '12:00')

    await user.type(screen.getByLabelText(/Название/), 'Ретро')
    await user.click(screen.getByRole('button', { name: 'Забронировать' }))

    expect(await screen.findByText('Бронь создана: 11:00–12:00')).toBeTruthy()
    expect(await within(schedule()).findByText('Ретро')).toBeTruthy()
  })

  it('keeps the form and refreshes the list when the server reports a conflict', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Свободно 11:00–14:00. Забронировать' }))
    await user.type(screen.getByLabelText(/Название/), 'Ретро')

    updateDemo({ conflictNext: true })
    await user.click(screen.getByRole('button', { name: 'Забронировать' }))

    const alert = await within(form()).findByText('Время только что заняли')
    expect(alert).toBeTruthy()
    expect(screen.getByLabelText(/Название/)).toHaveProperty('value', 'Ретро')
    expect(screen.getByLabelText('Начало')).toHaveProperty('value', '11:00')
    expect(await within(schedule()).findByText('Бронь другого сотрудника')).toBeTruthy()
  })

  it('explains an overlap before sending anything', async () => {
    const user = renderPage()
    await screen.findByText('Созвон')

    await user.selectOptions(screen.getByLabelText('Начало'), '13:30')
    expect(await screen.findByText('Пересекается с бронью 14:00–15:30 «Созвон»')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Забронировать' })).toHaveProperty('disabled', true)
  })

  it('edits and then deletes a booking', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Бронь 14:00–15:30 «Созвон». Изменить' }))
    expect(screen.getByRole('heading', { name: 'Изменить бронь' })).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Окончание'), '15:00')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Бронь изменена: 14:00–15:00')).toBeTruthy()

    await user.click(await screen.findByRole('button', { name: 'Бронь 14:00–15:00 «Созвон». Изменить' }))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))
    await user.click(screen.getByRole('button', { name: 'Да, удалить' }))
    expect(await screen.findByText('Бронь удалена')).toBeTruthy()
    await waitFor(() => expect(within(schedule()).queryByText('Созвон')).toBeNull())
  })

  it('does not offer to edit a booking that has already started', async () => {
    renderPage()
    expect(await within(schedule()).findByText('Планёрка')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Планёрка/ })).toBeNull()
    expect(within(schedule()).getByText('Идёт')).toBeTruthy()
  })

  it('does not allow booking a past date', async () => {
    const user = renderPage()
    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    expect(await screen.findByText('Это прошедшая дата — создать бронь нельзя.')).toBeTruthy()
  })

  it('shows a load error and recovers on retry', async () => {
    updateDemo({ failNext: true })
    const user = renderPage()

    expect(await screen.findByText(/Не удалось загрузить брони/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await within(schedule()).findByText('Созвон')).toBeTruthy()
  })
})
