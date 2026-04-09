import { useState, useEffect, useCallback } from 'react'
import { Save, Check, FileText } from 'lucide-react'
import MonacoEditor from '@monaco-editor/react'
import { useFileStore } from '../../store'
import styles from './Settings.module.css'

export default function ClaudeMdEditor() {
  const [scope, setScope] = useState<'global' | 'project'>('global')
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const { rootPath } = useFileStore()

  const hasChanges = content !== savedContent

  const loadContent = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.config) return
    setLoading(true)
    const result = await api.config.readClaudeMd({
      scope,
      projectRoot: scope === 'project' ? rootPath : undefined,
    })
    if (result.success) {
      setContent(result.data || '')
      setSavedContent(result.data || '')
    }
    setSaved(false)
    setLoading(false)
  }, [scope, rootPath])

  useEffect(() => { loadContent() }, [loadContent])

  const handleSave = async () => {
    const api = (window as any).electronAPI
    if (!api?.config) return
    await api.config.writeClaudeMd({
      scope,
      projectRoot: scope === 'project' ? rootPath : undefined,
      content,
    })
    setSavedContent(content)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      {/* Scope switch */}
      <div className={styles.scopeSwitch}>
        <button className={`${styles.scopeBtn} ${scope === 'global' ? styles.scopeBtnActive : ''}`}
          onClick={() => setScope('global')}>Global</button>
        <button className={`${styles.scopeBtn} ${scope === 'project' ? styles.scopeBtnActive : ''}`}
          onClick={() => setScope('project')} disabled={!rootPath}>
          Project {!rootPath && '(no project)'}
        </button>
      </div>

      <div className={styles.section} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <FileText size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {scope === 'global' ? '~/.claude/CLAUDE.md' : 'CLAUDE.md'}
          </div>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!hasChanges}
            style={{ padding: '4px 10px', marginTop: 0 }}
          >
            {saved ? <Check size={12} /> : <Save size={12} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : (
          <div className={styles.editorWrapper}>
            <MonacoEditor
              height="300px"
              language="markdown"
              theme="vs-dark"
              value={content}
              onChange={v => setContent(v || '')}
              options={{
                minimap: { enabled: false },
                lineNumbers: 'off',
                wordWrap: 'on',
                fontSize: 12.5,
                fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                scrollBeyondLastLine: false,
                padding: { top: 8, bottom: 8 },
                renderLineHighlight: 'none',
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollbar: { verticalScrollbarSize: 6 },
              }}
            />
          </div>
        )}

        <div className={styles.editorFooter}>
          <span>{content.length} chars</span>
          {hasChanges && <span style={{ color: '#f9e2af' }}>Unsaved changes</span>}
          {saved && <span className={styles.savedIndicator}>Saved</span>}
        </div>
      </div>
    </>
  )
}
