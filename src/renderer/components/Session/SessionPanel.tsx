import { useState, useEffect, useCallback } from 'react'
import { History, Play, Trash2, RefreshCw, Clock, FolderOpen } from 'lucide-react'
import { useSessionStore, type SessionEntry } from '../../store'
import { serverClient } from '../../utils/serverClient'
import styles from './Session.module.css'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

function shortenPath(p: string, maxLen = 30): string {
  const normalized = p.replace(/\\/g, '/')
  if (normalized.length <= maxLen) return normalized
  const parts = normalized.split('/')
  if (parts.length <= 2) return '...' + normalized.slice(-maxLen)
  return '.../' + parts.slice(-2).join('/')
}

export default function SessionPanel() {
  const { sessions, setSessions } = useSessionStore()
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    await serverClient.listSessions()
    setLoading(false)
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleResume = async (session: SessionEntry) => {
    setResuming(session.sessionId)
    try {
      await serverClient.resumeSession(session.sessionId, session.cwd)
    } finally {
      setResuming(null)
    }
  }

  const handleDelete = async (sessionKey: string) => {
    const api = (window as any).electronAPI
    if (!api?.session) return
    await api.session.delete(sessionKey)
    setSessions(sessions.filter(s => s.key !== sessionKey))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <History size={14} />
        <span className={styles.headerTitle}>Sessions</span>
        <button className={styles.refreshBtn} onClick={loadSessions} title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>
            <Clock size={20} />
            <span>Loading sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className={styles.empty}>
            <History size={24} />
            <span>No sessions found</span>
            <span className={styles.emptyHint}>
              Sessions are created when using Claude server mode
            </span>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.key} className={styles.card}>
              <div className={styles.cardInfo}>
                <div className={styles.cardTop}>
                  <span className={styles.cardId}>
                    {session.sessionId.slice(0, 8)}...
                  </span>
                  <span className={styles.cardTime}>
                    {formatTime(session.lastActiveAt)}
                  </span>
                </div>
                <div className={styles.cardPath}>
                  <FolderOpen size={10} />
                  <span>{shortenPath(session.cwd)}</span>
                </div>
                {session.permissionMode && (
                  <div className={styles.cardMode}>{session.permissionMode}</div>
                )}
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.resumeBtn}
                  onClick={() => handleResume(session)}
                  disabled={resuming === session.sessionId}
                  title="Resume session"
                >
                  <Play size={12} />
                </button>
                <button
                  className={styles.deleteSessionBtn}
                  onClick={() => handleDelete(session.key)}
                  title="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
