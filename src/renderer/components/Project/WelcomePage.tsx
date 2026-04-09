import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, Clock, Bot, Trash2, Plus, FileText, Terminal, MessageSquare } from 'lucide-react'
import { useFileStore, useProjectStore, type RecentProject } from '../../store'
import { useT } from '../../store'
import styles from './WelcomePage.module.css'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffHr / 24)

  if (diffHr < 1) return 'just now'
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export default function WelcomePage({ onOpenFolder }: { onOpenFolder: () => void }) {
  const { setRootPath } = useFileStore()
  const { recentProjects, setRecentProjects, removeRecentProject } = useProjectStore()
  const [loading, setLoading] = useState(true)
  const t = useT()

  const loadProjects = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.config) { setLoading(false); return }
    const result = await api.config.readRecentProjects()
    if (result.success && Array.isArray(result.data)) {
      setRecentProjects(result.data)
    }
    setLoading(false)
  }, [setRecentProjects])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleOpenProject = (path: string) => {
    setRootPath(path)
  }

  const handleRemoveProject = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    const api = (window as any).electronAPI
    if (api?.config) {
      await api.config.removeRecentProject(path)
    }
    removeRecentProject(path)
  }

  return (
    <div className={styles.welcome}>
      {/* Logo area */}
      <div className={styles.hero}>
        <Bot size={48} color="#cba6f7" />
        <h1 className={styles.title}>Claude IDE</h1>
        <p className={styles.subtitle}>{t.welcomeSubtitle}</p>
      </div>

      {/* Quick actions */}
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onOpenFolder}>
          <FolderOpen size={18} />
          <span>{t.openFolderBtn}</span>
        </button>
      </div>

      {/* Recent projects */}
      <div className={styles.recentSection}>
        <div className={styles.recentHeader}>
          <Clock size={14} />
          <span>{t.recentProjects}</span>
        </div>

        {loading ? (
          <div className={styles.recentEmpty}>{t.loading}</div>
        ) : recentProjects.length === 0 ? (
          <div className={styles.recentEmpty}>
            {t.noRecentProjects}
          </div>
        ) : (
          <div className={styles.recentList}>
            {recentProjects.map(project => (
              <div
                key={project.path}
                className={styles.recentItem}
                onClick={() => handleOpenProject(project.path)}
              >
                <FolderOpen size={14} className={styles.recentIcon} />
                <div className={styles.recentInfo}>
                  <div className={styles.recentName}>{project.name}</div>
                  <div className={styles.recentPath}>{project.path}</div>
                </div>
                <div className={styles.recentMeta}>
                  <span className={styles.recentTime}>{formatTime(project.lastOpened)}</span>
                  <button
                    className={styles.recentRemove}
                    onClick={(e) => handleRemoveProject(e, project.path)}
                    title="Remove from list"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <div className={styles.tip}>
          <MessageSquare size={12} />
          <span>{t.tipChat}</span>
        </div>
        <div className={styles.tip}>
          <Terminal size={12} />
          <span>{t.tipTerminal}</span>
        </div>
        <div className={styles.tip}>
          <FileText size={12} />
          <span>{t.tipClaudeMd}</span>
        </div>
      </div>
    </div>
  )
}
