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

// 模块级缓存（跨组件实例）
let fileCache: { rootPath: string; files: string[]; ts: number } = { rootPath: '', files: [], ts: 0 }
const CACHE_TTL = 30_000 // 30秒内不重新扫描

async function collectFiles(api: ElectronAPI, dir: string, collected: string[] = []): Promise<string[]> {
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
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load file list when opened
  useEffect(() => {
    if (!isOpen || !rootPath) return
    setQuery('')
    setSelected(0)

    // 缓存命中
    if (fileCache.rootPath === rootPath && Date.now() - fileCache.ts < CACHE_TTL) {
      setFiles(fileCache.files)
      setLoading(false)
      return
    }

    const api = (window as any).electronAPI
    if (!api) return
    setFiles([]) // 清空旧数据，触发"扫描中"提示
    setLoading(true)
    collectFiles(api, rootPath).then(result => {
      fileCache = { rootPath, files: result, ts: Date.now() }
      setFiles(result)
      setLoading(false)
    })
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
      api.fs.readFile(filePath).then((result) => {
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

  // 状态提示文字
  const emptyMessage = loading
    ? '扫描项目文件...'
    : files.length > 0
    ? '无匹配文件'
    : '无文件'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={e => e.stopPropagation()}>
        <div className={styles.inputWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder={files.length > 0 ? `输入文件名快速打开... (共 ${files.length} 个文件)` : '输入文件名快速打开...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className={styles.list} ref={listRef}>
          {filtered.length === 0 && (
            <div className={styles.empty}>{emptyMessage}</div>
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
