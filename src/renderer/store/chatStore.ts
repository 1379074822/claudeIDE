import { create } from 'zustand'

export type InlineToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  result?: string
  timestamp: number
}

export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'tool_calls'; calls: InlineToolCall[] }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  sessionId?: string
  toolName?: string
  toolInput?: string
  toolResult?: string
  isStreaming?: boolean
  fileDiffs?: FileDiff[]
  images?: string[]
  /** Ordered content segments for assistant messages (text + tool calls interleaved) */
  segments?: ContentSegment[]
}

export type FileDiff = {
  filePath: string
  oldContent: string
  newContent: string
  type: 'create' | 'edit' | 'delete'
}

export type ChatTab = {
  id: string
  title: string
  messages: ChatMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  /** API conversation history, kept per-tab */
  conversationHistory: Array<{ role: string; content: unknown }>
}

const MAX_MESSAGES = 500

let tabCounter = 1

function createTab(title?: string): ChatTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: title || `Chat ${tabCounter++}`,
    messages: [],
    isStreaming: false,
    streamingMessageId: null,
    conversationHistory: [],
  }
}

type ChatStore = {
  tabs: ChatTab[]
  activeTabId: string

  // Tab management
  createTab: (title?: string) => string   // returns new tab id
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void

  // Active-tab message operations
  addMessage: (msg: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  /** Set/replace the last text segment content (used for streaming) */
  setLastTextSegment: (msgId: string, text: string) => void
  /** Push a new text segment (for new turn after tools) */
  pushTextSegment: (msgId: string, text: string) => void
  /** Push a new tool_calls segment (batch of tool calls for this turn) */
  pushToolCallsSegment: (msgId: string, calls: InlineToolCall[]) => void
  /** Update a specific tool call inside any segment */
  updateToolCallInSegment: (msgId: string, toolCallId: string, updates: Partial<InlineToolCall>) => void
  setStreaming: (streaming: boolean, msgId?: string | null) => void

  // Conversation history (per-tab, used by claudeClient)
  pushHistory: (tabId: string, entry: { role: string; content: unknown }) => void
  clearHistory: (tabId: string) => void

  // Getters
  getActiveTab: () => ChatTab | undefined
  getTab: (tabId: string) => ChatTab | undefined
}

const initialTab = createTab('Chat 1')
tabCounter = 2   // next new tab will be "Chat 2"

export const useChatStore = create<ChatStore>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  // ── Tab management ─────────────────────────────────────────
  createTab: (title) => {
    const tab = createTab(title)
    set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    return tab.id
  },

  closeTab: (tabId) => set(state => {
    if (state.tabs.length <= 1) return state  // keep at least one tab
    const newTabs = state.tabs.filter(t => t.id !== tabId)
    const newActiveId = state.activeTabId === tabId
      ? newTabs[newTabs.length - 1]!.id
      : state.activeTabId
    return { tabs: newTabs, activeTabId: newActiveId }
  }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  renameTab: (tabId, title) => set(state => ({
    tabs: state.tabs.map(t => t.id === tabId ? { ...t, title } : t),
  })),

  // ── Message operations (operate on active tab) ─────────────
  addMessage: (msg) => set(state => ({
    tabs: state.tabs.map(t => {
      if (t.id !== state.activeTabId) return t
      const msgs = [...t.messages, msg]
      return { ...t, messages: msgs.length > MAX_MESSAGES ? msgs.slice(-MAX_MESSAGES) : msgs }
    }),
  })),

  updateMessage: (id, updates) => set(state => ({
    tabs: state.tabs.map(t => {
      if (t.id !== state.activeTabId) return t
      return { ...t, messages: t.messages.map(m => m.id === id ? { ...m, ...updates } : m) }
    }),
  })),

  setLastTextSegment: (msgId, text) => set(state => ({
    tabs: state.tabs.map(t => {
      if (t.id !== state.activeTabId) return t
      return {
        ...t,
        messages: t.messages.map(m => {
          if (m.id !== msgId) return m
          const segs = [...(m.segments || [])]
          const last = segs[segs.length - 1]
          if (last && last.type === 'text') {
            segs[segs.length - 1] = { type: 'text', text }
          } else {
            segs.push({ type: 'text', text })
          }
          return { ...m, segments: segs }
        }),
      }
    }),
  })),

  pushTextSegment: (msgId, text) => set(state => ({
    tabs: state.tabs.map(t => {
      if (t.id !== state.activeTabId) return t
      return {
        ...t,
        messages: t.messages.map(m => {
          if (m.id !== msgId) return m
          const segs = [...(m.segments || []), { type: 'text' as const, text }]
          return { ...m, segments: segs }
        }),
      }
    }),
  })),

  pushToolCallsSegment: (msgId, calls) => set(state => ({
    tabs: state.tabs.map(t => {
      if (t.id !== state.activeTabId) return t
      return {
        ...t,
        messages: t.messages.map(m => {
          if (m.id !== msgId) return m
          const segs = [...(m.segments || [])]
          segs.push({ type: 'tool_calls', calls })
          return { ...m, segments: segs }
        }),
      }
    }),
  })),

  updateToolCallInSegment: (msgId, toolCallId, updates) => set(state => ({
    tabs: state.tabs.map(t => {
      if (t.id !== state.activeTabId) return t
      return {
        ...t,
        messages: t.messages.map(m => {
          if (m.id !== msgId) return m
          return {
            ...m,
            segments: (m.segments || []).map(seg => {
              if (seg.type !== 'tool_calls') return seg
              return {
                ...seg,
                calls: seg.calls.map(tc =>
                  tc.id === toolCallId ? { ...tc, ...updates } : tc
                ),
              }
            }),
          }
        }),
      }
    }),
  })),

  setStreaming: (streaming, msgId = null) => set(state => ({
    tabs: state.tabs.map(t =>
      t.id === state.activeTabId
        ? { ...t, isStreaming: streaming, streamingMessageId: msgId }
        : t
    ),
  })),

  // ── Conversation history ───────────────────────────────────
  pushHistory: (tabId, entry) => set(state => ({
    tabs: state.tabs.map(t =>
      t.id === tabId
        ? { ...t, conversationHistory: [...t.conversationHistory, entry] }
        : t
    ),
  })),

  clearHistory: (tabId) => set(state => ({
    tabs: state.tabs.map(t =>
      t.id === tabId ? { ...t, conversationHistory: [] } : t
    ),
  })),

  // ── Getters ────────────────────────────────────────────────
  getActiveTab: () => {
    const s = get()
    return s.tabs.find(t => t.id === s.activeTabId)
  },

  getTab: (tabId) => get().tabs.find(t => t.id === tabId),
}))
