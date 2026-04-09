import { create } from 'zustand'

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk'

export type PermissionRequest = {
  requestId: string
  toolName: string
  toolInput: Record<string, unknown>
  description?: string
}

type PermissionStore = {
  mode: PermissionMode
  pendingRequest: PermissionRequest | null
  setMode: (mode: PermissionMode) => void
  setPendingRequest: (req: PermissionRequest | null) => void
}

export const usePermissionStore = create<PermissionStore>((set) => ({
  mode: (localStorage.getItem('claude_permission_mode') as PermissionMode) || 'default',
  pendingRequest: null,

  setMode: (mode) => {
    localStorage.setItem('claude_permission_mode', mode)
    set({ mode })
  },

  setPendingRequest: (req) => set({ pendingRequest: req }),
}))
