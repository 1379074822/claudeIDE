/**
 * Type-safe accessor for the Electron API exposed via contextBridge.
 * Use this instead of `(window as any).electronAPI` everywhere.
 *
 * Returns `undefined` when running outside of Electron (e.g. plain browser),
 * so callers should guard with optional-chaining: `getAPI()?.fs.readFile(...)`.
 */
export function getAPI(): ElectronAPI | undefined {
  return window.electronAPI
}

/**
 * Asserts the API is available and returns it.
 * Throws a descriptive error when called outside Electron.
 */
export function requireAPI(): ElectronAPI {
  const api = window.electronAPI
  if (!api) throw new Error('[ElectronAPI] Not running in Electron context.')
  return api
}
