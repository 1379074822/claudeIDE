import { create } from 'zustand'
import { applyTheme, type ThemeId } from '../themes'

type CopyContext = {
  filePath: string
  startLine: number
  endLine: number
  text: string
  timestamp: number
} | null

type UIStore = {
  sidebarWidth: number
  chatWidth: number
  showFileTree: boolean
  showChat: boolean
  activePanel: 'files' | 'search' | 'settings' | 'git'
  theme: ThemeId
  lastCopyContext: CopyContext
  pendingFileRef: string | null   // path set by FileTree "Send to Chat"
  setSidebarWidth: (w: number) => void
  setChatWidth: (w: number) => void
  toggleFileTree: () => void
  toggleChat: () => void
  setActivePanel: (p: UIStore['activePanel']) => void
  setTheme: (t: ThemeId) => void
  setLastCopyContext: (ctx: CopyContext) => void
  setPendingFileRef: (path: string | null) => void
}

// Apply saved theme on load, fallback to pure-black
const savedTheme = (localStorage.getItem('claude_theme') as ThemeId) || 'pure-black'
// Migrate old theme ids to new ones
const migratedTheme: ThemeId = ((savedTheme as string) === 'catppuccin-mocha' || (savedTheme as string) === 'ayu-dark')
  ? 'pure-black'
  : (savedTheme as string) === 'catppuccin-latte'
    ? 'clean-light'
    : savedTheme as ThemeId
applyTheme(migratedTheme)

export const useUIStore = create<UIStore>((set) => ({
  sidebarWidth: 240,
  chatWidth: 360,
  showFileTree: true,
  showChat: true,
  activePanel: 'files',
  theme: migratedTheme,
  lastCopyContext: null,
  pendingFileRef: null,

  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setChatWidth: (w) => set({ chatWidth: w }),
  toggleFileTree: () => set((s) => ({ showFileTree: !s.showFileTree })),
  toggleChat: () => set((s) => ({ showChat: !s.showChat })),
  setActivePanel: (p) => set({ activePanel: p }),
  setTheme: (t) => {
    localStorage.setItem('claude_theme', t)
    applyTheme(t)
    set({ theme: t })
  },
  setLastCopyContext: (ctx) => set({ lastCopyContext: ctx }),
  setPendingFileRef: (path) => set({ pendingFileRef: path }),
}))
