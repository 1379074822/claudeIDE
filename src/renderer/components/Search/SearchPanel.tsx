import { useState, useCallback, useRef } from 'react'
import { Search, X, ChevronRight } from 'lucide-react'
import { useFileStore } from '../../store'
import { getLanguageFromPath } from '../../utils/fileUtils'
import styles from './SearchPanel.module.css'

interface SearchMatch {
  file: string
  line: number
  text: string
}

interface SearchGroup {
  file: string
  matches: SearchMatch[]
}

function groupResults(raw: string): SearchGroup[] {
  const groups: Map<string, SearchMatch[]> = new Map()
  for (const line of raw.split('\n')) {
    // grep output: file:linenum:text
    const m = line.match(/^(.+?):(\d+):(.*)$/)
    if (!m) continue
    const [, file, lineStr, text] = m
    if (!groups.has(file)) groups.set(file, [])
    groups.get(file)!.push({ file, line: parseInt(lineStr, 10), text: text.trim() })
  }
  return Array.from(groups.entries()).map(([file, matches]) => ({ file, matches }))
}

export default function SearchPanel({ rootPath }: { rootPath: string }) {
  const [query, setQuery] = useState('')
  const [filePattern, setFilePattern] = useState('')
  const [results, setResults] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !rootPath) return
    setLoading(true)
    setSearched(true)
    try {
      const api = (window as any).electronAPI
      const res = await api.tools.grep(query, rootPath, filePattern || undefined)
      if (res.success && res.results) {
        setResults(groupResults(res.results))
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [query, filePattern, rootPath])

  const openMatch = useCallback((match: SearchMatch) => {
    const api = (window as any).electronAPI
    if (!api) return
    const store = useFileStore.getState()
    const existing = store.openFiles.find(f => f.path === match.file)
    if (existing) {
      store.setActiveFile(match.file)
    } else {
      api.fs.readFile(match.file).then((result: any) => {
        if (!result?.success) return
        const name = match.file.replace(/\\/g, '/').split('/').pop() || match.file
        store.openFile({
          path: match.file, name,
          content: result.content,
          language: getLanguageFromPath(name),
          modified: false,
          originalContent: result.content,
        })
      })
    }
    // Scroll to line via monaco after a short delay
    setTimeout(() => {
      import('monaco-editor').then(monaco => {
        const eds = monaco.editor.getEditors()
        if (!eds.length) return
        const ed = eds[eds.length - 1]
        ed.revealLineInCenter(match.line)
        ed.setPosition({ lineNumber: match.line, column: 1 })
        ed.focus()
      })
    }, 150)
  }, [])

  const totalMatches = results.reduce((n, g) => n + g.matches.length, 0)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>SEARCH</div>

      <div className={styles.inputs}>
        <div className={styles.inputRow}>
          <Search size={12} className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="搜索内容..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => { setQuery(''); setResults([]); setSearched(false) }}>
              <X size={11} />
            </button>
          )}
        </div>
        <input
          className={styles.input}
          placeholder="文件过滤（如 *.ts）"
          value={filePattern}
          onChange={e => setFilePattern(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={styles.searchBtn} onClick={handleSearch} disabled={!query.trim() || loading}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {searched && !loading && (
        <div className={styles.summary}>
          {totalMatches > 0
            ? `${totalMatches} 个结果，来自 ${results.length} 个文件`
            : '无匹配结果'}
        </div>
      )}

      <div className={styles.results}>
        {results.map(group => (
          <FileGroup key={group.file} group={group} rootPath={rootPath} onOpen={openMatch} />
        ))}
      </div>
    </div>
  )
}

function FileGroup({ group, rootPath, onOpen }: { group: SearchGroup; rootPath: string; onOpen: (m: SearchMatch) => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const relPath = group.file.replace(rootPath, '').replace(/^[/\\]/, '')

  return (
    <div className={styles.fileGroup}>
      <div className={styles.fileHeader} onClick={() => setCollapsed(v => !v)}>
        <ChevronRight size={11} className={collapsed ? '' : styles.chevronOpen} />
        <span className={styles.fileName} title={group.file}>{relPath}</span>
        <span className={styles.matchCount}>{group.matches.length}</span>
      </div>
      {!collapsed && (
        <div className={styles.matchList}>
          {group.matches.map((m, i) => (
            <div key={i} className={styles.matchItem} onClick={() => onOpen(m)}>
              <span className={styles.lineNum}>{m.line}</span>
              <span className={styles.matchText}>{m.text.slice(0, 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
