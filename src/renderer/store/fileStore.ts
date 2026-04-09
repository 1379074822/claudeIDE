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

type FileStore = {
  rootPath: string | null
  fileTree: FileEntry[]
  openFiles: OpenFile[]
  activeFilePath: string | null
  setRootPath: (path: string) => void
  setFileTree: (tree: FileEntry[]) => void
  openFile: (file: OpenFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  markFileSaved: (path: string) => void
  applyExternalEdit: (path: string, newContent: string) => void
}

export const useFileStore = create<FileStore>((set) => ({
  rootPath: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,

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
}))
