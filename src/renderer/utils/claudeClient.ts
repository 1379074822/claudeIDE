/**
 * ClaudeClient - Direct fetch-based API client
 * Bypasses Anthropic SDK to support custom gateways/proxies without CORS issues
 */

import { useChatStore } from '../store/chatStore'
import { useToolStore } from '../store/toolStore'
import { useFileStore } from '../store/fileStore'
import { CLAUDE_TOOLS } from './tools'

const generateId = () => Math.random().toString(36).slice(2) + Date.now()

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

type StreamEvent = {
  type: string
  index?: number
  delta?: { type: string; text?: string; partial_json?: string }
  content_block?: { type: string; id?: string; name?: string }
  message?: { stop_reason?: string }
}

export class ClaudeClient {
  private apiKey: string = ''
  private baseURL: string = 'https://api.anthropic.com'
  private model: string = 'claude-opus-4-6'
  private abortController: AbortController | null = null
  private currentSystemPrompt: string | undefined = undefined

  setConfig(apiKey: string, baseURL: string, model: string) {
    this.apiKey = apiKey
    this.baseURL = baseURL.replace(/\/$/, '')
    this.model = model
  }

  setApiKey(key: string) {
    this.apiKey = key
  }

  setModel(model: string) {
    this.model = model
  }

  // ── Core IPC-based streaming (routes through Electron main process to avoid CORS) ──
  private async streamViaIPC(
    body: object,
    onEvent: (event: StreamEvent) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.claude?.stream) {
      onError(new Error('Electron IPC not available'))
      return
    }

    // Unique stream ID to prevent IPC event collisions across sequential calls
    const streamId = generateId()

    const headers: Record<string, string> = {
      'anthropic-version': '2023-06-01',
      'x-api-key': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
    }

    const endpoint = `${this.baseURL}/v1/messages`
    const bodyStr = JSON.stringify({ ...body, stream: true })

    let buffer = ''
    let aborted = false

    // Set up abort handling
    this.abortController = new AbortController()
    this.abortController.signal.addEventListener('abort', () => {
      aborted = true
      onDone()
    })

    const parseChunk = (chunk: string) => {
      if (aborted) return
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const evt = JSON.parse(data) as StreamEvent
            onEvent(evt)
          } catch {}
        }
      }
    }

    try {
      const result = await api.claude.stream(
        endpoint,
        headers,
        bodyStr,
        (chunk: string) => parseChunk(chunk),
        () => { if (!aborted) onDone() },
        streamId,
      )

      if (result?.error) {
        // Parse error body for a clean message
        let errMsg = result.error as string
        try {
          // result.error may be "HTTP 4xx: <json body>"
          const jsonStart = errMsg.indexOf('{')
          if (jsonStart !== -1) {
            const parsed = JSON.parse(errMsg.slice(jsonStart))
            errMsg = parsed?.error?.message || parsed?.message || errMsg
          }
        } catch {}
        onError(new Error(errMsg))
      }
    } catch (err: unknown) {
      onError(err as Error)
    }
  }

  // ── Main send ──────────────────────────────────────────────────────────────
  async sendMessage(text: string, images: string[] = [], systemPrompt?: string): Promise<void> {
    if (!this.apiKey) throw new Error('API key not set')

    const chatStore = useChatStore.getState()
    const tabId = chatStore.activeTabId
    const rootPath = useFileStore.getState().rootPath

    // Inject project root into system prompt so AI uses correct paths
    let finalSystemPrompt = systemPrompt || ''
    if (rootPath) {
      const projectContext = `The current project root directory is: ${rootPath}\nWhen using tools like list_files, read_file, etc., use paths relative to this root or the absolute path.`
      finalSystemPrompt = finalSystemPrompt
        ? `${projectContext}\n\n${finalSystemPrompt}`
        : projectContext
    }
    this.currentSystemPrompt = finalSystemPrompt || undefined

    // Build content blocks
    const contentBlocks: unknown[] = []
    for (const dataUrl of images) {
      const [header, base64] = dataUrl.split(',')
      const mediaType = (header.match(/:(.*?);/)?.[1] || 'image/png') as
        'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
    }
    if (text.trim()) contentBlocks.push({ type: 'text', text })

    // Add user message to UI
    chatStore.addMessage({
      id: generateId(), role: 'user', content: text,
      timestamp: Date.now(), images: images.length ? images : undefined,
    })

    // Push to this tab's conversation history
    chatStore.pushHistory(tabId, {
      role: 'user',
      content: contentBlocks.length === 1 && images.length === 0 ? text : contentBlocks,
    })

    // Create ONE assistant message for the entire turn (including tool loops)
    const assistantMsgId = generateId()
    chatStore.addMessage({
      id: assistantMsgId, role: 'assistant', content: '',
      timestamp: Date.now(), isStreaming: true, inlineToolCalls: [],
    })
    chatStore.setStreaming(true, assistantMsgId)

    await this.runTurn(tabId, useToolStore.getState(), assistantMsgId)
  }

  private async runTurn(
    tabId: string,
    toolStore: ReturnType<typeof useToolStore.getState>,
    assistantMsgId: string,
  ): Promise<void> {
    const tab = useChatStore.getState().getTab(tabId)
    if (!tab) return

    const reqBody: Record<string, unknown> = {
      model: this.model,
      max_tokens: 8192,
      messages: tab.conversationHistory,
      tools: CLAUDE_TOOLS,
    }
    if (this.currentSystemPrompt) {
      reqBody.system = this.currentSystemPrompt
    }

    // Each turn starts with fresh text — no reading from prior turns
    let fullText = ''
    const toolUses: Array<{ id: string; name: string; inputJson: string }> = []
    let currentBlockType = ''
    let streamError: Error | null = null

    const syncTextToSegment = () => {
      useChatStore.getState().setLastTextSegment(assistantMsgId, fullText)
    }

    await new Promise<void>((resolve) => {
      this.streamViaIPC(
        reqBody,
        (event) => {
          if (event.type === 'content_block_start') {
            currentBlockType = event.content_block?.type ?? ''
            if (currentBlockType === 'tool_use') {
              // Before adding tool calls, flush any pending text
              syncTextToSegment()

              const tb = event.content_block!
              toolUses.push({ id: tb.id!, name: tb.name!, inputJson: '' })
              toolStore.addToolCall({
                id: tb.id!, name: tb.name!, input: {},
                status: 'running', timestamp: Date.now(),
              })
            }
          } else if (event.type === 'content_block_delta') {
            const delta = event.delta
            if (!delta) return
            if (delta.type === 'text_delta' && delta.text) {
              fullText += delta.text
              syncTextToSegment()
            } else if (delta.type === 'input_json_delta' && delta.partial_json) {
              const tu = toolUses[toolUses.length - 1]
              if (tu) tu.inputJson += delta.partial_json
            }
          } else if (event.type === 'content_block_stop') {
            const tu = toolUses[toolUses.length - 1]
            if (tu && tu.inputJson && currentBlockType === 'tool_use') {
              try {
                const parsed = JSON.parse(tu.inputJson)
                toolStore.updateToolCall(tu.id, { input: parsed })
              } catch {}
            }
          } else if (event.type === 'message_stop') {
            syncTextToSegment()
            resolve()
          }
        },
        () => {
          syncTextToSegment()
          resolve()
        },
        (err) => {
          streamError = err
          resolve()
        },
      )
    })

    if (streamError !== null) {
      const errMsg = (streamError as Error).message
      useChatStore.getState().pushTextSegment(assistantMsgId, `\n\nError: ${errMsg}`)
      useChatStore.getState().updateMessage(assistantMsgId, { isStreaming: false })
      useChatStore.getState().setStreaming(false)
      return
    }

    // Execute tools if any
    if (toolUses.length > 0) {
      // Push tool_calls segment with all tools from this turn
      const toolCallEntries = toolUses.map(tu => {
        let input: Record<string, unknown> = {}
        try { input = JSON.parse(tu.inputJson) } catch {}
        return { id: tu.id, name: tu.name, input, status: 'running' as const, timestamp: Date.now() }
      })
      useChatStore.getState().pushToolCallsSegment(assistantMsgId, toolCallEntries)

      // Add assistant turn to API history
      useChatStore.getState().pushHistory(tabId, {
        role: 'assistant',
        content: [
          ...(fullText ? [{ type: 'text', text: fullText }] : []),
          ...toolUses.map(tu => {
            let input: unknown = {}
            try { input = JSON.parse(tu.inputJson) } catch {}
            return { type: 'tool_use', id: tu.id, name: tu.name, input }
          }),
        ],
      })

      // Execute tools and collect results
      const toolResults: unknown[] = []
      for (const tu of toolUses) {
        let input: Record<string, unknown> = {}
        try { input = JSON.parse(tu.inputJson) } catch {}
        const result = await this.executeTool(tu.name, input)
        useChatStore.getState().updateToolCallInSegment(assistantMsgId, tu.id, { status: 'done', result })
        toolStore.updateToolCall(tu.id, { status: 'done', result })
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
      }

      // Add tool results to API history and continue
      useChatStore.getState().pushHistory(tabId, { role: 'user', content: toolResults })

      // Pre-push empty text segment so next turn writes there (not over tool segment)
      useChatStore.getState().pushTextSegment(assistantMsgId, '')

      await this.runTurn(tabId, toolStore, assistantMsgId)
    } else {
      // Pure text response — finalize
      if (fullText) {
        useChatStore.getState().pushHistory(tabId, { role: 'assistant', content: fullText })
      }
      useChatStore.getState().updateMessage(assistantMsgId, { content: fullText, isStreaming: false })
      useChatStore.getState().setStreaming(false)
    }
  }

  // ── Tool execution ─────────────────────────────────────────────────────────
  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    const api = (window as any).electronAPI
    if (!api) return 'Error: Electron API not available'

    const rootPath = useFileStore.getState().rootPath

    // Resolve a path: if relative/. and rootPath is set, anchor to rootPath
    const resolvePath = (p: string | undefined): string => {
      if (!p || p === '.') return rootPath || '.'
      if (!rootPath) return p
      // Already absolute (Unix or Windows)
      if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)) return p
      return rootPath.replace(/[/\\]$/, '') + '/' + p
    }

    try {
      switch (name) {
        case 'read_file': {
          const r = await api.fs.readFile(resolvePath(input.path as string))
          return r.success ? r.content : `Error: ${r.error}`
        }
        case 'write_file': {
          const resolved = resolvePath(input.path as string)
          const r = await api.fs.writeFile(resolved, input.content as string)
          if (r.success) useFileStore.getState().applyExternalEdit(resolved, input.content as string)
          return r.success ? 'File written successfully' : `Error: ${r.error}`
        }
        case 'edit_file': {
          const resolved = resolvePath(input.path as string)
          const rr = await api.fs.readFile(resolved)
          if (!rr.success) return `Error reading: ${rr.error}`
          let content = rr.content as string
          const edits = input.edits as Array<{ oldText: string; newText: string }>
          for (const e of edits) content = content.replace(e.oldText, e.newText)
          if (input.dryRun) return `Preview:\n${content.slice(0, 500)}`
          const wr = await api.fs.writeFile(resolved, content)
          if (wr.success) useFileStore.getState().applyExternalEdit(resolved, content)
          return wr.success ? 'Edits applied successfully' : `Error: ${wr.error}`
        }
        case 'list_files': {
          const r = await api.fs.readDir(resolvePath(input.path as string))
          return r.success
            ? r.entries.map((e: any) => `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.name}`).join('\n')
            : `Error: ${r.error}`
        }
        case 'glob': {
          const r = await api.tools.glob(input.pattern as string, resolvePath(input.path as string))
          return r.success ? (r.files as string[]).join('\n') || '(no matches)' : `Error: ${r.error}`
        }
        case 'grep': {
          const r = await api.tools.grep(input.pattern as string, resolvePath(input.path as string), input.filePattern as string)
          return r.success ? r.results || '(no matches)' : `Error: ${r.error}`
        }
        case 'execute_command': {
          const cwd = input.workingDir ? resolvePath(input.workingDir as string) : (rootPath || undefined)
          const r = await api.tools.bash(input.command as string, cwd)
          if (!r.success) return `Exit error: ${r.error}\n${r.stderr}`
          return `${r.stdout}${r.stderr ? '\n[stderr]\n' + r.stderr : ''}`
        }
        case 'ask_user': {
          return prompt(input.question as string) || '(User cancelled)'
        }
        default:
          return `Unknown tool: ${name}`
      }
    } catch (err: unknown) {
      return `Tool error: ${(err as Error).message}`
    }
  }

  interrupt() {
    this.abortController?.abort()
    useChatStore.getState().setStreaming(false)
  }

  clearHistory() {
    const tabId = useChatStore.getState().activeTabId
    useChatStore.getState().clearHistory(tabId)
  }

  get isConnected(): boolean {
    return !!this.apiKey
  }
}

export const claudeClient = new ClaudeClient()
