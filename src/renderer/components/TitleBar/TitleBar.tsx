import { useState, useEffect } from 'react'
import { Minus, Square, X, Bot, FolderOpen, Server, Wifi } from 'lucide-react'
import { useFileStore, useSessionStore, useModelStore, useT } from '../../store'
import { getAPI } from '../../utils/electronAPI'
import styles from './TitleBar.module.css'

interface TitleBarProps {
  onOpenFolder: () => void
}

export default function TitleBar({ onOpenFolder }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const { rootPath } = useFileStore()
  const { connectionMode, serverStatus, isConnected: serverConnected } = useSessionStore()
  const { defaultApiKey, getActiveModel } = useModelStore()
  const t = useT()

  const activeModel = getActiveModel()
  const apiKeyAvailable = !!(defaultApiKey || activeModel?.apiKey)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return
    api.window.isMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = () => (window as any).electronAPI?.window.minimize()
  const handleMaximize = async () => {
    await (window as any).electronAPI?.window.maximize()
    const api = (window as any).electronAPI
    if (api) setIsMaximized(await api.window.isMaximized())
  }
  const handleClose = () => (window as any).electronAPI?.window.close()

  const projectName = rootPath
    ? rootPath.replace(/\\/g, '/').split('/').pop() || rootPath
    : t.noProject

  const modelName = activeModel?.name || t.noModel

  // Connection status
  const getStatusInfo = () => {
    if (connectionMode === 'server') {
      return {
        color: serverConnected ? '#a6e3a1' : serverStatus === 'starting' ? '#f9e2af' : '#585b70',
        text: serverConnected ? `${t.server} | ${modelName}` : serverStatus === 'starting' ? t.starting : t.serverOff,
        icon: <Server size={10} />,
      }
    }
    return {
      color: apiKeyAvailable ? '#a6e3a1' : '#585b70',
      text: apiKeyAvailable ? `${t.api} | ${modelName}` : t.noApiKey,
      icon: <Wifi size={10} />,
    }
  }

  const status = getStatusInfo()

  return (
    <div className={styles.titleBar}>
      <div className={styles.drag}>
        <div className={styles.left}>
          <button className={styles.iconBtn} onClick={onOpenFolder} title={t.openFolder}>
            <FolderOpen size={14} />
          </button>
          <span className={styles.projectName}>{projectName}</span>
        </div>

        <div className={styles.center}>
          <Bot size={14} color="#cba6f7" />
          <span className={styles.title}>Claude IDE</span>
        </div>

        <div className={styles.right}>
          <div className={styles.serverStatus}>
            <span
              className={styles.statusDot}
              style={{ background: status.color }}
            />
            <span className={styles.statusText}>{status.text}</span>
          </div>

          <div className={styles.windowControls}>
            <button className={`${styles.winBtn} ${styles.minimize}`} onClick={handleMinimize}>
              <Minus size={10} />
            </button>
            <button className={`${styles.winBtn} ${styles.maximize}`} onClick={handleMaximize}>
              <Square size={10} />
            </button>
            <button className={`${styles.winBtn} ${styles.close}`} onClick={handleClose}>
              <X size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
