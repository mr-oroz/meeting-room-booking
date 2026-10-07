/** Switches in the demo panel that make the mock API misbehave on purpose. */
export interface DemoSettings {
  /** Extra latency for every request, ms. */
  latency: number
  /** The next request fails with 500. */
  failNext: boolean
  /**
   * The next create/update loses a race: another user books the same time just before it,
   * so the server answers 409 although the UI saw the slot as free (rule 8).
   */
  conflictNext: boolean
}

const DEFAULTS: DemoSettings = { latency: 400, failNext: false, conflictNext: false }

let settings: DemoSettings = DEFAULTS
const listeners = new Set<() => void>()

/** Returns a new object after every change, as useSyncExternalStore expects. */
export function getDemo(): DemoSettings {
  return settings
}

export function updateDemo(patch: Partial<DemoSettings>) {
  settings = { ...settings, ...patch }
  listeners.forEach((listener) => listener())
}

export function resetDemo(overrides: Partial<DemoSettings> = {}) {
  settings = { ...DEFAULTS, ...overrides }
  listeners.forEach((listener) => listener())
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
