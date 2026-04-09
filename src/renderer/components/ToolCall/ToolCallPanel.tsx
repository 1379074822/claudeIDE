import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Terminal, FileEdit, Search,
  Globe, Zap, CheckCircle, Clock, AlertCircle, Loader, X
} from 'lucide-react'
import { useToolStore } from '../../store'
import styles from './ToolCallPanel.module.css'

const TOOL_ICONS: Record<string, React.ReactNode> = {
  bash: <Terminal size={12} />,
  execute_command: <Terminal size={12} />,
  powershell: <Terminal size={12} />,
  read_file: <FileEdit size={12} />,
  file_read: <FileEdit size={12} />,
  write_file: <FileEdit size={12} />,
  file_write: <FileEdit size={12} />,
  edit_file: <FileEdit size={12} />,
  file_edit: <FileEdit size={12} />,
  glob: <Search size={12} />,
  grep: <Search size={12} />,
  list_files: <Search size={12} />,
  web_search: <Globe size={12} />,
  web_fetch: <Globe size={12} />,
  fetch_url: <Globe size={12} />,
  agent: <Zap size={12} />,
}

const TOOL_COLORS: Record<string, string> = {
  bash: '#f9e2af',
  execute_command: '#f9e2af',
  powershell: '#89b4fa',
  write_file: '#a6e3a1',
  file_write: '#a6e3a1',
  edit_file: '#a6e3a1',
  file_edit: '#a6e3a1',
  read_file: '#89b4fa',
  file_read: '#89b4fa',
  glob: '#cba6f7',
  grep: '#cba6f7',
  list_files: '#cba6f7',
  web_search: '#fab387',
  web_fetch: '#fab387',
  fetch_url: '#fab387',
  agent: '#f5c2e7',
}

function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/tool$/, '')
}

function getInputSummary(name: string, input: Record<string, unknown>): string {
  const n = normalizeToolName(name)
  if (n === 'bash' || n === 'execute_command') return String(input.command || '')
  if (n.includes('file') || n.includes('read') || n.includes('write') || n.includes('edit'))
    return String(input.path || input.file_path || '')
  if (n === 'glob') return String(input.pattern || '')
  if (n === 'grep') return String(input.pattern || '')
  if (n === 'web_search') return String(input.query || '')
  if (n === 'web_fetch' || n === 'fetch_url') return String(input.url || '')
  return ''
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <span className={`${styles.badge} ${styles.badgeDone}`}><CheckCircle size={10} /> done</span>
    case 'running':
      return <span className={`${styles.badge} ${styles.badgeRunning}`}><Loader size={10} className={styles.spin} /> running</span>
    case 'error':
      return <span className={`${styles.badge} ${styles.badgeError}`}><AlertCircle size={10} /> error</span>
    default:
      return <span className={`${styles.badge} ${styles.badgePending}`}><Clock size={10} /> pending</span>
  }
}

export default function ToolCallPanel() {
  const { toolCalls } = useToolStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)

  if (toolCalls.length === 0) return null

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const recentCalls = toolCalls.slice(-30)
  const runningCount = recentCalls.filter(c => c.status === 'running').length

  return (
    <div className={styles.panel}>
      <div className={styles.header} onClick={() => setCollapsed(v => !v)}>
        <div className={styles.headerLeft}>
          <Zap size={12} color="#f9e2af" />
          <span className={styles.headerTitle}>Tools</span>
          <span className={styles.headerCount}>{recentCalls.length}</span>
          {runningCount > 0 && (
            <span className={styles.headerRunning}>
              <Loader size={10} className={styles.spin} /> {runningCount}
            </span>
          )}
        </div>
        <span className={styles.headerChevron}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {!collapsed && (
        <div className={styles.list}>
          {recentCalls.map(call => {
            const key = normalizeToolName(call.name)
            const icon = TOOL_ICONS[key] || <Zap size={12} />
            const color = TOOL_COLORS[key] || '#a6adc8'
            const isOpen = expanded.has(call.id)
            const summary = getInputSummary(call.name, call.input)
            const isBash = key === 'bash' || key === 'execute_command'

            return (
              <div key={call.id} className={`${styles.call} ${call.status === 'running' ? styles.callRunning : ''}`}>
                <div
                  className={styles.callHeader}
                  onClick={() => toggleExpanded(call.id)}
                >
                  <span className={styles.callIcon} style={{ color }}>{icon}</span>
                  <span className={styles.callName} style={{ color }}>{call.name}</span>
                  {summary && (
                    <span className={styles.callSummary}>
                      {summary.length > 50 ? summary.slice(0, 50) + '…' : summary}
                    </span>
                  )}
                  <StatusBadge status={call.status} />
                  <span className={styles.expand}>
                    {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </span>
                </div>

                {isOpen && (
                  <div className={styles.callBody}>
                    {/* Input */}
                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>Input</div>
                      {isBash ? (
                        <div className={styles.terminal}>
                          <pre className={styles.terminalText}>
                            $ {String(call.input.command || '')}
                          </pre>
                        </div>
                      ) : (
                        <pre className={styles.code}>
                          {JSON.stringify(call.input, null, 2)}
                        </pre>
                      )}
                    </div>

                    {/* Output */}
                    {call.result && (
                      <div className={styles.section}>
                        <div className={styles.sectionLabel}>Output</div>
                        {isBash ? (
                          <div className={styles.terminal}>
                            <pre className={styles.terminalOutput}>{call.result.slice(0, 1000)}</pre>
                            {call.result.length > 1000 && (
                              <div className={styles.truncated}>… {call.result.length - 1000} more chars</div>
                            )}
                          </div>
                        ) : (
                          <pre className={styles.code}>
                            {call.result.slice(0, 1000)}
                            {call.result.length > 1000 ? '\n…' : ''}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
