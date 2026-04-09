import { useState } from 'react'
import GeneralSettings from './GeneralSettings'
import HooksSettings from './HooksSettings'
import McpSettings from './McpSettings'
import ClaudeMdEditor from './ClaudeMdEditor'
import { useT } from '../../store'
import styles from './Settings.module.css'

type TabId = 'general' | 'hooks' | 'mcp' | 'claudemd' | 'permissions'

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const t = useT()

  const TABS: { id: TabId; label: string }[] = [
    { id: 'general', label: t.settingsGeneral },
    { id: 'hooks', label: t.settingsHooks },
    { id: 'mcp', label: t.settingsMcp },
    { id: 'claudemd', label: t.settingsClaudeMd },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'hooks' && <HooksSettings />}
        {activeTab === 'mcp' && <McpSettings />}
        {activeTab === 'claudemd' && <ClaudeMdEditor />}
      </div>
    </div>
  )
}
