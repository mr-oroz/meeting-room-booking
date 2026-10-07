import { DemoPanel } from './components/DemoPanel'
import { BookingsPage } from './features/bookings/BookingsPage'

export const MOCKS_ENABLED = import.meta.env.VITE_USE_MOCKS !== 'false'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Переговорная</h1>
        <p className="muted">Бронирование на рабочий день 09:00–18:00</p>
      </header>
      <main>
        <BookingsPage />
      </main>
      {MOCKS_ENABLED && <DemoPanel />}
    </div>
  )
}
