import { memo, useMemo, useState } from 'react'
import { Bot, Terminal, FileEdit, Search, Globe, Zap, ChevronDown, ChevronRight, CheckCircle, Loader, FilePlus, FileX } from 'lucide-react'
import type { ChatMessage, ContentSegment, InlineToolCall } from '../../store'
import { useFileStore } from '../../store'
import Markdown from '../Markdown/Markdown'
import DiffViewer from '../DiffViewer/DiffViewer'
import styles from './Message.module.css'

// ── Tool Meta ────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  execute_command: { icon: <Terminal size={11} />, color: '#f9e2af', label: 'Bash' },
  bash:           { icon: <Terminal size={11} />, color: '#f9e2af', label: 'Bash' },
  read_file:      { icon: <FileEdit size={11} />, color: '#89b4fa', label: 'Read' },
  write_file:     { icon: <FilePlus size={11} />, color: '#a6e3a1', label: 'Write' },
  edit_file:      { icon: <FileEdit size={11} />, color: '#a6e3a1', label: 'Edit' },
  list_files:     { icon: <Search size={11} />,   color: '#cba6f7', label: 'List' },
  glob:           { icon: <Search size={11} />,   color: '#cba6f7', label: 'Glob' },
  grep:           { icon: <Search size={11} />,   color: '#cba6f7', label: 'Grep' },
  web_search:     { icon: <Globe size={11} />,    color: '#fab387', label: 'Search' },
  fetch_url:      { icon: <Globe size={11} />,    color: '#fab387', label: 'Fetch' },
}

function getToolMeta(name: string) {
  const key = name.toLowerCase().replace(/tool$/, '')
  return TOOL_META[key] || { icon: <Zap size={11} />, color: '#a6adc8', label: name }
}

function getInputSummary(input: Record<string, unknown>): string {
  return (input.command || input.path || input.file_path || input.pattern || input.query || input.url || '') as string
}

// ── Inline Tool Call Card ────────────────────────────────────

function InlineToolCallCard({ tc }: { tc: InlineToolCall }) {
  // Auto-collapse completed tool calls
  const [expanded, setExpanded] = useState(tc.status === 'running')
  const meta = getToolMeta(tc.name)
  const summary = getInputSummary(tc.input)
  const pendingDiffs = useFileStore(s => s.pendingDiffs)
  const acceptPendingDiff = useFileStore(s => s.acceptPendingDiff)
  const rejectPendingDiff = useFileStore(s => s.rejectPendingDiff)

  // Collapse when done
  if (!expanded && tc.status === 'running') {
    setExpanded(true)
  }

  const isFileTool = tc.name === 'write_file' || tc.name === 'edit_file'
  const filePath = tc.input.path as string | undefined
  const pendingDiff = isFileTool && filePath
    ? pendingDiffs.find(d => d.filePath.endsWith(filePath.replace(/\\/g, '/')) || d.filePath === filePath)
    : undefined

  return (
    <div className={styles.inlineTool}>
      <div className={styles.inlineToolHeader} onClick={() => setExpanded(v => !v)}>
        <span className={styles.inlineToolIcon} style={{ color: meta.color }}>{meta.icon}</span>
        <span className={styles.inlineToolName} style={{ color: meta.color }}>{meta.label}</span>
        {summary && (
          <span className={styles.inlineToolSummary}>
            {summary.length > 50 ? summary.slice(0, 50) + '…' : summary}
          </span>
        )}
        <span className={styles.inlineToolStatus}>
          {tc.status === 'running'
            ? <Loader size={10} className={styles.spin} />
            : <CheckCircle size={10} color="#a6e3a1" />}
        </span>
        <span className={styles.inlineToolExpand}>
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
      </div>
      {expanded && (
        <div className={styles.inlineToolBody}>
          {isFileTool && pendingDiff ? (
            <div>
              <DiffViewer diff={pendingDiff} />
              {tc.status === 'done' && (
                <div className={styles.diffActions}>
                  <button
                    className={styles.diffAcceptBtn}
                    onClick={() => acceptPendingDiff(pendingDiff.filePath)}
                  >Keep</button>
                  <button
                    className={styles.diffRejectBtn}
                    onClick={() => rejectPendingDiff(pendingDiff.filePath)}
                  >Undo</button>
                </div>
              )}
            </div>
          ) : meta.label === 'Bash' ? (
            <pre className={styles.inlineTerminal}>$ {tc.input.command as string || ''}</pre>
          ) : (
            <pre className={styles.inlineToolCode}>{JSON.stringify(tc.input, null, 2)}</pre>
          )}
          {tc.result && !isFileTool && (
            <pre className={styles.inlineToolResult}>
              {tc.result.length > 500 ? tc.result.slice(0, 500) + '…' : tc.result}
            </pre>
          )}
          {tc.result && isFileTool && (
            <div className={styles.inlineToolResultSmall}>{tc.result}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tool Calls Group (collapsible) ───────────────────────────

function ToolCallsGroup({ calls }: { calls: InlineToolCall[] }) {
  const allDone = calls.every(c => c.status === 'done' || c.status === 'error')
  const [collapsed, setCollapsed] = useState(false)

  // Auto-collapse once all done
  if (allDone && !collapsed && calls.length > 2) {
    // Don't auto-collapse immediately; let user see briefly
  }

  return (
    <div className={styles.toolCallsGroup}>
      <div className={styles.toolCallsHeader} onClick={() => setCollapsed(v => !v)}>
        <span className={styles.toolCallsLabel}>
          {allDone ? <CheckCircle size={10} color="#a6e3a1" /> : <Loader size={10} className={styles.spin} />}
          <span>{calls.length} tool {calls.length === 1 ? 'call' : 'calls'}</span>
        </span>
        <span className={styles.inlineToolExpand}>
          {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
        </span>
      </div>
      {!collapsed && (
        <div className={styles.inlineToolList}>
          {calls.map(tc => <InlineToolCallCard key={tc.id} tc={tc} />)}
        </div>
      )}
    </div>
  )
}

// ── Segment Renderer ─────────────────────────────────────────

function SegmentContent({ segment }: { segment: ContentSegment }) {
  if (segment.type === 'text') {
    if (!segment.text.trim()) return null
    return <Markdown content={segment.text} />
  }
  if (segment.type === 'tool_calls') {
    return <ToolCallsGroup calls={segment.calls} />
  }
  return null
}

// ── Assistant Message ────────────────────────────────────────

function AssistantMessage({ msg }: { msg: ChatMessage }) {
  const segments = msg.segments || []
  const hasSegments = segments.length > 0

  // Fallback: if no segments, render content directly (backward compat)
  const fallbackMarkdown = useMemo(
    () => (!hasSegments && msg.content) ? <Markdown content={msg.content} /> : null,
    [msg.content, hasSegments]
  )

  return (
    <div className={`${styles.message} ${styles.assistant}`}>
      <div className={styles.avatarAssistant}>
        <Bot size={13} />
      </div>
      <div className={styles.body}>
        <div className={styles.assistantContent}>
          {hasSegments
            ? segments.map((seg, i) => <SegmentContent key={i} segment={seg} />)
            : fallbackMarkdown
          }

          {msg.fileDiffs?.map((diff, i) => (
            <DiffViewer key={i} diff={diff} />
          ))}

          {msg.isStreaming && <span className={styles.cursor} />}
        </div>
      </div>
    </div>
  )
}

export default memo(AssistantMessage)
