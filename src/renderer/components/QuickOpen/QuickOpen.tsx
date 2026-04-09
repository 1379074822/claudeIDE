import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, File } from 'lucide-react'
import { useFileStore } from '../../store'
import { getLanguageFromPath } from '../../utils/fileUtils'
import styles from './QuickOpen.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  rootPath: string
}

async function collectFiles(api: any, dir: string, collected: string[] = []): Promise<string[]> {
  const res = await api.fs.readDir(dir)
  if (!res.success) return collected
  for (const entry of res.entries) {
    if (entry.isDirectory) {
      // Skip common noise dirs
      const name = entry.name
      if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.next') continue
      await collectFiles(api, entry.path, collected)
    } else {
      collected.push(entry.path)
    }
  }
  return collected
}

export default function QuickOpen({ isOpen, onClose, rootPath }: Props) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load file list when opened
  useEffect(() => {
    if (!isOpen || !rootPath) return
    setQuery('')
    setSelected(0)
    const api = (window as any).electronAPI
    if (!api) return
    collectFiles(api, rootPath).then(setFiles)
  }, [isOpen, rootPath])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50)
    const q = query.toLowerCase()
    return files
      .filter(f => f.toLowerCase().includes(q))
      .slice(0, 50)
  }, [files, query])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const openFile = useCallback((filePath: string) => {
    const api = (window as any).electronAPI
    if (!api) return
    const store = useFileStore.getState()
    const existing = store.openFiles.find(f => f.path === filePath)
    if (existing) {
      store.setActiveFile(filePath)
    } else {
      api.fs.readFile(filePath).then((result: any) => {
        if (!result?.success) return
        const name = filePath.replace(/\\/g, '/').split('/').pop() || filePath
        store.openFile({
          path: filePath, name,
          content: result.content,
          language: getLanguageFromPath(name),
          modified: false,
          originalContent: result.content,
        })
      })
    }
    onClose()
  }, [onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(v => Math.min(v + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)) }
    if (e.key === 'Enter' && filtered[selected]) { openFile(filtered[selected]) }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={e => e.stopPropagation()}>
        <div className={styles.inputWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="输入文件名快速打开..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className={styles.list} ref={listRef}>
          {filtered.length === 0 && (
            <div className={styles.empty}>{files.length === 0 ? '加载文件列表中...' : '无匹配文件'}</div>
          )}
          {filtered.map((f, i) => {
            const name = f.replace(/\\/g, '/').split('/').pop() || f
            const rel = f.replace(rootPath, '').replace(/^[/\\]/, '').replace(/\\/g, '/')
            return (
              <div
                key={f}
                className={`${styles.item} ${i === selected ? styles.itemActive : ''}`}
                onClick={() => openFile(f)}
              >
                <File size={12} className={styles.fileIcon} />
                <span className={styles.fileName}>{name}</span>
                <span className={styles.filePath}>{rel}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
