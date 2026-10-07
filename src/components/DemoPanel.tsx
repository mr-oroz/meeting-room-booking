import { useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { bookingKeys } from '../features/bookings/queries'
import { db } from '../mocks/db'
import { getDemo, subscribeDemo, updateDemo } from '../mocks/demo'

/** Controls for the mock API, so reviewers can trigger slow responses, errors and a lost race. */
export function DemoPanel() {
  const demo = useSyncExternalStore(subscribeDemo, getDemo)
  const queryClient = useQueryClient()

  return (
    <details className="demo">
      <summary>Демо-режим: mock API</summary>
      <p className="muted">
        Бэкенда нет — запросы обрабатывает mock API в браузере (MSW). Здесь можно проверить, как интерфейс
        ведёт себя при медленной сети, ошибке сервера и конфликте.
      </p>
      <label>
        <input
          type="checkbox"
          checked={demo.latency >= 2000}
          onChange={(event) => updateDemo({ latency: event.target.checked ? 2000 : 400 })}
        />
        Медленная сеть (2 секунды на запрос)
      </label>
      <label>
        <input
          type="checkbox"
          checked={demo.failNext}
          onChange={(event) => updateDemo({ failNext: event.target.checked })}
        />
        Следующий запрос завершится ошибкой 500
      </label>
      <label>
        <input
          type="checkbox"
          checked={demo.conflictNext}
          onChange={(event) => updateDemo({ conflictNext: event.target.checked })}
        />
        Следующее сохранение получит конфликт 409: другой сотрудник займёт это время раньше
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          db.reset()
          void queryClient.invalidateQueries({ queryKey: bookingKeys.all })
        }}
      >
        Сбросить демо-данные
      </button>
    </details>
  )
}
