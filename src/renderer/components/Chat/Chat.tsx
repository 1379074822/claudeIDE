import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Bot, ImagePlus, X as XIcon, ChevronDown, Wifi, WifiOff, Server, Plus } from 'lucide-react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useChatStore, useModelStore, useSessionStore, usePermissionStore, useToolStore, useFileStore, useUIStore, useT, type ChatMessage } from '../../store'
import { claudeClient } from '../../utils/claudeClient'
import { serverClient } from '../../utils/serverClient'
import { getLanguageFromPath } from '../../utils/fileUtils'
import Message from '../Message/Message'
import styles from './Chat.module.css'

// ============================================================
// Mode definitions
// ============================================================

type Mode = 'ask' | 'edit' | 'plan'

const MODE_SYSTEM_PROMPTS: Record<Mode, string> = {
  ask: 'You are a helpful coding assistant. Answer questions about the code. Do NOT modify files unless explicitly asked.',
  edit: 'You are a coding assistant. You can read and modify files to help the user.',
  plan: 'You are a coding assistant in PLAN mode. First create a detailed plan of what you would do, then ask for confirmation before executing.',
}

// ============================================================
// Permission Dialog
// ============================================================

const HIGH_RISK_TOOLS = ['bash', 'execute_command', 'write_file', 'edit_file', 'file_write', 'file_edit', 'powershell']
const LOW_RISK_TOOLS = ['read_file', 'file_read', 'glob', 'grep', 'list_files', 'web_search', 'web_fetch']

function getRiskLevel(toolName: string): 'high' | 'low' | 'medium' {
  const name = toolName.toLowerCase()
  if (HIGH_RISK_TOOLS.some(t => name.includes(t))) return 'high'
  if (LOW_RISK_TOOLS.some(t => name.includes(t))) return 'low'
  return 'medium'
}

const RISK_COLORS = { high: '#f38ba8', medium: '#f9e2af', low: '#89b4fa' }

function PermissionDialog() {
  const { pendingRequest } = usePermissionStore()
  const t = useT()

  if (!pendingRequest) return null

  const risk = getRiskLevel(pendingRequest.toolName)
  const RISK_LABELS = { high: t.highRisk, medium: t.mediumRisk, low: t.lowRisk }

  const handleAllow = () => {
    serverClient.respondPermission(pendingRequest.requestId, 'allow')
  }

  const handleDeny = () => {
    serverClient.respondPermission(pendingRequest.requestId, 'deny', {
      message: 'Denied by user',
    })
  }

  return (
    <div className={styles.permissionOverlay}>
      <div className={styles.permissionDialog} style={{ borderColor: RISK_COLORS[risk] }}>
        <div className={styles.permissionHeader}>
          <div className={styles.permissionTitle}>{t.permissionRequest}</div>
          <span className={styles.permissionRisk} style={{ color: RISK_COLORS[risk], borderColor: RISK_COLORS[risk] }}>
            {RISK_LABELS[risk]}
          </span>
        </div>
        <div className={styles.permissionTool}>
          <strong>{pendingRequest.toolName}</strong>
        </div>
        {pendingRequest.description && (
          <div className={styles.permissionDesc}>{pendingRequest.description}</div>
        )}
        <pre className={styles.permissionInput}>
          {JSON.stringify(pendingRequest.toolInput, null, 2).slice(0, 500)}
        </pre>
        <div className={styles.permissionActions}>
          <button className={styles.permissionDeny} onClick={handleDeny}>{t.deny}</button>
          <button className={styles.permissionAllow} onClick={handleAllow}>{t.allow}</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Model Picker Dropdown
// ============================================================

function ModelPicker({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const { models } = useModelStore()
  return (
    <div className={styles.modelPickerDropdown}>
      {models.map(m => (
        <button
          key={m.id}
          className={`${styles.modelPickerItem} ${activeId === m.id ? styles.modelPickerActive : ''}`}
          onClick={() => onSelect(m.id)}
        >
          <span className={styles.modelPickerName}>{m.name}</span>
          <span className={styles.modelPickerDesc}>{m.description || m.modelId}</span>
        </button>
      ))}
    </div>
  )
}

// ============================================================
// Main Chat Component
// ============================================================

export default function Chat() {
  const { rootPath } = useFileStore()
  const t = useT()

  // Mode labels derived from translations
  const MODE_LABELS: Record<Mode, string> = {
    ask: t.modeAsk,
    edit: t.modeEdit,
    plan: t.modePlan,
  }

  // Mode persisted per project
  const modeKey = `claude_mode_${rootPath || 'global'}`
  const [mode, setModeState] = useState<Mode>(
    () => (localStorage.getItem(modeKey) as Mode) || 'ask'
  )
  const setMode = (m: Mode) => {
    localStorage.setItem(modeKey, m)
    setModeState(m)
  }

  // Sync mode when project changes
  useEffect(() => {
    const saved = localStorage.getItem(`claude_mode_${rootPath || 'global'}`) as Mode
    setModeState(saved || 'ask')
  }, [rootPath])

  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const editorBoxRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const insertRefChipRef = useRef<((path: string, lines?: string) => void) | null>(null)

  // Multi-tab store
  const { tabs, activeTabId, createTab, closeTab, setActiveTab } = useChatStore()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const messages = activeTab?.messages ?? []
  const isStreaming = activeTab?.isStreaming ?? false

  const { clearToolCalls } = useToolStore()
  const { models, defaultApiKey, defaultBaseURL, activeModelId, setActiveModel, getActiveModel } = useModelStore()
  const { connectionMode, serverStatus, isConnected: serverConnected } = useSessionStore()

  const activeModel = getActiveModel()
  const apiKeyAvailable = !!(defaultApiKey || activeModel?.apiKey)

  // Determine if we have any connection available
  const isReady = connectionMode === 'server' ? serverConnected : apiKeyAvailable

  // Init client from active model config (for API fallback mode)
  useEffect(() => {
    if (activeModel && connectionMode !== 'server') {
      const apiKey = activeModel.apiKey || defaultApiKey
      const baseURL = activeModel.baseURL || defaultBaseURL
      if (apiKey) {
        claudeClient.setConfig(apiKey, baseURL, activeModel.modelId)
      }
    }
  }, [activeModelId, defaultApiKey, defaultBaseURL, connectionMode])

  // When FileTree sets pendingFileRef, insert it as a ref chip in the input
  const pendingFileRef = useUIStore(s => s.pendingFileRef)
  const setPendingFileRef = useUIStore(s => s.setPendingFileRef)
  useEffect(() => {
    if (!pendingFileRef) return
    setPendingFileRef(null)
    // insertRefChip is defined below but hoisted into this effect via closure at render time
    // We use a ref to avoid stale closure issues
    insertRefChipRef.current?.(pendingFileRef)
  }, [pendingFileRef, setPendingFileRef])

  // Auto-scroll to bottom when new messages arrive (handled by Virtuoso followOutput)
  useEffect(() => {
    if (isStreaming) return
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    const handler = () => {
      setShowModeMenu(false)
      setShowModelPicker(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // ── contentEditable helpers ──

  // Extract serialized text from the editable div.
  // Chip elements become @path or @path:lines, everything else is plain text.
  const getEditorText = useCallback((): string => {
    const el = editorBoxRef.current
    if (!el) return ''
    let text = ''
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ''
      } else if (node instanceof HTMLElement && node.dataset.refPath) {
        const p = node.dataset.refPath
        const l = node.dataset.refLines
        text += `@${p}${l ? ':' + l : ''}`
      } else if (node instanceof HTMLElement && node.tagName === 'BR') {
        text += '\n'
      } else {
        text += node.textContent || ''
      }
    })
    return text
  }, [])

  const isEditorEmpty = useCallback((): boolean => {
    const el = editorBoxRef.current
    if (!el) return true
    return el.childNodes.length === 0 ||
      (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE && !el.textContent?.trim())
  }, [])

  // Insert a ref chip at current cursor position
  const insertRefChip = useCallback((path: string, lines?: string) => {
    const el = editorBoxRef.current
    if (!el) return

    const name = path.replace(/\\/g, '/').split('/').pop() || path
    const label = lines ? `${name}:${lines}` : name

    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.className = styles.inlineChip
    chip.dataset.refPath = path
    if (lines) chip.dataset.refLines = lines
    chip.title = lines ? `${path}:${lines}` : path
    // Icon + label only; close ✕ is rendered via CSS ::after
    chip.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><span>${label}</span>`

    el.focus()
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(chip)
      range.setStartAfter(chip)
      range.setEndAfter(chip)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      el.appendChild(chip)
    }
    // Trailing space for continued typing
    const space = document.createTextNode('\u00A0')
    chip.after(space)
    const r = document.createRange()
    r.setStartAfter(space)
    r.setEndAfter(space)
    sel?.removeAllRanges()
    sel?.addRange(r)

    setInput(getEditorText())
  }, [getEditorText])

  // Keep ref in sync so the pendingFileRef effect (defined earlier) can call it
  insertRefChipRef.current = insertRefChip

  // Event delegation on editorBox: handle chip click (close region vs open file)
  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Walk up to find the chip element
    const chip = target.closest('[data-ref-path]') as HTMLElement | null
    if (!chip) return

    // Determine if click was on the right 20px (the ✕ close zone)
    const rect = chip.getBoundingClientRect()
    const clickX = e.clientX
    if (clickX >= rect.right - 20) {
      // Remove chip and trailing space
      const next = chip.nextSibling
      if (next?.nodeType === Node.TEXT_NODE && next.textContent === '\u00A0') next.remove()
      chip.remove()
      setInput(getEditorText())
      return
    }

    // Otherwise open the file
    const path = chip.dataset.refPath!
    const lines = chip.dataset.refLines
    const existing = useFileStore.getState().openFiles.find(f => f.path === path)
    if (existing) {
      useFileStore.getState().setActiveFile(path)
    } else {
      const api = (window as any).electronAPI
      if (!api) return
      api.fs.readFile(path).then((result: any) => {
        if (!result?.success) return
        const name = path.replace(/\\/g, '/').split('/').pop() || path
        useFileStore.getState().openFile({
          path, name,
          content: result.content,
          language: getLanguageFromPath(name),
          modified: false,
          originalContent: result.content,
        })
      })
    }
    if (lines) {
      const startLine = parseInt(lines.split('-')[0], 10)
      if (!isNaN(startLine)) {
        setTimeout(() => {
          import('monaco-editor').then(monaco => {
            const eds = monaco.editor.getEditors()
            if (eds.length === 0) return
            const ed = eds[eds.length - 1]
            ed.revealLineInCenter(startLine)
            ed.setPosition({ lineNumber: startLine, column: 1 })
            ed.focus()
          })
        }, 200)
      }
    }
  }, [getEditorText])

  const handleEditorInput = useCallback(() => {
    setInput(getEditorText())
  }, [getEditorText])
  // Image helpers
  const addImageFromFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      if (dataUrl) setPendingImages(prev => [...prev, dataUrl])
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)

    // 1. Images
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length > 0) {
      e.preventDefault()
      imageItems.forEach(item => {
        const file = item.getAsFile()
        if (file) addImageFromFile(file)
      })
      return
    }

    // 2. Editor copy context match → insert chip
    const pastedText = e.clipboardData.getData('text/plain')
    const copyCtx = useUIStore.getState().lastCopyContext
    if (copyCtx && pastedText) {
      const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim()
      if (normalize(copyCtx.text) === normalize(pastedText) && Date.now() - copyCtx.timestamp < 60000) {
        e.preventDefault()
        insertRefChip(copyCtx.filePath, `${copyCtx.startLine}-${copyCtx.endLine}`)
        useUIStore.getState().setLastCopyContext(null)
        return
      }
    }

    // 3. Plain text → insert as plain text (strip formatting from contentEditable)
    if (pastedText) {
      e.preventDefault()
      document.execCommand('insertText', false, pastedText)
    }
  }, [addImageFromFile, insertRefChip])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const fileTreePath = e.dataTransfer.getData('text/x-claude-file-path')
    if (fileTreePath) {
      insertRefChip(fileTreePath)
      return
    }

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        addImageFromFile(file)
        continue
      }
      const filePath = (file as any).path as string | undefined
      if (filePath) insertRefChip(filePath)
    }
  }, [addImageFromFile, insertRefChip])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only leave when actually leaving the chat container (not children)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }, [])

  const removeImage = (idx: number) =>
    setPendingImages(prev => prev.filter((_, i) => i !== idx))

  const handleSend = useCallback(async () => {
    const finalText = getEditorText().trim()
    if ((!finalText && pendingImages.length === 0) || isStreaming) return

    if (!isReady) {
      useChatStore.getState().addMessage({
        id: Math.random().toString(36).slice(2),
        role: 'system',
        content: connectionMode === 'server'
          ? t.notConnected
          : t.setApiKey,
        timestamp: Date.now(),
      })
      return
    }

    const imgs = [...pendingImages]
    // Clear editor
    if (editorBoxRef.current) editorBoxRef.current.innerHTML = ''
    setInput('')
    setPendingImages([])
    editorBoxRef.current?.focus()

    // Auto-name tab with first user message
    const store = useChatStore.getState()
    const currentTab = store.tabs.find(t => t.id === store.activeTabId)
    const isFirstMessage = currentTab && currentTab.messages.filter(m => m.role === 'user').length === 0
    if (isFirstMessage && finalText) {
      const title = finalText.slice(0, 20) + (finalText.length > 20 ? '…' : '')
      store.renameTab(store.activeTabId, title)
    }

    try {
      if (connectionMode === 'server') {
        await serverClient.sendMessage(finalText, imgs)
      } else {
        const m = getActiveModel()
        if (m) {
          const apiKey = m.apiKey || defaultApiKey
          const baseURL = m.baseURL || defaultBaseURL
          claudeClient.setConfig(apiKey, baseURL, m.modelId)
        }
        await claudeClient.sendMessage(finalText, imgs, MODE_SYSTEM_PROMPTS[mode])
      }
    } catch (err: any) {
      useChatStore.getState().addMessage({
        id: Math.random().toString(36).slice(2),
        role: 'system',
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      })
    }
  }, [input, pendingImages, isStreaming, isReady, mode, connectionMode, defaultApiKey, defaultBaseURL, getEditorText])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInterrupt = () => {
    if (connectionMode === 'server') {
      serverClient.interrupt()
    } else {
      claudeClient.interrupt()
    }
  }

  const handleNewTab = () => {
    createTab()
  }

  const handleModelSelect = (id: string) => {
    setActiveModel(id)
    setShowModelPicker(false)
  }

  // Connection status indicator
  const getStatusInfo = () => {
    if (connectionMode === 'server') {
      return {
        color: serverConnected ? '#a6e3a1' : '#f9e2af',
        label: serverConnected ? t.server : t.connecting,
        icon: serverConnected ? <Server size={10} /> : <WifiOff size={10} />,
      }
    }
    return {
      color: apiKeyAvailable ? '#a6e3a1' : '#585b70',
      label: apiKeyAvailable ? t.api : t.noApiKey,
      icon: apiKeyAvailable ? <Wifi size={10} /> : <WifiOff size={10} />,
    }
  }

  const status = getStatusInfo()

  return (
    <div
      className={`${styles.chat} ${dragOver ? styles.chatDragOver : ''}`}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Permission Dialog */}
      <PermissionDialog />

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabList}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.tabTitle}>{tab.title}</span>
              {tab.isStreaming && <span className={styles.tabDot} />}
              {tabs.length > 1 && (
                <button
                  className={styles.tabClose}
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                >
                  <XIcon size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button className={styles.tabNew} onClick={handleNewTab} title={t.newChat}>
          <Plus size={13} />
        </button>
      </div>

      {/* Status strip */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Bot size={14} color="#cba6f7" />
          <div className={styles.statusPill}>
            <span className={styles.statusDot} style={{ background: status.color }} />
            <span className={styles.statusLabel}>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyChat}>
            <Bot size={32} color="#313244" />
            <p>{isReady ? t.askClaude : t.configureConnection}</p>
            {isReady && (
              <div className={styles.suggestions}>
                {[t.explainFile, t.findBugs, t.addTypes, t.writeTests].map(s => (
                  <button key={s} className={styles.suggestion} onClick={() => {
                    if (editorBoxRef.current) editorBoxRef.current.textContent = s
                    setInput(s)
                  }}>{s}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            itemContent={(_, msg) => <Message key={msg.id} msg={msg} />}
            followOutput="smooth"
            style={{ flex: 1 }}
          />
        )}
      </div>

      {/* Image previews */}
      {pendingImages.length > 0 && (
        <div className={styles.imagePreviewBar}>
          {pendingImages.map((src, i) => (
            <div key={i} className={styles.imagePreviewItem}>
              <img src={src} alt="" className={styles.imagePreviewThumb} />
              <button className={styles.imageRemoveBtn} onClick={() => removeImage(i)}>
                <XIcon size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <div
            ref={editorBoxRef}
            className={styles.editorBox}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={handleEditorClick}
            data-placeholder={isReady ? t.askPlaceholder : t.configureFirst}
          />

          {/* Bottom toolbar */}
          <div className={styles.inputToolbar}>
            {/* Left: Mode selector */}
            <div className={styles.toolbarLeft}>
              <div className={styles.modeMenuWrapper} onClick={e => e.stopPropagation()}>
                <button
                  className={styles.modeBtn}
                  onClick={() => { setShowModeMenu(v => !v); setShowModelPicker(false) }}
                  title={t.switchMode}
                >
                  {MODE_LABELS[mode]}
                  <ChevronDown size={10} />
                </button>
                {showModeMenu && (
                  <div className={styles.modeDropdown}>
                    {(['ask', 'edit', 'plan'] as Mode[]).map(m => (
                      <button
                        key={m}
                        className={`${styles.modeDropdownItem} ${mode === m ? styles.modeDropdownActive : ''}`}
                        onClick={() => { setMode(m); setShowModeMenu(false) }}
                      >
                        <span className={styles.modeDropdownLabel}>{MODE_LABELS[m]}</span>
                        <span className={styles.modeDropdownDesc}>
                          {m === 'ask' ? t.modeAskDesc : m === 'edit' ? t.modeEditDesc : t.modePlanDesc}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Center: Model name */}
            <div className={styles.toolbarCenter}>
              <div className={styles.modelMenuWrapper} onClick={e => e.stopPropagation()}>
                <button
                  className={styles.modelPill}
                  onClick={() => { setShowModelPicker(v => !v); setShowModeMenu(false) }}
                  title={t.switchModel}
                >
                  {activeModel?.name || 'No model'}
                  <ChevronDown size={10} />
                </button>
                {showModelPicker && (
                  <ModelPicker activeId={activeModelId} onSelect={handleModelSelect} />
                )}
              </div>
            </div>

            {/* Right: Image upload + Send/Stop */}
            <div className={styles.toolbarRight}>
              <button
                className={styles.imageBtn}
                onClick={() => fileInputRef.current?.click()}
                title={t.attachImage}
              >
                <ImagePlus size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => Array.from(e.target.files || []).forEach(addImageFromFile)}
              />
              {isStreaming ? (
                <button className={`${styles.sendBtn} ${styles.stopBtn}`} onClick={handleInterrupt}>
                  <Square size={14} />
                </button>
              ) : (
                <button
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={(!input.trim() && pendingImages.length === 0) || !isReady}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
