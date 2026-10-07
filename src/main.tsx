import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { MOCKS_ENABLED } from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
    // A retried POST could create a booking twice.
    mutations: { retry: false },
  },
})

async function startMockApi() {
  if (!MOCKS_ENABLED) return
  try {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    })
  } catch (error) {
    console.warn('[mock API] Service Worker unavailable, intercepting fetch in the page instead', error)
    const { installFetchFallback } = await import('./mocks/fetchFallback')
    installFetchFallback()
  }
}

void startMockApi().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})
