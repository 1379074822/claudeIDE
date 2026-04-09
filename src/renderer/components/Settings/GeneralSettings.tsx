import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Check, Shield, Palette, Languages, Server, Wifi } from 'lucide-react'
import { useModelStore, usePermissionStore, useSessionStore, useUIStore, useLocaleStore, useT, type ModelProfile, type PermissionMode } from '../../store'
import { serverClient } from '../../utils/serverClient'
import { useFileStore } from '../../store'
import { THEMES, type ThemeId } from '../../themes'
import styles from './Settings.module.css'

export default function GeneralSettings() {
  const t = useT()
  const { models, defaultApiKey, defaultBaseURL, addModel, removeModel, setDefaultApiKey, setDefaultBaseURL } = useModelStore()
  const { mode, setMode } = usePermissionStore()
  const { connectionMode, serverStatus, setConnectionMode } = useSessionStore()
  const { rootPath } = useFileStore()
  const { theme, setTheme } = useUIStore()
  const { locale, setLocale } = useLocaleStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(defaultApiKey)

  // Sync draft when store loads the encrypted key asynchronously
  useEffect(() => {
    setApiKeyDraft(defaultApiKey)
  }, [defaultApiKey])
  const [formData, setFormData] = useState({
    name: '', modelId: '', apiKey: '', baseURL: '', description: '',
  })

  const handleSwitchMode = useCallback(async (target: 'server' | 'api') => {
    if (target === connectionMode || switching) return
    setSwitching(true)

    if (target === 'server') {
      // Disconnect API, start server
      await serverClient.disconnect()
      const result = await serverClient.initialize(rootPath || undefined)
      if (result.success) {
        setConnectionMode('server')
      } else {
        // Failed — stay on API
        setConnectionMode('api')
      }
    } else {
      // Disconnect server, switch to API
      await serverClient.disconnect()
      setConnectionMode('api')
    }

    setSwitching(false)
  }, [connectionMode, switching, rootPath, setConnectionMode])

  const PERMISSION_MODES: { mode: PermissionMode; label: string; desc: string }[] = [
    { mode: 'default', label: t.permDefaultLabel, desc: t.permDefaultDesc },
    { mode: 'acceptEdits', label: t.permAcceptEditsLabel, desc: t.permAcceptEditsDesc },
    { mode: 'plan', label: t.permPlanLabel, desc: t.permPlanDesc },
    { mode: 'bypassPermissions', label: t.permBypassLabel, desc: t.permBypassDesc },
    { mode: 'dontAsk', label: t.permDontAskLabel, desc: t.permDontAskDesc },
  ]

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.modelId.trim()) return
    const newModel: ModelProfile = {
      id: Date.now().toString(),
      name: formData.name,
      modelId: formData.modelId,
      apiKey: formData.apiKey || undefined,
      baseURL: formData.baseURL || undefined,
      description: formData.description || undefined,
    }
    addModel(newModel)
    setFormData({ name: '', modelId: '', apiKey: '', baseURL: '', description: '' })
    setShowAddForm(false)
  }

  return (
    <>
      {/* Connection Mode */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Server size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {t.connModeTitle}
        </div>
        <div className={styles.radioGroup}>
          {([
            { id: 'server' as const, label: t.connServer, desc: t.connServerDesc, icon: <Server size={12} /> },
            { id: 'api' as const, label: t.connApi, desc: t.connApiDesc, icon: <Wifi size={12} /> },
          ]).map(opt => (
            <div
              key={opt.id}
              className={`${styles.radioItem} ${connectionMode === opt.id ? styles.radioItemActive : ''}`}
              onClick={() => handleSwitchMode(opt.id)}
              style={{ opacity: switching ? 0.6 : 1, pointerEvents: switching ? 'none' : 'auto' }}
            >
              <input type="radio" checked={connectionMode === opt.id} onChange={() => handleSwitchMode(opt.id)} style={{ accentColor: '#cba6f7' }} />
              <div>
                <div className={styles.radioLabel}>{opt.label}</div>
                <div className={styles.radioDesc}>
                  {switching && connectionMode !== opt.id ? t.connSwitching : opt.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Languages size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {t.settingsLanguage}
        </div>
        <div className={styles.radioGroup}>
          {([['zh', t.languageZh], ['en', t.languageEn]] as const).map(([lang, label]) => (
            <div
              key={lang}
              className={`${styles.radioItem} ${locale === lang ? styles.radioItemActive : ''}`}
              onClick={() => setLocale(lang)}
            >
              <input type="radio" checked={locale === lang} onChange={() => setLocale(lang)} style={{ accentColor: '#cba6f7' }} />
              <div>
                <div className={styles.radioLabel}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Palette size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {t.settingsTheme}
        </div>
        <div className={styles.radioGroup}>
          {THEMES.map(th => (
            <div
              key={th.id}
              className={`${styles.radioItem} ${theme === th.id ? styles.radioItemActive : ''}`}
              onClick={() => setTheme(th.id)}
            >
              <input type="radio" checked={theme === th.id} onChange={() => setTheme(th.id)} style={{ accentColor: '#cba6f7' }} />
              <div>
                <div className={styles.radioLabel}>{th.name}</div>
                <div className={styles.radioDesc}>{th.type === 'dark' ? t.darkTheme : t.lightTheme}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Configuration */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t.settingsApiConfig}</div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t.settingsApiKey}</label>
          <input
            type="password"
            value={apiKeyDraft}
            onChange={e => setApiKeyDraft(e.target.value)}
            onBlur={() => setDefaultApiKey(apiKeyDraft)}
            className={styles.input}
            placeholder="sk-ant-..."
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t.settingsBaseUrl}</label>
          <input
            type="text"
            value={defaultBaseURL}
            onChange={e => setDefaultBaseURL(e.target.value)}
            className={styles.input}
            placeholder="https://api.anthropic.com"
          />
        </div>
      </div>

      {/* Permission Mode */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Shield size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {t.settingsPermissionMode}
        </div>
        <div className={styles.radioGroup}>
          {PERMISSION_MODES.map(pm => (
            <div
              key={pm.mode}
              className={`${styles.radioItem} ${mode === pm.mode ? styles.radioItemActive : ''}`}
              onClick={() => setMode(pm.mode)}
            >
              <input type="radio" checked={mode === pm.mode} onChange={() => setMode(pm.mode)} style={{ accentColor: '#cba6f7' }} />
              <div>
                <div className={styles.radioLabel}>{pm.label}</div>
                <div className={styles.radioDesc}>{pm.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Models */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>{t.settingsModels}</div>
          <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} />
          </button>
        </div>

        {showAddForm && (
          <div className={styles.addForm}>
            <input type="text" placeholder={t.modelName} value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })} className={styles.input} />
            <input type="text" placeholder={t.modelId} value={formData.modelId}
              onChange={e => setFormData({ ...formData, modelId: e.target.value })} className={styles.input} />
            <input type="password" placeholder={t.apiKeyOptional} value={formData.apiKey}
              onChange={e => setFormData({ ...formData, apiKey: e.target.value })} className={styles.input} />
            <input type="text" placeholder={t.baseUrlOptional} value={formData.baseURL}
              onChange={e => setFormData({ ...formData, baseURL: e.target.value })} className={styles.input} />
            <input type="text" placeholder={t.descriptionOptional} value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })} className={styles.input} />
            <button className={styles.saveBtn} onClick={handleAdd}>
              <Check size={14} /> {t.addModel}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {models.map(m => (
            <div key={m.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <div className={styles.cardName}>{m.name}</div>
                <div className={styles.cardDetail}>{m.modelId}</div>
                {m.description && <div className={styles.cardDesc}>{m.description}</div>}
                {m.apiKey && <div className={styles.modelBadge}>{t.customApi}</div>}
              </div>
              <button className={styles.deleteBtn} onClick={() => removeModel(m.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
