import { Bot, Server, Wifi, WifiOff, Shield, GitBranch } from 'lucide-react'
import { useSessionStore, useModelStore, usePermissionStore, useT } from '../../store'
import styles from './StatusBar.module.css'

export default function StatusBar() {
  const { connectionMode, serverStatus, isConnected } = useSessionStore()
  const { getActiveModel } = useModelStore()
  const { mode } = usePermissionStore()
  const t = useT()

  const activeModel = getActiveModel()

  const getConnectionInfo = () => {
    if (connectionMode === 'server') {
      return {
        icon: <Server size={11} />,
        label: isConnected ? t.server : serverStatus === 'starting' ? t.starting : t.disconnected,
        color: isConnected ? 'var(--success)' : serverStatus === 'starting' ? 'var(--warning)' : 'var(--text-disabled)',
      }
    }
    return {
      icon: <Wifi size={11} />,
      label: t.api,
      color: 'var(--info)',
    }
  }

  const conn = getConnectionInfo()

  const permissionLabels: Record<string, string> = {
    default: t.permAsk,
    acceptEdits: t.permEdits,
    plan: t.permPlan,
    bypassPermissions: t.permBypass,
    dontAsk: t.permAuto,
  }

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        {/* Connection */}
        <div className={styles.item} style={{ color: conn.color }}>
          {conn.icon}
          <span>{conn.label}</span>
        </div>

        {/* Model */}
        {activeModel && (
          <div className={styles.item}>
            <Bot size={11} />
            <span>{activeModel.name}</span>
          </div>
        )}
      </div>

      <div className={styles.right}>
        {/* Permission mode */}
        <div className={styles.item}>
          <Shield size={11} />
          <span>{permissionLabels[mode] || mode}</span>
        </div>
      </div>
    </div>
  )
}
