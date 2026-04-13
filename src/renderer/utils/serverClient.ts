/**
 * ServerClient - WebSocket-based communication with claude --server
 *
 * Primary communication mode: IPC → Main Process → WebSocket → claude server
 * Falls back to direct API mode (claudeClient.ts) when server is unavailable.
 *
 * Protocol reference: open-claude-code/src/server/directConnectManager.ts
 */

import { useChatStore } from '../store/chatStore'
import { useToolStore } from '../store/toolStore'
import { useSessionStore } from '../store/sessionStore'
import { usePermissionStore } from '../store/permissionStore'

const generateId = () => Math.random().toString(36).slice(2) + Date.now()

// ============================================================
// SDK Message Types (from Claude Code protocol)
// ============================================================

type SDKMessageType =
  | 'assistant'     // Assistant text/tool_use content blocks
  | 'result'        // Tool result
  | 'system'        // System message
  | 'progress'      // Progress update
  | 'error'         // Error
  | 'user'          // User message echo

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

type SDKMessage = {
  type: SDKMessageType
  subtype?: string
  message?: {
    role: string
    content: string | ContentBlock[]
    stop_reason?: string
    model?: string
    usage?: { input_tokens: number; output_tokens: number }
  }
  tool_use_id?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  result?: string
  error?: string
  session_id?: string
  [key: string]: unknown
}

// ============================================================
// ServerClient Class
// ============================================================

export class ServerClient {
  private cleanupFns: Array<() => void> = []
  private _isInitialized = false

  /**
   * Initialize: start server, create session, listen for events
   */
  async initialize(workDir?: string): Promise<{ success: boolean; error?: string }> {
    const api = (window as any).electronAPI
    if (!api?.server) {
      return { success: false, error: 'Electron API not available' }
    }

    const sessionStore = useSessionStore.getState()

    // Start the claude server
    sessionStore.setServerStatus('starting')
    const startResult = await api.server.start({ workDir })

    if (!startResult.success) {
      sessionStore.setServerStatus('error')
      return { success: false, error: startResult.error || 'Failed to start server' }
    }

    sessionStore.setServerStatus('running')
    sessionStore.setServerPort(startResult.port)

    // Set up event listeners
    this._setupEventListeners(api)

    // Create a session
    const sessionResult = await api.server.createSession({ cwd: workDir })

    if (!sessionResult.success) {
      return { success: false, error: sessionResult.error || 'Failed to create session' }
    }

    sessionStore.setCurrentSessionId(sessionResult.sessionId)
    sessionStore.setConnectionMode('server')
    sessionStore.setConnected(true)

    this._isInitialized = true
    return { success: true }
  }

  /**
   * Send a message to the claude server
   */
  async sendMessage(text: string, images: string[] = []): Promise<boolean> {
    const api = (window as any).electronAPI
    if (!api?.server) return false

    const chatStore = useChatStore.getState()

    // Build content blocks
    const contentBlocks: unknown[] = []
    for (const dataUrl of images) {
      const [header, base64] = dataUrl.split(',')
      const mediaType = (header.match(/:(.*?);/)?.[1] || 'image/png') as string
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      })
    }
    if (text.trim()) {
      contentBlocks.push({ type: 'text', text })
    }

    // Add user message to UI
    chatStore.addMessage({
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      images: images.length ? images : undefined,
    })

    // Create a placeholder assistant message for streaming
    const assistantMsgId = generateId()
    chatStore.addMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    })
    chatStore.setStreaming(true, assistantMsgId)

    // Send via server
    const content = contentBlocks.length === 1 && images.length === 0 ? text : contentBlocks
    const result = await api.server.sendMessage(content)

    if (!result.success) {
      chatStore.updateMessage(assistantMsgId, {
        content: 'Failed to send message to server',
        isStreaming: false,
      })
      chatStore.setStreaming(false)
      return false
    }

    return true
  }

  /**
   * Interrupt the current request
   */
  async interrupt(): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.server) return
    await api.server.interrupt()
    useChatStore.getState().setStreaming(false)
  }

  /**
   * Respond to a permission request
   */
  async respondPermission(
    requestId: string,
    behavior: 'allow' | 'deny',
    opts?: { updatedInput?: unknown; message?: string }
  ): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.server) return

    const result = {
      behavior,
      ...(behavior === 'allow' && opts?.updatedInput ? { updatedInput: opts.updatedInput } : {}),
      ...(behavior === 'deny' ? { message: opts?.message || 'Denied by user' } : {}),
    }

    await api.server.respondPermission(requestId, result)
    usePermissionStore.getState().setPendingRequest(null)
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
    const api = (window as any).electronAPI
    if (!api?.server) return { success: false, error: 'API not available' }

    const result = await api.session.resume({ sessionId, cwd })
    if (result.success) {
      useSessionStore.getState().setCurrentSessionId(result.sessionId)
    }
    return result
  }

  /**
   * List available sessions
   */
  async listSessions(): Promise<any[]> {
    const api = (window as any).electronAPI
    if (!api?.session) return []

    const result = await api.session.list()
    if (result.success) {
      useSessionStore.getState().setSessions(result.sessions)
      return result.sessions
    }
    return []
  }

  /**
   * Disconnect and clean up
   */
  async disconnect(): Promise<void> {
    const api = (window as any).electronAPI
    if (api?.server) {
      await api.server.disconnectSession()
    }

    // Clean up listeners
    for (const cleanup of this.cleanupFns) {
      cleanup()
    }
    this.cleanupFns = []

    const sessionStore = useSessionStore.getState()
    sessionStore.setConnected(false)
    sessionStore.setCurrentSessionId(null)
    sessionStore.setConnectionMode('disconnected')

    this._isInitialized = false
  }

  /**
   * Stop the server entirely
   */
  async stopServer(): Promise<void> {
    await this.disconnect()
    const api = (window as any).electronAPI
    if (api?.server) {
      await api.server.stop()
    }
    useSessionStore.getState().setServerStatus('stopped')
  }

  get isInitialized(): boolean {
    return this._isInitialized
  }

  get isConnected(): boolean {
    return useSessionStore.getState().isConnected
  }

  // ============================================================
  // Private: Event Listener Setup
  // ============================================================

  private _setupEventListeners(api: any) {
    // Clean up any existing listeners
    for (const cleanup of this.cleanupFns) cleanup()
    this.cleanupFns = []

    // Server messages (SDK protocol)
    this.cleanupFns.push(
      api.server.onMessage((msg: SDKMessage) => this._handleServerMessage(msg))
    )

    // Permission requests
    this.cleanupFns.push(
      api.server.onPermissionRequest((req: any) => {
        const permStore = usePermissionStore.getState()
        const mode = permStore.mode

        // Auto-allow in bypass mode
        if (mode === 'bypassPermissions') {
          this.respondPermission(req.requestId, 'allow')
          return
        }

        // Show permission dialog
        permStore.setPendingRequest({
          requestId: req.requestId,
          toolName: req.toolName,
          toolInput: req.toolInput || {},
          description: req.description,
        })
      })
    )

    // Connection events
    this.cleanupFns.push(
      api.server.onConnected(() => {
        useSessionStore.getState().setConnected(true)
      })
    )

    this.cleanupFns.push(
      api.server.onDisconnected(() => {
        useSessionStore.getState().setConnected(false)
        useChatStore.getState().setStreaming(false)
      })
    )

    // Server status changes
    this.cleanupFns.push(
      api.server.onStatusChange((status: any) => {
        useSessionStore.getState().setServerStatus(status.status)
      })
    )
  }

  // ============================================================
  // Private: Message Handling
  // ============================================================

  private _handleServerMessage(msg: SDKMessage) {
    const chatStore = useChatStore.getState()
    const toolStore = useToolStore.getState()

    switch (msg.type) {
      case 'assistant': {
        this._handleAssistantMessage(msg, chatStore, toolStore)
        break
      }

      case 'result': {
        // Tool execution result
        if (msg.tool_use_id) {
          toolStore.updateToolCall(msg.tool_use_id, {
            status: 'done',
            result: typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result),
          })
        }
        break
      }

      case 'system': {
        if (msg.subtype === 'init') {
          // Session initialized
          chatStore.addMessage({
            id: generateId(),
            role: 'system',
            content: 'Connected to Claude server',
            timestamp: Date.now(),
          })
        }
        break
      }

      case 'error': {
        const activeTab = chatStore.getActiveTab()
        const streamingId = activeTab?.streamingMessageId
        if (streamingId) {
          chatStore.updateMessage(streamingId, {
            content: (activeTab?.messages.find(m => m.id === streamingId)?.content ?? '') +
              `\n\nError: ${msg.error || 'Unknown error'}`,
            isStreaming: false,
          })
        } else {
          chatStore.addMessage({
            id: generateId(),
            role: 'system',
            content: `Error: ${msg.error || 'Unknown error'}`,
            timestamp: Date.now(),
          })
        }
        chatStore.setStreaming(false)
        break
      }

      default:
        // Log unhandled message types for debugging
        console.log('[ServerClient] Unhandled message type:', msg.type, msg)
    }
  }

  private _handleAssistantMessage(
    msg: SDKMessage,
    chatStore: ReturnType<typeof useChatStore.getState>,
    toolStore: ReturnType<typeof useToolStore.getState>,
  ) {
    const message = msg.message
    if (!message) return

    const content = message.content

    // If it's a string, simple text message
    if (typeof content === 'string') {
      const streamingId = chatStore.getActiveTab()?.streamingMessageId
      if (streamingId) {
        // Show content immediately as it arrives
        chatStore.updateMessage(streamingId, {
          content: content,
          isStreaming: !message.stop_reason,
        })
      } else {
        chatStore.addMessage({
          id: generateId(),
          role: 'assistant',
          content: content,
          timestamp: Date.now(),
          isStreaming: !message.stop_reason,
        })
      }

      if (message.stop_reason) {
        chatStore.setStreaming(false)
      }
      return
    }

    // Content blocks array
    if (Array.isArray(content)) {
      let textContent = ''
      const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

      for (const block of content as ContentBlock[]) {
        if (block.type === 'text') {
          textContent += block.text
        } else if (block.type === 'tool_use') {
          toolUses.push({ id: block.id, name: block.name, input: block.input })
        }
      }

      // Register tool calls
      for (const tu of toolUses) {
        toolStore.addToolCall({
          id: tu.id,
          name: tu.name,
          input: tu.input,
          status: 'running',
          timestamp: Date.now(),
        })

        chatStore.addMessage({
          id: generateId(),
          role: 'tool',
          content: '',
          timestamp: Date.now(),
          toolName: tu.name,
          toolInput: JSON.stringify(tu.input, null, 2),
        })
      }

      // Show text immediately
      const streamingId = chatStore.getActiveTab()?.streamingMessageId
      if (streamingId && textContent) {
        const isDone = message.stop_reason === 'end_turn' && toolUses.length === 0
        chatStore.updateMessage(streamingId, {
          content: textContent,
          isStreaming: !isDone,
        })
        if (isDone) {
          chatStore.setStreaming(false)
        }
      } else if (message.stop_reason === 'end_turn' && toolUses.length === 0) {
        chatStore.setStreaming(false)
      }
    }
  }
}

// Singleton
export const serverClient = new ServerClient()
