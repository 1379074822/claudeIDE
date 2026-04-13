import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen as FolderOpenIcon,
  File, FileCode, FileText, RefreshCw
} from 'lucide-react'
import { useFileStore, useUIStore, type FileEntry } from '../../store'
import { getLanguageFromPath } from '../../utils/fileUtils'
import { useT } from '../../store'
import styles from './FileTree.module.css'

function getFileIcon(name: string) {
  const lang = getLanguageFromPath(name)
  const codeExts = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'c']
  if (codeExts.includes(lang)) return <FileCode size={14} />
  if (lang === 'markdown') return <FileText size={14} />
  return <File size={14} />
}

const FILE_ICON_COLORS: Record<string, string> = {
  typescript: '#3b82f6',
  javascript: '#f59e0b',
  python: '#3b9f4c',
  rust: '#ef4444',
  go: '#06b6d4',
  java: '#f97316',
  markdown: '#a6adc8',
  json: '#f9e2af',
  css: '#a78bfa',
  html: '#f38ba8',
}

interface ContextMenuState {
  x: number
  y: number
  entry: FileEntry
}

// ── Inline Prompt Dialog (replaces window.prompt, blocked in Electron) ────
interface InlinePromptState {
  title: string
  defaultValue: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

function InlinePrompt({ title, defaultValue, onConfirm, onCancel }: InlinePromptState) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    if (value.trim()) onConfirm(value.trim())
    else onCancel()
  }

  return (
    <div className={styles.promptOverlay} onMouseDown={e => e.stopPropagation()} onClick={onCancel}>
      <div className={styles.promptBox} onClick={e => e.stopPropagation()}>
        <div className={styles.promptTitle}>{title}</div>
        <input
          ref={inputRef}
          className={styles.promptInput}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className={styles.promptBtns}>
          <button className={styles.promptCancel} onClick={onCancel}>取消</button>
          <button className={styles.promptOk} onClick={submit}>确认</button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
interface ConfirmDialogState {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogState) {
  return (
    <div className={styles.promptOverlay} onMouseDown={e => e.stopPropagation()} onClick={onCancel}>
      <div className={styles.promptBox} onClick={e => e.stopPropagation()}>
        <div className={styles.promptTitle}>{message}</div>
        <div className={styles.promptBtns}>
          <button className={styles.promptCancel} onClick={onCancel}>取消</button>
          <button
            className={styles.promptOk}
            style={{ background: 'var(--error)', color: 'var(--bg-base)' }}
            onClick={onConfirm}
            autoFocus
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ── File Node ─────────────────────────────────────────────────────────────
interface FileNodeProps {
  entry: FileEntry
  depth: number
  onSelect: (entry: FileEntry) => void
  selectedPath: string | null
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
  refreshKey: number
  gitStatus: Record<string, string>
}

function FileNode({ entry, depth, onSelect, selectedPath, onContextMenu, refreshKey, gitStatus }: FileNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadChildren = useCallback(async () => {
    const api = (window as any).electronAPI
    const result = await api?.fs.readDir(entry.path)
    if (result?.success) setChildren(result.entries)
  }, [entry.path])

  const handleClick = useCallback(async () => {
    if (entry.isDirectory) {
      if (!expanded && children.length === 0) {
        setLoading(true)
        await loadChildren()
        setLoading(false)
      }
      setExpanded(v => !v)
    } else {
      onSelect(entry)
    }
  }, [entry, expanded, children, onSelect, loadChildren])

  // Refresh children when refreshKey changes and this dir is already expanded
  useEffect(() => {
    if (expanded) loadChildren()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const isSelected = selectedPath === entry.path
  const lang = !entry.isDirectory ? getLanguageFromPath(entry.name) : ''
  const iconColor = FILE_ICON_COLORS[lang] || '#a6adc8'

  // Git status: check exact path, or for dirs check if any child has a status
  const gitSt = gitStatus[entry.path]
  const GIT_COLORS: Record<string, string> = { M: '#e5c07b', A: '#98c379', U: '#61afef', D: '#e06c75', R: '#c678dd' }
  const gitColor = gitSt ? GIT_COLORS[gitSt] || '#a6adc8' : undefined

  return (
    <div className={styles.node}>
      <div
        className={`${styles.row} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, entry) }}
        title={entry.path}
        draggable={!entry.isDirectory}
        onDragStart={e => {
          if (entry.isDirectory) return
          e.dataTransfer.setData('text/x-claude-file-path', entry.path)
          e.dataTransfer.setData('text/plain', entry.path)
          e.dataTransfer.effectAllowed = 'copy'
        }}
      >
        <span className={styles.arrow}>
          {entry.isDirectory && (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </span>
        <span className={styles.icon} style={{ color: entry.isDirectory ? '#f9e2af' : iconColor }}>
          {entry.isDirectory
            ? (expanded ? <FolderOpenIcon size={14} /> : <Folder size={14} />)
            : getFileIcon(entry.name)
          }
        </span>
        <span className={styles.name} style={gitColor ? { color: gitColor } : undefined}>{entry.name}</span>
        {gitSt && <span className={styles.gitBadge} style={{ color: gitColor }}>{gitSt}</span>}
        {loading && <span className={styles.loading}>…</span>}
      </div>

      {entry.isDirectory && expanded && (
        <div className={styles.children}>
          {children.map(child => (
            <FileNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              onContextMenu={onContextMenu}
              refreshKey={refreshKey}
              gitStatus={gitStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main FileTree ─────────────────────────────────────────────────────────
interface FileTreeProps {
  refreshKey?: number
}

export default function FileTree({ refreshKey: externalRefreshKey = 0 }: FileTreeProps) {
  const t = useT()
  const { rootPath, fileTree, setFileTree, openFile, activeFilePath } = useFileStore()
  const { setPendingFileRef } = useUIStore()
  const [refreshKey, setRefreshKey] = useState(0)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [promptState, setPromptState] = useState<InlinePromptState | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null)
  const [gitStatus, setGitStatus] = useState<Record<string, string>>({})
  const menuRef = useRef<HTMLDivElement>(null)

  const loadRootDir = useCallback(async () => {
    if (!rootPath) return
    const api = (window as any).electronAPI
    const result = await api?.fs.readDir(rootPath)
    if (result?.success) setFileTree(result.entries)
  }, [rootPath, setFileTree])

  const loadGitStatus = useCallback(async () => {
    if (!rootPath) return
    const api = (window as any).electronAPI
    const result = await api?.git?.status(rootPath)
    if (result?.success) {
      // Keys from git are relative paths — build absolute path map
      const absMap: Record<string, string> = {}
      for (const [rel, st] of Object.entries(result.statusMap as Record<string, string>)) {
        const abs = rootPath + (rootPath.endsWith('\\') || rootPath.endsWith('/') ? '' : '\\') + rel
        absMap[abs] = st
      }
      setGitStatus(absMap)
    }
  }, [rootPath])

  useEffect(() => { loadRootDir() }, [loadRootDir, refreshKey, externalRefreshKey])
  useEffect(() => { loadGitStatus() }, [loadGitStatus, refreshKey, externalRefreshKey])

  // Clamp menu to viewport
  useEffect(() => {
    if (!ctxMenu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    let { x, y } = ctxMenu
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4
    if (x !== ctxMenu.x || y !== ctxMenu.y) setCtxMenu(prev => prev ? { ...prev, x, y } : null)
  }, [ctxMenu])

  // Close menu on outside click — use pointerdown on document (non-capture)
  // so it fires AFTER the menu item's onMouseDown has a chance to set state
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setCtxMenu(null)
    }
    // Use setTimeout so this listener is added AFTER the current event cycle
    // (prevents immediately closing on the same right-click that opened the menu)
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', handler)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', handler)
    }
  }, [ctxMenu])

  const handleSelect = useCallback(async (entry: FileEntry) => {
    const api = (window as any).electronAPI
    const result = await api?.fs.readFile(entry.path)
    if (result?.success) {
      openFile({
        path: entry.path,
        name: entry.name,
        content: result.content,
        language: getLanguageFromPath(entry.name),
        modified: false,
        originalContent: result.content,
      })
    }
  }, [openFile])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  // Stable promise-based dialogs using refs to setters (setters are always stable)
  const showPrompt = useCallback((title: string, defaultValue: string): Promise<string | null> =>
    new Promise(resolve => {
      setPromptState({
        title,
        defaultValue,
        onConfirm: (v) => { setPromptState(null); resolve(v) },
        onCancel: () => { setPromptState(null); resolve(null) },
      })
    }), [])

  const showConfirm = useCallback((message: string): Promise<boolean> =>
    new Promise(resolve => {
      setConfirmState({
        message,
        onConfirm: () => { setConfirmState(null); resolve(true) },
        onCancel: () => { setConfirmState(null); resolve(false) },
      })
    }), [])

  const ctxActions = useCallback(async (action: string, entry: FileEntry) => {
    const api = (window as any).electronAPI

    // Close the menu first
    setCtxMenu(null)

    switch (action) {
      case 'open':
        if (!entry.isDirectory) await handleSelect(entry)
        break

      case 'copyPath':
        await navigator.clipboard.writeText(entry.path)
        break

      case 'copyRelPath': {
        const rp = useFileStore.getState().rootPath
        const rel = rp
          ? entry.path.replace(rp, '').replace(/^[\\/]/, '')
          : entry.path
        await navigator.clipboard.writeText(rel.replace(/\\/g, '/'))
        break
      }

      case 'reveal':
        api?.shell?.showItemInFolder(entry.path)
        break

      case 'newFile': {
        const dirPath = entry.isDirectory ? entry.path : entry.path.replace(/[\\/][^\\/]+$/, '')
        const name = await showPrompt(t.ctxNewFile, '')
        if (!name) break
        const sep = dirPath.includes('\\') ? '\\' : '/'
        const newFilePath = dirPath + sep + name
        const r = await api.fs.writeFile(newFilePath, '')
        if (r?.success === false) { alert('创建文件失败: ' + (r.error || '')); break }
        setRefreshKey(k => k + 1)
        break
      }

      case 'newFolder': {
        const dirPath = entry.isDirectory ? entry.path : entry.path.replace(/[\\/][^\\/]+$/, '')
        const name = await showPrompt(t.ctxNewFolder, '')
        if (!name) break
        const sep = dirPath.includes('\\') ? '\\' : '/'
        const r = await api.fs.mkdir(dirPath + sep + name)
        if (r?.success === false) { alert('创建文件夹失败: ' + (r.error || '')); break }
        setRefreshKey(k => k + 1)
        break
      }

      case 'rename': {
        const newName = await showPrompt(t.ctxRename, entry.name)
        if (!newName || newName === entry.name) break
        const dir = entry.path.replace(/[\\/][^\\/]+$/, '')
        const sep = dir.includes('\\') ? '\\' : '/'
        const r = await api.fs.rename(entry.path, dir + sep + newName)
        if (r?.success === false) { alert('重命名失败: ' + (r.error || '')); break }
        setRefreshKey(k => k + 1)
        break
      }

      case 'delete': {
        const ok = await showConfirm(`删除 "${entry.name}"？此操作不可撤销。`)
        if (!ok) break
        await api?.fs.delete(entry.path)
        setRefreshKey(k => k + 1)
        break
      }

      case 'sendToChat':
        // Set in UIStore — Chat will pick it up and insert a ref chip
        setPendingFileRef(entry.path)
        break
    }
  }, [handleSelect, showPrompt, showConfirm, setPendingFileRef, t])

  const rootEntry: FileEntry | null = rootPath ? {
    path: rootPath,
    name: rootPath.split(/[\\/]/).pop() || rootPath,
    isDirectory: true,
  } : null

  if (!rootPath) {
    return (
      <div className={styles.empty}>
        <Folder size={32} color="#45475a" />
        <p>No folder opened</p>
        <p className={styles.hint}>Click the folder icon above to open a project</p>
      </div>
    )
  }

  return (
    <div className={styles.tree}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>EXPLORER</span>
        <button className={styles.refreshBtn} onClick={() => setRefreshKey(k => k + 1)} title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className={styles.entries}>
        {/* Root directory row — supports right-click to create files at root level */}
        {rootEntry && (
          <div
            className={styles.rootRow}
            onContextMenu={e => { e.preventDefault(); handleContextMenu(e, rootEntry) }}
            title={rootEntry.path}
          >
            <span className={styles.icon} style={{ color: '#f9e2af', marginRight: 4 }}>
              <FolderOpenIcon size={14} />
            </span>
            <span className={styles.rootName}>{rootEntry.name}</span>
          </div>
        )}

        {fileTree.map(entry => (
          <FileNode
            key={entry.path}
            entry={entry}
            depth={0}
            onSelect={handleSelect}
            selectedPath={activeFilePath}
            onContextMenu={handleContextMenu}
            refreshKey={refreshKey + externalRefreshKey}
            gitStatus={gitStatus}
          />
        ))}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <>
          <div
            className={styles.contextMenuOverlay}
            onClick={() => setCtxMenu(null)}
            onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }}
          />
          <div
            ref={menuRef}
            className={styles.contextMenu}
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            {!ctxMenu.entry.isDirectory && (
              <div className={styles.ctxItem} onClick={() => ctxActions('open', ctxMenu.entry)}>{t.ctxOpenFile}</div>
            )}
            <div className={styles.ctxItem} onClick={() => ctxActions('copyPath', ctxMenu.entry)}>{t.ctxCopyPath}</div>
            <div className={styles.ctxItem} onClick={() => ctxActions('copyRelPath', ctxMenu.entry)}>{t.ctxCopyRelPath}</div>
            <div className={styles.ctxItem} onClick={() => ctxActions('reveal', ctxMenu.entry)}>{t.ctxRevealExplorer}</div>
            <div className={styles.ctxDivider} />
            <div className={styles.ctxItem} onClick={() => ctxActions('newFile', ctxMenu.entry)}>{t.ctxNewFile}</div>
            <div className={styles.ctxItem} onClick={() => ctxActions('newFolder', ctxMenu.entry)}>{t.ctxNewFolder}</div>
            {ctxMenu.entry.path !== rootPath && (
              <div className={styles.ctxItem} onClick={() => ctxActions('rename', ctxMenu.entry)}>{t.ctxRename}</div>
            )}
            <div className={styles.ctxDivider} />
            {ctxMenu.entry.path !== rootPath && (
              <div className={`${styles.ctxItem} ${styles.danger}`} onClick={() => ctxActions('delete', ctxMenu.entry)}>{t.ctxDelete}</div>
            )}
            <div className={styles.ctxDivider} />
            <div className={styles.ctxItem} onClick={() => ctxActions('sendToChat', ctxMenu.entry)}>{t.ctxSendToChat}</div>
          </div>
        </>
      )}

      {/* Inline Prompt */}
      {promptState && <InlinePrompt {...promptState} />}

      {/* Confirm Dialog */}
      {confirmState && <ConfirmDialog {...confirmState} />}
    </div>
  )
}
