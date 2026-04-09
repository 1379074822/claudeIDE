import {
  Terminal, FileEdit, Search, Globe, Zap,
  ChevronDown, ChevronRight
} from 'lucide-react'
import { useState, memo, useMemo } from 'react'
import type { ChatMessage } from '../../store'
import styles from './Message.module.css'

const TOOL_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  execute_command: { icon: <Terminal size={12} />, color: '#f9e2af', label: 'Bash' },
  bash:           { icon: <Terminal size={12} />, color: '#f9e2af', label: 'Bash' },
  read_file:      { icon: <FileEdit size={12} />, color: '#89b4fa', label: 'Read' },
  write_file:     { icon: <FileEdit size={12} />, color: '#a6e3a1', label: 'Write' },
  edit_file:      { icon: <FileEdit size={12} />, color: '#a6e3a1', label: 'Edit' },
  list_files:     { icon: <Search size={12} />,   color: '#cba6f7', label: 'List' },
  glob:           { icon: <Search size={12} />,   color: '#cba6f7', label: 'Glob' },
  grep:           { icon: <Search size={12} />,   color: '#cba6f7', label: 'Grep' },
  web_search:     { icon: <Globe size={12} />,    color: '#fab387', label: 'Search' },
  fetch_url:      { icon: <Globe size={12} />,    color: '#fab387', label: 'Fetch' },
}

function getToolMeta(name: string) {
  const key = name.toLowerCase().replace(/tool$/, '')
  return TOOL_META[key] || { icon: <Zap size={12} />, color: '#a6adc8', label: name }
}

function ToolMessage({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false)
  const meta = useMemo(() => getToolMeta(msg.toolName || ''), [msg.toolName])

  const inputSummary = useMemo(() => {
    try {
      const input = JSON.parse(msg.toolInput || '{}')
      return input.command || input.path || input.pattern || input.query || input.url || ''
    } catch { return '' }
  }, [msg.toolInput])

  const isBash = meta.label === 'Bash'

  return (
    <div className={styles.toolMessage}>
      <div className={styles.toolHeader} onClick={() => setExpanded(v => !v)}>
        <span className={styles.toolIcon} style={{ color: meta.color }}>{meta.icon}</span>
        <span className={styles.toolLabel} style={{ color: meta.color }}>{meta.label}</span>
        {inputSummary && (
          <span className={styles.toolSummary}>
            {inputSummary.length > 60 ? inputSummary.slice(0, 60) + '...' : inputSummary}
          </span>
        )}
        <span className={styles.toolExpand}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </div>

      {expanded && msg.toolInput && (
        <div className={styles.toolBody}>
          {isBash ? (
            <div className={styles.terminalBlock}>
              <pre className={styles.terminalText}>
                {(() => {
                  try {
                    return `$ ${JSON.parse(msg.toolInput).command || ''}`
                  } catch { return msg.toolInput }
                })()}
              </pre>
            </div>
          ) : (
            <pre className={styles.toolCode}>{msg.toolInput}</pre>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(ToolMessage)
