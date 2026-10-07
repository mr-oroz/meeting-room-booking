/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of a real backend. Empty: same origin. */
  readonly VITE_API_URL?: string
  /** "false" turns the in-browser mock API off. */
  readonly VITE_USE_MOCKS?: string
}
