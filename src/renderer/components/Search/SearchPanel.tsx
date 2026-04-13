import { useState, useCallback, useRef } from 'react'
import { Search, X, ChevronRight, File, CaseSensitive, Regex } from 'lucide-react'
import { useFileStore } from '../../store'
import { getLanguageFromPath } from '../../utils/fileUtils'
import { getAPI } from '../../utils/electronAPI'
import styles from './SearchPanel.module.css'

interface SearchMatch {
  file: string
  line: number
  text: string
  matchStart?: number
  matchEnd?: number
}

interface SearchGroup {
  file: string
  matches: SearchMatch[]
}

// File name matches (separate from content matches)
interface FileMatch {
  path: string
  name: string
}

function groupResults(raw: string, query: string, isRegex: boolean, caseSensitive: boolean): SearchGroup[] {
  const groups: Map<string, SearchMatch[]> = new Map()
  for (const line of raw.split('\n')) {
    const m = line.match(/^(.+?):(\d+):(.*)$/)
    if (!m) continue
    const [, file, lineStr, text] = m

    // Calculate match position for highlight
    let matchStart: number | undefined
    let matchEnd: number | undefined
    try {
      const flags = caseSensitive ? '' : 'i'
      const searchRegex = isRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
      const matchResult = text.trim().match(searchRegex)
      if (matchResult && matchResult.index !== undefined) {
        matchStart = matchResult.index
        matchEnd = matchResult.index + matchResult[0].length
      }
    } catch {
      // Ignore invalid regex
    }

    if (!groups.has(file)) groups.set(file, [])
    groups.get(file)!.push({
      file,
      line: parseInt(lineStr, 10),
      text: text.trim(),
      matchStart,
      matchEnd,
    })
  }
  return Array.from(groups.entries()).map(([file, matches]) => ({ file, matches }))
}

export default function SearchPanel({ rootPath }: { rootPath: string }) {
  const [query, setQuery] = useState('')
  const [filePattern, setFilePattern] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [regexError, setRegexError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchGroup[]>([])
  const [fileMatches, setFileMatches] = useState<FileMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Validate regex when useRegex is on
  const validateRegex = (q: string): boolean => {
    if (!useRegex) return true
    try {
      new RegExp(q)
      setRegexError(null)
      return true
    } catch (e: any) {
      setRegexError(e.message)
      return false
    }
  }

  const handleQueryChange = (q: string) => {
    setQuery(q)
    if (useRegex) validateRegex(q)
    else setRegexError(null)
  }

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !rootPath) return
    if (useRegex && !validateRegex(query)) return

    setLoading(true)
    setSearched(true)
    setError(null)
    try {
      const api = getAPI()
      if (!api) return

      // Content search
      const res = await api.tools.grep(query, rootPath, filePattern || undefined, caseSensitive, useRegex)
      if (res.success && res.results) {
        setResults(groupResults(res.results, query, useRegex, caseSensitive))
      } else {
        setResults([])
        if (res.error) setError(res.error)
      }

      // File name search (always literal, case-insensitive)
      const globRes = await api.tools.glob('**/*', rootPath)
      if (globRes.success && globRes.files) {
        const q = query.toLowerCase()
        const matched = globRes.files
          .filter(f => {
            const name = f.replace(/\\/g, '/').split('/').pop() || ''
            return name.toLowerCase().includes(q)
          })
          .slice(0, 20)
          .map(f => ({ path: f, name: f.replace(/\\/g, '/').split('/').pop() || f }))
        setFileMatches(matched)
      }
    } catch (e: any) {
      setResults([])
      setError(e.message)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filePattern, rootPath, caseSensitive, useRegex])

  const openFile = useCallback((filePath: string, line?: number) => {
    const api = getAPI()
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
    if (line) {
      setTimeout(() => {
        import('monaco-editor').then(monaco => {
          const eds = monaco.editor.getEditors()
          if (!eds.length) return
          const ed = eds[eds.length - 1]
          ed.revealLineInCenter(line)
          ed.setPosition({ lineNumber: line, column: 1 })
          ed.focus()
        })
      }, 150)
    }
  }, [])

  const totalMatches = results.reduce((n, g) => n + g.matches.length, 0)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>SEARCH</div>

      <div className={styles.inputs}>
        {/* Query row */}
        <div className={styles.inputRow}>
          <Search size={12} className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={`${styles.input} ${regexError ? styles.inputError : ''}`}
            placeholder="搜索文件名或内容..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => {
              setQuery(''); setResults([]); setFileMatches([])
              setSearched(false); setError(null); setRegexError(null)
            }}>
              <X size={11} />
            </button>
          )}
        </div>

        {/* Toggle buttons: case-sensitive + regex */}
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${caseSensitive ? styles.toggleActive : ''}`}
            onClick={() => setCaseSensitive(v => !v)}
            title="区分大小写"
          >
            <CaseSensitive size={13} />
          </button>
          <button
            className={`${styles.toggleBtn} ${useRegex ? styles.toggleActive : ''}`}
            onClick={() => {
              const next = !useRegex
              setUseRegex(next)
              if (!next) setRegexError(null)
              else validateRegex(query)
            }}
            title="使用正则表达式"
          >
            <Regex size={13} />
          </button>
          <span className={styles.toggleLabel}>
            {caseSensitive ? '区分大小写' : '忽略大小写'}
            {useRegex ? ' · 正则' : ''}
          </span>
        </div>

        {/* Regex error */}
        {regexError && (
          <div className={styles.regexError}>正则错误: {regexError}</div>
        )}

        {/* File filter */}
        <input
          className={styles.input}
          placeholder="内容搜索文件过滤（如 *.ts）"
          value={filePattern}
          onChange={e => setFilePattern(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={styles.searchBtn} onClick={handleSearch} disabled={!query.trim() || loading || !!regexError}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {searched && !loading && (
        <div className={styles.summary}>
          {fileMatches.length > 0 && `${fileMatches.length} 个文件名匹配`}
          {fileMatches.length > 0 && totalMatches > 0 && '，'}
          {totalMatches > 0 && `${totalMatches} 处内容匹配`}
          {fileMatches.length === 0 && totalMatches === 0 && '无匹配结果'}
        </div>
      )}

      <div className={styles.results}>
        {/* File name matches */}
        {fileMatches.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>文件名匹配</div>
            {fileMatches.map(f => (
              <div key={f.path} className={styles.fileNameMatch} onClick={() => openFile(f.path)} title={f.path}>
                <File size={11} />
                <span>{f.name}</span>
                <span className={styles.fileNamePath}>{f.path.replace(rootPath, '').replace(/^[/\\]/, '').replace(/\\/g, '/')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content matches */}
        {results.length > 0 && (
          <div className={styles.section}>
            {fileMatches.length > 0 && <div className={styles.sectionTitle}>内容匹配</div>}
            {results.map(group => (
              <FileGroup
                key={group.file}
                group={group}
                rootPath={rootPath}
                query={query}
                isRegex={useRegex}
                caseSensitive={caseSensitive}
                onOpen={m => openFile(m.file, m.line)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── File Group with highlighted matches ──────────────────────────────────

function HighlightedText({ text, matchStart, matchEnd }: { text: string; matchStart?: number; matchEnd?: number }) {
  if (matchStart === undefined || matchEnd === undefined) {
    return <span>{text.slice(0, 120)}</span>
  }
  const displayText = text.slice(0, 120)
  const clampedEnd = Math.min(matchEnd, displayText.length)
  return (
    <>
      <span>{displayText.slice(0, matchStart)}</span>
      <mark className={styles.highlight}>{displayText.slice(matchStart, clampedEnd)}</mark>
      <span>{displayText.slice(clampedEnd)}</span>
    </>
  )
}

function FileGroup({
  group, rootPath, query, isRegex, caseSensitive, onOpen,
}: {
  group: SearchGroup
  rootPath: string
  query: string
  isRegex: boolean
  caseSensitive: boolean
  onOpen: (m: SearchMatch) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const relPath = group.file.replace(rootPath, '').replace(/^[/\\]/, '').replace(/\\/g, '/')

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
              <span className={styles.matchText}>
                <HighlightedText text={m.text} matchStart={m.matchStart} matchEnd={m.matchEnd} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
