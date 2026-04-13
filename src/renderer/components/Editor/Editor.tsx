import { useRef, useCallback, useEffect, useState } from 'react'
import MonacoEditor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { X, Circle, Save } from 'lucide-react'
import { useFileStore, type OpenFile } from '../../store'
import { useUIStore, useSessionStore } from '../../store'
import { claudeClient } from '../../utils/claudeClient'
import { serverClient } from '../../utils/serverClient'
import { diffLines } from '../../utils/fileUtils'
import styles from './Editor.module.css'

// ── Pre-init Monaco from local node_modules (eliminates CDN loading) ──────
loader.config({ monaco })

const DARK_EDITOR_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '555555', fontStyle: 'italic' },
    { token: 'keyword', foreground: '4db8b8' },
    { token: 'string', foreground: '4d9e6e' },
    { token: 'number', foreground: 'b89550' },
    { token: 'type', foreground: '5090c0' },
    { token: 'function', foreground: '8ab4d8' },
    { token: 'variable', foreground: 'cccccc' },
  ],
  colors: {
    'editor.background': '#1a1a1a',
    'editor.foreground': '#cccccc',
    'editor.lineHighlightBackground': '#222222',
    'editor.selectionBackground': '#2e2e2e',
    'editorCursor.foreground': '#4db8b8',
    'editorLineNumber.foreground': '#3a3a3a',
    'editorLineNumber.activeForeground': '#666666',
    'editor.inactiveSelectionBackground': '#252525',
    'editorIndentGuide.background': '#252525',
    'editorWhitespace.foreground': '#252525',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#2e2e2e80',
    'scrollbarSlider.hoverBackground': '#3e3e3e80',
    'scrollbarSlider.activeBackground': '#4e4e4e80',
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
          {file.modified && <Circle size={6} fill="#4d9fff" stroke="none" className={styles.dot} />}
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
  const { openFiles, activeFilePath, updateFileContent, markFileSaved, pendingDiffs, acceptPendingDiff, rejectPendingDiff } = useFileStore()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  // Map from file path → monaco model
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map())
  // Track view state (scroll/cursor) per file
  const viewStateRef = useRef<Map<string, monaco.editor.ICodeEditorViewState>>(new Map())
  // Pending diff decorations collection
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  // Accept/Reject widget DOM node
  const diffWidgetRef = useRef<{ widget: monaco.editor.IContentWidget; el: HTMLElement } | null>(null)

  const activeFile = openFiles.find(f => f.path === activeFilePath)

  // On mount: define theme once
  const handleMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInst: typeof monaco) => {
    editorRef.current = editor
    monacoRef.current = monacoInst

    monacoInst.editor.defineTheme('ide-dark', DARK_EDITOR_THEME)
    monacoInst.editor.setTheme(useUIStore.getState().theme === 'clean-light' ? 'vs' : 'ide-dark')

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
      // Ensure chat panel is visible
      const uiStore = useUIStore.getState()
      if (!uiStore.showChat) uiStore.toggleChat()

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

    editor.addAction({
      id: 'ai-fix',
      label: '🐛 AI: Fix Bug / 修复问题',
      contextMenuGroupId: 'ai',
      contextMenuOrder: 4,
      run: (ed) => {
        const sel = ed.getSelection()
        const code = sel ? ed.getModel()?.getValueInRange(sel) : ''
        if (!code?.trim()) return
        sendToChat(`以下代码有问题，请帮我找出并修复：\n\`\`\`\n${code}\n\`\`\``)
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
    // Don't auto-save files with pending diffs — user must explicitly accept
    const hasPendingDiff = useFileStore.getState().pendingDiffs.some(d => d.filePath === activeFile.path)
    if (hasPendingDiff) return
    const timer = setTimeout(async () => {
      const api = (window as any).electronAPI
      if (!api) return
      const store = useFileStore.getState()
      const file = store.openFiles.find(f => f.path === activeFile.path)
      if (!file?.modified) return
      // Double-check no pending diff appeared
      if (store.pendingDiffs.some(d => d.filePath === activeFile.path)) return
      const result = await api.fs.writeFile(file.path, file.content)
      if (result.success) store.markFileSaved(file.path)
    }, 3000)
    return () => clearTimeout(timer)
  }, [activeFile?.content, activeFile?.path])

  // Pending diff decorations
  useEffect(() => {
    const editor = editorRef.current
    const monacoInst = monacoRef.current
    if (!editor || !monacoInst || !activeFilePath) return

    const pendingDiff = pendingDiffs.find(d => d.filePath === activeFilePath)

    // Clear previous decorations
    if (decorationsRef.current) {
      decorationsRef.current.clear()
    }
    // Remove previous widget
    if (diffWidgetRef.current) {
      editor.removeContentWidget(diffWidgetRef.current.widget)
      diffWidgetRef.current = null
    }

    if (!pendingDiff) return

    // Compute line-level diff and map to newContent line numbers
    const lines = diffLines(pendingDiff.oldContent, pendingDiff.newContent)
    const addedLines: number[] = []
    const deletedBeforeLine: Array<{ lineNo: number; texts: string[] }> = []
    let newLineNo = 1
    let pendingDeleted: string[] = []

    for (const line of lines) {
      if (line.type === '-') {
        pendingDeleted.push(line.text)
      } else if (line.type === '+') {
        if (pendingDeleted.length > 0) {
          deletedBeforeLine.push({ lineNo: newLineNo, texts: pendingDeleted })
          pendingDeleted = []
        }
        addedLines.push(newLineNo)
        newLineNo++
      } else {
        if (pendingDeleted.length > 0) {
          deletedBeforeLine.push({ lineNo: newLineNo, texts: pendingDeleted })
          pendingDeleted = []
        }
        newLineNo++
      }
    }
    if (pendingDeleted.length > 0) {
      deletedBeforeLine.push({ lineNo: newLineNo, texts: pendingDeleted })
    }

    // Build decorations for added lines
    const decorations: monaco.editor.IModelDeltaDecoration[] = addedLines.map(ln => ({
      range: new monacoInst.Range(ln, 1, ln, 1),
      options: {
        isWholeLine: true,
        className: 'diff-added-line',
        linesDecorationsClassName: 'diff-added-gutter',
        overviewRuler: { color: 'rgba(166,227,161,0.6)', position: monacoInst.editor.OverviewRulerLane.Left },
      },
    }))

    // Build decorations for deleted lines (shown as overlay above the insertion point)
    for (const { lineNo, texts } of deletedBeforeLine) {
      for (const text of texts) {
        decorations.push({
          range: new monacoInst.Range(Math.max(1, lineNo - 1), 1, Math.max(1, lineNo - 1), 1),
          options: {
            after: {
              content: text || ' ',
              inlineClassName: 'diff-deleted-inline',
            },
          },
        })
      }
    }

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection([])
    }
    decorationsRef.current.set(decorations)

    // Inject CSS for decorations if not already present
    if (!document.getElementById('diff-decoration-styles')) {
      const style = document.createElement('style')
      style.id = 'diff-decoration-styles'
      style.textContent = `
        .diff-added-line { background: rgba(166,227,161,0.12) !important; }
        .diff-added-gutter { background: rgba(166,227,161,0.5); width: 3px !important; margin-left: 3px; }
        .diff-deleted-inline { background: rgba(243,139,168,0.18); color: #f38ba8; text-decoration: line-through; font-size: 12px; }
      `
      document.head.appendChild(style)
    }

    // Show Accept/Reject widget near the first changed line
    const firstChangedLine = addedLines[0] || (deletedBeforeLine[0]?.lineNo ?? 1)
    const el = document.createElement('div')
    el.style.cssText = 'display:flex;gap:4px;padding:2px 0;z-index:100'
    el.innerHTML = `
      <button id="diff-accept-btn" style="padding:2px 10px;font-size:11px;font-weight:600;background:rgba(166,227,161,0.2);border:1px solid rgba(166,227,161,0.5);border-radius:4px;color:#a6e3a1;cursor:pointer;">Keep</button>
      <button id="diff-reject-btn" style="padding:2px 10px;font-size:11px;font-weight:600;background:rgba(243,139,168,0.15);border:1px solid rgba(243,139,168,0.4);border-radius:4px;color:#f38ba8;cursor:pointer;">Undo</button>
    `

    const widget: monaco.editor.IContentWidget = {
      getId: () => 'diff-accept-reject-widget',
      getDomNode: () => el,
      getPosition: () => ({
        position: { lineNumber: firstChangedLine, column: 1 },
        preference: [monacoInst.editor.ContentWidgetPositionPreference.ABOVE],
      }),
    }

    editor.addContentWidget(widget)
    diffWidgetRef.current = { widget, el }

    const filePath = activeFilePath
    el.querySelector('#diff-accept-btn')?.addEventListener('click', () => {
      acceptPendingDiff(filePath)
    })
    el.querySelector('#diff-reject-btn')?.addEventListener('click', () => {
      rejectPendingDiff(filePath)
    })

    return () => {
      if (decorationsRef.current) decorationsRef.current.clear()
      if (diffWidgetRef.current) {
        editor.removeContentWidget(diffWidgetRef.current.widget)
        diffWidgetRef.current = null
      }
    }
  }, [activeFilePath, pendingDiffs, acceptPendingDiff, rejectPendingDiff])

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

  if (!activeFile || activeFile.content == null) return null

  // Large file protection: >1MB → read-only mode
  const isLargeFile = activeFile.content.length > 1024 * 1024

  return (
    <MonacoEditor
      height="100%"
      // language & value are set via model; these are initial only
      defaultLanguage={activeFile.language}
      defaultValue={activeFile.content}
      theme={useUIStore.getState().theme === 'clean-light' ? 'vs' : 'ide-dark'}
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
