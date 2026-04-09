import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Server } from 'lucide-react'
import styles from './Settings.module.css'

type McpServerType = 'stdio' | 'sse' | 'http'

type McpServer = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  type?: McpServerType
}

type McpConfig = { mcpServers?: Record<string, McpServer> }

function detectType(server: McpServer): McpServerType {
  if (server.command) return 'stdio'
  if (server.url?.includes('sse')) return 'sse'
  if (server.url) return 'http'
  return 'stdio'
}

const TYPE_BADGE: Record<McpServerType, string> = {
  stdio: styles.badgeStdio,
  sse: styles.badgeSse,
  http: styles.badgeHttp,
}

export default function McpSettings() {
  const [scope, setScope] = useState<'global' | 'project'>('global')
  const [servers, setServers] = useState<Record<string, McpServer>>({})
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<McpServerType>('stdio')
  const [formCommand, setFormCommand] = useState('')
  const [formArgs, setFormArgs] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formEnv, setFormEnv] = useState('')

  const loadConfig = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.config) return
    setLoading(true)
    const result = await api.config.readMcpConfig({ scope })
    if (result.success) {
      setServers(result.data?.mcpServers || {})
    }
    setLoading(false)
  }, [scope])

  useEffect(() => { loadConfig() }, [loadConfig])

  const saveServers = async (newServers: Record<string, McpServer>) => {
    const api = (window as any).electronAPI
    if (!api?.config) return
    await api.config.writeMcpConfig({ scope, data: { mcpServers: newServers } })
    setServers(newServers)
  }

  const handleAdd = async () => {
    if (!formName.trim()) return
    const server: McpServer = {}

    if (formType === 'stdio') {
      if (!formCommand.trim()) return
      server.command = formCommand
      if (formArgs.trim()) server.args = formArgs.split(',').map(a => a.trim()).filter(Boolean)
      if (formEnv.trim()) {
        server.env = {}
        for (const line of formEnv.split('\n')) {
          const [k, ...v] = line.split('=')
          if (k?.trim()) server.env[k.trim()] = v.join('=').trim()
        }
      }
    } else {
      if (!formUrl.trim()) return
      server.url = formUrl
    }

    const newServers = { ...servers, [formName]: server }
    await saveServers(newServers)
    resetForm()
  }

  const handleDelete = async (name: string) => {
    const newServers = { ...servers }
    delete newServers[name]
    await saveServers(newServers)
  }

  const resetForm = () => {
    setShowAddForm(false)
    setFormName('')
    setFormCommand('')
    setFormArgs('')
    setFormUrl('')
    setFormEnv('')
  }

  const serverEntries = Object.entries(servers)

  return (
    <>
      {/* Scope switch */}
      <div className={styles.scopeSwitch}>
        <button className={`${styles.scopeBtn} ${scope === 'global' ? styles.scopeBtnActive : ''}`}
          onClick={() => setScope('global')}>Global</button>
        <button className={`${styles.scopeBtn} ${scope === 'project' ? styles.scopeBtnActive : ''}`}
          onClick={() => setScope('project')}>Project</button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Server size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            MCP Servers ({serverEntries.length})
          </div>
          <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} />
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className={styles.addForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Server Name</label>
              <input className={styles.input} value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="e.g. my-mcp-server" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Type</label>
              <select className={styles.select} value={formType} onChange={e => setFormType(e.target.value as McpServerType)}>
                <option value="stdio">stdio (command)</option>
                <option value="sse">SSE (url)</option>
                <option value="http">HTTP (url)</option>
              </select>
            </div>

            {formType === 'stdio' ? (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Command</label>
                  <input className={styles.input} value={formCommand} onChange={e => setFormCommand(e.target.value)}
                    placeholder="e.g. npx -y @modelcontextprotocol/server-filesystem" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Args (comma separated)</label>
                  <input className={styles.input} value={formArgs} onChange={e => setFormArgs(e.target.value)}
                    placeholder="e.g. /home/user/docs, --verbose" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Env (KEY=VALUE per line)</label>
                  <textarea className={styles.textarea} value={formEnv} onChange={e => setFormEnv(e.target.value)}
                    placeholder={"API_KEY=xxx\nDEBUG=true"} rows={2} />
                </div>
              </>
            ) : (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>URL</label>
                <input className={styles.input} value={formUrl} onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://..." />
              </div>
            )}

            <button className={styles.saveBtn} onClick={handleAdd}>
              <Check size={14} /> Add Server
            </button>
          </div>
        )}

        {/* Server list */}
        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : serverEntries.length === 0 ? (
          <div className={styles.empty}>
            <Server size={24} />
            <div>No MCP servers configured</div>
            <div style={{ fontSize: 11 }}>MCP servers extend Claude with custom tools and resources.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {serverEntries.map(([name, server]) => {
              const type = detectType(server)
              return (
                <div key={name} className={styles.card}>
                  <div className={styles.cardInfo}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={styles.cardName}>{name}</span>
                      <span className={`${styles.badge} ${TYPE_BADGE[type]}`}>{type}</span>
                    </div>
                    <div className={styles.cardDetail}>
                      {server.command || server.url || '(empty)'}
                    </div>
                    {server.args && server.args.length > 0 && (
                      <div className={styles.cardDesc}>args: {server.args.join(', ')}</div>
                    )}
                  </div>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(name)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
