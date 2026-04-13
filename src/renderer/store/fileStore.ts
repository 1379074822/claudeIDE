import { create } from 'zustand'

export type FileEntry = {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
  expanded?: boolean
}

export type OpenFile = {
  path: string
  name: string
  content: string
  language: string
  modified: boolean
  originalContent: string
}

export type PendingDiff = {
  filePath: string
  oldContent: string
  newContent: string
  type: 'create' | 'edit' | 'delete'
}

type FileStore = {
  rootPath: string | null
  fileTree: FileEntry[]
  openFiles: OpenFile[]
  activeFilePath: string | null
  pendingDiffs: PendingDiff[]
  setRootPath: (path: string) => void
  setFileTree: (tree: FileEntry[]) => void
  openFile: (file: OpenFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  markFileSaved: (path: string) => void
  applyExternalEdit: (path: string, newContent: string) => void
  addPendingDiff: (diff: PendingDiff) => void
  acceptPendingDiff: (filePath: string) => Promise<void>
  rejectPendingDiff: (filePath: string) => void
  acceptAllPendingDiffs: () => Promise<void>
}

export const useFileStore = create<FileStore>((set, get) => ({
  rootPath: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  pendingDiffs: [],

  setRootPath: (path) => set({ rootPath: path }),
  setFileTree: (tree) => set({ fileTree: tree }),

  openFile: (file) => set((state) => {
    const exists = state.openFiles.find(f => f.path === file.path)
    if (exists) {
      return { activeFilePath: file.path }
    }
    return {
      openFiles: [...state.openFiles, file],
      activeFilePath: file.path,
    }
  }),

  closeFile: (path) => set((state) => {
    const newOpenFiles = state.openFiles.filter(f => f.path !== path)
    let newActive = state.activeFilePath
    if (state.activeFilePath === path) {
      const idx = state.openFiles.findIndex(f => f.path === path)
      newActive = newOpenFiles[Math.max(0, idx - 1)]?.path || null
    }
    return { openFiles: newOpenFiles, activeFilePath: newActive }
  }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) => set((state) => ({
    openFiles: state.openFiles.map(f =>
      f.path === path ? { ...f, content, modified: content !== f.originalContent } : f
    ),
  })),

  markFileSaved: (path) => set((state) => ({
    openFiles: state.openFiles.map(f =>
      f.path === path ? { ...f, modified: false, originalContent: f.content } : f
    ),
  })),

  applyExternalEdit: (path, newContent) => set((state) => ({
    openFiles: state.openFiles.map(f =>
      f.path === path ? { ...f, content: newContent, originalContent: newContent, modified: false } : f
    ),
  })),

  addPendingDiff: (diff) => {
    // Guard against undefined content
    const safeOld = diff.oldContent ?? ''
    const safeNew = diff.newContent ?? ''
    const safeDiff = { ...diff, oldContent: safeOld, newContent: safeNew }

    const state = get()
    const existing = state.openFiles.find(f => f.path === safeDiff.filePath)
    const name = safeDiff.filePath.replace(/\\/g, '/').split('/').pop() || safeDiff.filePath
    const ext = name.split('.').pop() || ''
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rs: 'rust', go: 'go', md: 'markdown', json: 'json',
      css: 'css', html: 'html', sh: 'shell', yaml: 'yaml', yml: 'yaml',
    }
    const language = langMap[ext] || 'plaintext'

    set((s) => {
      const diffs = s.pendingDiffs.filter(d => d.filePath !== safeDiff.filePath)
      diffs.push(safeDiff)

      const openFiles = existing
        ? s.openFiles.map(f => f.path === safeDiff.filePath ? { ...f, content: safeNew } : f)
        : [...s.openFiles, { path: safeDiff.filePath, name, content: safeNew, language, modified: true, originalContent: safeOld }]

      return {
        pendingDiffs: diffs,
        openFiles,
        activeFilePath: safeDiff.filePath,
      }
    })
  },

  acceptPendingDiff: async (filePath) => {
    const diff = get().pendingDiffs.find(d => d.filePath === filePath)
    if (!diff) return
    const api = (window as any).electronAPI
    if (api?.fs?.writeFile) {
      await api.fs.writeFile(filePath, diff.newContent)
    }
    set((s) => ({
      pendingDiffs: s.pendingDiffs.filter(d => d.filePath !== filePath),
      openFiles: s.openFiles.map(f =>
        f.path === filePath ? { ...f, content: diff.newContent, originalContent: diff.newContent, modified: false } : f
      ),
    }))
  },

  rejectPendingDiff: (filePath) => {
    const diff = get().pendingDiffs.find(d => d.filePath === filePath)
    if (!diff) return
    set((s) => ({
      pendingDiffs: s.pendingDiffs.filter(d => d.filePath !== filePath),
      // Restore original content; if it was a new file (oldContent empty), close it
      openFiles: diff.type === 'create'
        ? s.openFiles.filter(f => f.path !== filePath)
        : s.openFiles.map(f =>
            f.path === filePath ? { ...f, content: diff.oldContent, originalContent: diff.oldContent, modified: false } : f
          ),
      activeFilePath: diff.type === 'create' && s.activeFilePath === filePath
        ? (s.openFiles.find(f => f.path !== filePath)?.path || null)
        : s.activeFilePath,
    }))
  },

  acceptAllPendingDiffs: async () => {
    const diffs = get().pendingDiffs
    const api = (window as any).electronAPI
    for (const diff of diffs) {
      if (api?.fs?.writeFile) {
        await api.fs.writeFile(diff.filePath, diff.newContent)
      }
    }
    set((s) => ({
      pendingDiffs: [],
      openFiles: s.openFiles.map(f => {
        const diff = diffs.find(d => d.filePath === f.path)
        if (!diff) return f
        return { ...f, content: diff.newContent, originalContent: diff.newContent, modified: false }
      }),
    }))
  },
}))

