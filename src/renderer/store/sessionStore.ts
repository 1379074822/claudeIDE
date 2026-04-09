import { create } from 'zustand'

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error'
export type ConnectionMode = 'server' | 'api' | 'disconnected'

export type SessionEntry = {
  key: string
  sessionId: string
  transcriptSessionId: string
  cwd: string
  permissionMode?: string
  createdAt: number
  lastActiveAt: number
}

type SessionStore = {
  // Server state
  serverStatus: ServerStatus
  serverPort: number | null
  connectionMode: ConnectionMode
  currentSessionId: string | null
  isConnected: boolean

  // Session list
  sessions: SessionEntry[]

  // Actions
  setServerStatus: (status: ServerStatus) => void
  setServerPort: (port: number | null) => void
  setConnectionMode: (mode: ConnectionMode) => void
  setCurrentSessionId: (id: string | null) => void
  setConnected: (connected: boolean) => void
  setSessions: (sessions: SessionEntry[]) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  serverStatus: 'stopped',
  serverPort: null,
  connectionMode: 'disconnected',
  currentSessionId: null,
  isConnected: false,
  sessions: [],

  setServerStatus: (status) => set({ serverStatus: status }),
  setServerPort: (port) => set({ serverPort: port }),
  setConnectionMode: (mode) => set({ connectionMode: mode }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setConnected: (connected) => set({ isConnected: connected }),
  setSessions: (sessions) => set({ sessions }),
}))
