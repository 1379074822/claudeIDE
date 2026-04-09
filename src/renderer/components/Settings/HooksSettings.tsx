import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Webhook } from 'lucide-react'
import styles from './Settings.module.css'

const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification',
  'UserPromptSubmit', 'SessionStart', 'SessionEnd', 'Stop', 'StopFailure',
  'SubagentStart', 'SubagentStop', 'PreCompact', 'PostCompact',
  'PermissionRequest', 'PermissionDenied', 'Setup', 'TaskCreated', 'TaskCompleted',
]

const HOOK_TYPES = ['command', 'prompt', 'http', 'agent'] as const
type HookType = typeof HOOK_TYPES[number]

type HookEntry = {
  type: HookType
  command?: string
  prompt?: string
  url?: string
  model?: string
  if?: string
  timeout?: number
  async?: boolean
}

type HooksConfig = Record<string, Array<{ matcher?: string; hooks: HookEntry[] }>>

const BADGE_CLASS: Record<HookType, string> = {
  command: styles.badgeCommand,
  prompt: styles.badgePrompt,
  http: styles.badgeHttp,
  agent: styles.badgeAgent,
}

function getHookSummary(hook: HookEntry): string {
  switch (hook.type) {
    case 'command': return hook.command || '(no command)'
    case 'prompt': return (hook.prompt || '').slice(0, 50)
    case 'http': return hook.url || '(no url)'
    case 'agent': return (hook.prompt || '').slice(0, 50)
    default: return ''
  }
}

export default function HooksSettings() {
  const [scope, setScope] = useState<'global' | 'project'>('global')
  const [hooks, setHooks] = useState<HooksConfig>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add form state
  const [formEvent, setFormEvent] = useState(HOOK_EVENTS[0])
  const [formType, setFormType] = useState<HookType>('command')
  const [formCommand, setFormCommand] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formIf, setFormIf] = useState('')
  const [formAsync, setFormAsync] = useState(false)

  const loadHooks = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.config) return
    setLoading(true)
    const result = await api.config.readHooks({ scope })
    if (result.success) {
      setHooks(result.data || {})
    }
    setLoading(false)
  }, [scope])

  useEffect(() => { loadHooks() }, [loadHooks])

  const saveHooks = async (newHooks: HooksConfig) => {
    const api = (window as any).electronAPI
    if (!api?.config) return
    await api.config.writeHooks({ scope, hooks: newHooks })
    setHooks(newHooks)
  }

  const handleAdd = async () => {
    const hook: HookEntry = { type: formType }
    if (formType === 'command') {
      if (!formCommand.trim()) return
      hook.command = formCommand
      if (formIf) hook.if = formIf
      if (formAsync) hook.async = true
    } else if (formType === 'prompt' || formType === 'agent') {
      if (!formPrompt.trim()) return
      hook.prompt = formPrompt
      if (formModel) hook.model = formModel
    } else if (formType === 'http') {
      if (!formUrl.trim()) return
      hook.url = formUrl
    }

    const newHooks = { ...hooks }
    if (!newHooks[formEvent]) {
      newHooks[formEvent] = [{ hooks: [] }]
    }
    newHooks[formEvent][0].hooks.push(hook)
    await saveHooks(newHooks)
    resetForm()
  }

  const handleDelete = async (event: string, matcherIdx: number, hookIdx: number) => {
    const newHooks = { ...hooks }
    if (newHooks[event]?.[matcherIdx]) {
      newHooks[event][matcherIdx].hooks.splice(hookIdx, 1)
      if (newHooks[event][matcherIdx].hooks.length === 0) {
        newHooks[event].splice(matcherIdx, 1)
      }
      if (newHooks[event].length === 0) {
        delete newHooks[event]
      }
    }
    await saveHooks(newHooks)
  }

  const resetForm = () => {
    setShowAddForm(false)
    setFormCommand('')
    setFormPrompt('')
    setFormUrl('')
    setFormModel('')
    setFormIf('')
    setFormAsync(false)
  }

  // Count total hooks
  const totalHooks = Object.values(hooks).reduce(
    (sum, matchers) => sum + matchers.reduce((s, m) => s + m.hooks.length, 0), 0
  )

  return (
    <>
      {/* Scope switch */}
      <div className={styles.scopeSwitch}>
        <button className={`${styles.scopeBtn} ${scope === 'global' ? styles.scopeBtnActive : ''}`}
          onClick={() => setScope('global')}>Global</button>
        <button className={`${styles.scopeBtn} ${scope === 'project' ? styles.scopeBtnActive : ''}`}
          onClick={() => setScope('project')}>Project</button>
      </div>

      {/* Header */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Webhook size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Hooks ({totalHooks})
          </div>
          <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} />
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className={styles.addForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Event</label>
              <select className={styles.select} value={formEvent} onChange={e => setFormEvent(e.target.value)}>
                {HOOK_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Type</label>
              <select className={styles.select} value={formType} onChange={e => setFormType(e.target.value as HookType)}>
                {HOOK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {formType === 'command' && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Command</label>
                  <input className={styles.input} value={formCommand} onChange={e => setFormCommand(e.target.value)}
                    placeholder="e.g. npm test" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>If (optional condition)</label>
                  <input className={styles.input} value={formIf} onChange={e => setFormIf(e.target.value)}
                    placeholder='e.g. Bash(git *)' />
                </div>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={formAsync} onChange={e => setFormAsync(e.target.checked)} />
                  Async (run in background)
                </label>
              </>
            )}

            {(formType === 'prompt' || formType === 'agent') && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Prompt</label>
                  <textarea className={styles.textarea} value={formPrompt} onChange={e => setFormPrompt(e.target.value)}
                    placeholder="Describe what to verify..." rows={3} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Model (optional)</label>
                  <input className={styles.input} value={formModel} onChange={e => setFormModel(e.target.value)}
                    placeholder="e.g. claude-sonnet-4-6" />
                </div>
              </>
            )}

            {formType === 'http' && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>URL</label>
                <input className={styles.input} value={formUrl} onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://..." />
              </div>
            )}

            <button className={styles.saveBtn} onClick={handleAdd}>
              <Check size={14} /> Add Hook
            </button>
          </div>
        )}

        {/* Hook list by event */}
        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : totalHooks === 0 ? (
          <div className={styles.empty}>
            <Webhook size={24} />
            <div>No hooks configured</div>
            <div style={{ fontSize: 11 }}>Hooks run automatically on events like tool calls, session start, etc.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(hooks).map(([event, matchers]) => (
              <div key={event}>
                <div style={{ fontSize: 11, color: '#6c7086', marginBottom: 4, fontWeight: 600 }}>{event}</div>
                {matchers.map((matcher, mi) =>
                  matcher.hooks.map((hook, hi) => (
                    <div key={`${mi}-${hi}`} className={styles.card} style={{ marginBottom: 3 }}>
                      <div className={styles.cardInfo}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className={`${styles.badge} ${BADGE_CLASS[hook.type]}`}>{hook.type}</span>
                          <span className={styles.cardName}>{getHookSummary(hook)}</span>
                        </div>
                        {matcher.matcher && <div className={styles.cardDesc}>matcher: {matcher.matcher}</div>}
                      </div>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(event, mi, hi)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
