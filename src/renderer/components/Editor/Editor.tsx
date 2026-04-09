import { useRef, useCallback, useEffect, useState } from 'react'
import MonacoEditor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { X, Circle, Save } from 'lucide-react'
import { useFileStore, type OpenFile } from '../../store'
import { useUIStore, useSessionStore } from '../../store'
import { claudeClient } from '../../utils/claudeClient'
import { serverClient } from '../../utils/serverClient'
import styles from './Editor.module.css'

// ── Pre-init Monaco from local node_modules (eliminates CDN loading) ──────
loader.config({ monaco })

const CATPPUCCIN_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '585b70', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'cba6f7' },
    { token: 'string', foreground: 'a6e3a1' },
    { token: 'number', foreground: 'fab387' },
    { token: 'type', foreground: 'f38ba8' },
    { token: 'function', foreground: '89b4fa' },
    { token: 'variable', foreground: 'cdd6f4' },
  ],
  colors: {
    'editor.background': '#1e1e2e',
    'editor.foreground': '#cdd6f4',
    'editor.lineHighlightBackground': '#313244',
    'editor.selectionBackground': '#45475a',
    'editorCursor.foreground': '#f5c2e7',
    'editorLineNumber.foreground': '#45475a',
    'editorLineNumber.activeForeground': '#cba6f7',
    'editor.inactiveSelectionBackground': '#313244',
    'editorIndentGuide.background': '#313244',
    'editorWhitespace.foreground': '#313244',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#45475a80',
    'scrollbarSlider.hoverBackground': '#585b7080',
    'scrollbarSlider.activeBackground': '#6c708680',
  },
}

// ── Tab Bar ───────────────────────────────────────────────────────────────
function TabBar() {
  const { openFiles, activeFilePath, closeFile, setActiveFile } = useFileStore()

  return (
    <div className={styles.tabBar}>
      {openFiles.map(file => (
        <div
          key={file.path}
          className={`${styles.tab} ${file.path === activeFilePath ? styles.activeTab : ''}`}
          onClick={() => setActiveFile(file.path)}
          title={file.path}
        >
          <span className={styles.tabName}>{file.name}</span>
          {file.modified && <Circle size={6} fill="#cba6f7" stroke="none" className={styles.dot} />}
          <button
            className={styles.closeBtn}
            onClick={e => { e.stopPropagation(); closeFile(file.path) }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Single Monaco instance that swaps models on tab switch ────────────────
function SingleEditor() {
  const { openFiles, activeFilePath, updateFileContent, markFileSaved } = useFileStore()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  // Map from file path → monaco model
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map())
  // Track view state (scroll/cursor) per file
  const viewStateRef = useRef<Map<string, monaco.editor.ICodeEditorViewState>>(new Map())

  const activeFile = openFiles.find(f => f.path === activeFilePath)

  // On mount: define theme once
  const handleMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInst: typeof monaco) => {
    editorRef.current = editor
    monacoRef.current = monacoInst

    monacoInst.editor.defineTheme('catppuccin', CATPPUCCIN_THEME)
    monacoInst.editor.setTheme('catppuccin')

    // Ctrl+S → save
    editor.addCommand(monacoInst.KeyMod.CtrlCmd | monacoInst.KeyCode.KeyS, async () => {
      const store = useFileStore.getState()
      const active = store.openFiles.find(f => f.path === store.activeFilePath)
      if (!active) return
      const api = (window as any).electronAPI
      if (api) {
        const result = await api.fs.writeFile(active.path, active.content)
        if (result.success) store.markFileSaved(active.path)
      }
    })

    // AI right-click actions
    const sendToChat = (prompt: string) => {
      const { connectionMode } = useSessionStore.getState()
      if (connectionMode === 'server') {
        serverClient.sendMessage(prompt)
      } else {
        claudeClient.sendMessage(prompt)
      }
    }

    editor.addAction({
      id: 'ai-explain',
      label: '✨ AI: Explain / 解释代码',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 1,
      run: (ed) => {
        const sel = ed.getSelection()
        const code = sel ? ed.getModel()?.getValueInRange(sel) : ''
        if (!code?.trim()) {
          sendToChat(`请解释当前打开的文件`)
          return
        }
        sendToChat(`请解释以下代码：\n\`\`\`\n${code}\n\`\`\``)
      },
    })

    editor.addAction({
      id: 'ai-refactor',
      label: '🔧 AI: Refactor / 重构代码',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 2,
      run: (ed) => {
        const sel = ed.getSelection()
        const code = sel ? ed.getModel()?.getValueInRange(sel) : ''
        if (!code?.trim()) return
        sendToChat(`请重构以下代码，使其更清晰高效：\n\`\`\`\n${code}\n\`\`\``)
      },
    })

    editor.addAction({
      id: 'ai-tests',
      label: '🧪 AI: Write Tests / 生成单元测试',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 3,
      run: (ed) => {
        const sel = ed.getSelection()
        const code = sel ? ed.getModel()?.getValueInRange(sel) : ''
        if (!code?.trim()) return
        sendToChat(`为以下代码生成完整的单元测试：\n\`\`\`\n${code}\n\`\`\``)
      },
    })

    // We don't intercept copy here. Copy-context tracking is handled
    // by a document-level listener set up in a useEffect below.

    // Fix: Monaco context menu doesn't dismiss on left-click inside editor in Electron.
    editor.onMouseDown(() => {
      const menuDom = document.querySelector('.monaco-menu-container') as HTMLElement | null
      if (menuDom) {
        // Dispatch Escape key to close the context menu
        menuDom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }
    })
  }, [])

  // Document-level copy listener (capture phase).
  // When a copy/cut happens anywhere in the page, check if the Monaco
  // editor has a non-empty selection. If so, snapshot it into the UI store
  // so Chat's handlePaste can attach file-path context.
  // Using document ensures we catch it regardless of Monaco's internal DOM.
  useEffect(() => {
    const handler = () => {
      const editor = editorRef.current
      if (!editor) return
      const sel = editor.getSelection()
      if (!sel || sel.isEmpty()) return

      // Only record if the editor actually has focus
      if (!editor.hasWidgetFocus()) return

      const filePath = useFileStore.getState().activeFilePath
      if (!filePath) return
      const text = editor.getModel()?.getValueInRange(sel)
      if (!text) return

      useUIStore.getState().setLastCopyContext({
        filePath,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        text,
        timestamp: Date.now(),
      })
    }

    document.addEventListener('copy', handler, true)
    document.addEventListener('cut', handler, true)
    return () => {
      document.removeEventListener('copy', handler, true)
      document.removeEventListener('cut', handler, true)
    }
  }, [])

  // Switch model when active file changes
  useEffect(() => {
    const editor = editorRef.current
    const monacoInst = monacoRef.current
    if (!editor || !monacoInst || !activeFile) return

    // Save current view state before switching
    const prevPath = [...modelsRef.current.entries()]
      .find(([, m]) => m === editor.getModel())?.[0]
    if (prevPath) {
      const vs = editor.saveViewState()
      if (vs) viewStateRef.current.set(prevPath, vs)
    }

    // Get or create model for new file
    let model = modelsRef.current.get(activeFile.path)
    if (!model) {
      const uri = monacoInst.Uri.file(activeFile.path)
      // Reuse existing uri model if it already exists in monaco registry
      model = monacoInst.editor.getModel(uri) ||
        monacoInst.editor.createModel(activeFile.content, activeFile.language, uri)
      modelsRef.current.set(activeFile.path, model)
    } else {
      // Sync content if changed externally
      if (model.getValue() !== activeFile.content) {
        model.setValue(activeFile.content)
      }
    }

    editor.setModel(model)

    // Restore view state
    const savedVS = viewStateRef.current.get(activeFile.path)
    if (savedVS) editor.restoreViewState(savedVS)
    editor.focus()

    // Listen for content changes on this model
    const disposable = model.onDidChangeContent(() => {
      updateFileContent(activeFile.path, model!.getValue())
    })
    return () => disposable.dispose()
  }, [activeFilePath, activeFile?.language])

  // Sync external content changes (e.g. Claude edits file) back into model
  useEffect(() => {
    if (!activeFile) return
    const model = modelsRef.current.get(activeFile.path)
    if (model && model.getValue() !== activeFile.content) {
      model.setValue(activeFile.content)
    }
  }, [activeFile?.content])

  // Auto-save: 3 seconds after last edit, if file is modified
  useEffect(() => {
    if (!activeFile?.modified) return
    const timer = setTimeout(async () => {
      const api = (window as any).electronAPI
      if (!api) return
      const store = useFileStore.getState()
      const file = store.openFiles.find(f => f.path === activeFile.path)
      if (!file?.modified) return
      const result = await api.fs.writeFile(file.path, file.content)
      if (result.success) store.markFileSaved(file.path)
    }, 3000)
    return () => clearTimeout(timer)
  }, [activeFile?.content, activeFile?.path])

  // Cleanup models for closed files
  useEffect(() => {
    const openPaths = new Set(openFiles.map(f => f.path))
    modelsRef.current.forEach((model, path) => {
      if (!openPaths.has(path)) {
        model.dispose()
        modelsRef.current.delete(path)
        viewStateRef.current.delete(path)
      }
    })
  }, [openFiles])

  if (!activeFile) return null

  // Large file protection: >1MB → read-only mode
  const isLargeFile = activeFile.content.length > 1024 * 1024

  return (
    <MonacoEditor
      height="100%"
      // language & value are set via model; these are initial only
      defaultLanguage={activeFile.language}
      defaultValue={activeFile.content}
      theme="catppuccin"
      loading={<div className={styles.monacoLoading}>Loading editor…</div>}
      options={{
        fontSize: 14,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        wordWrap: 'on',
        minimap: { enabled: !isLargeFile, scale: 1 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: !isLargeFile },
        guides: { bracketPairs: !isLargeFile },
        padding: { top: 8 },
        smoothScrolling: true,
        cursorSmoothCaretAnimation: 'on',
        cursorBlinking: 'smooth',
        quickSuggestions: !isLargeFile,
        readOnly: isLargeFile,
        readOnlyMessage: { value: 'This file is large (>1MB). Opened in read-only mode for performance.' },
      }}
      onMount={handleMount}
    />
  )
}

// ── Main Editor component ─────────────────────────────────────────────────
export default function Editor() {
  const { openFiles, activeFilePath } = useFileStore()
  const activeFile = openFiles.find(f => f.path === activeFilePath)

  if (openFiles.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyTitle}>Claude IDE</div>
          <div className={styles.emptyHint}>Open a file from the explorer, or ask Claude to create one</div>
          <div className={styles.shortcuts}>
            <span><kbd>Ctrl+S</kbd> Save file</span>
            <span><kbd>Ctrl+Z</kbd> Undo</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.editor}>
      <TabBar />
      <div className={styles.editorContent}>
        <SingleEditor />
      </div>
      {activeFile && (
        <div className={styles.statusBar}>
          <span className={styles.lang}>{activeFile.language}</span>
          <span className={styles.filePath}>{activeFile.path.replace(/\\/g, '/')}</span>
          {activeFile.modified && <span className={styles.modifiedBadge}>● Modified</span>}
        </div>
      )}
    </div>
  )
}
