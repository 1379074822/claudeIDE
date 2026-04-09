/**
 * ServerManager - Claude Code Server lifecycle & WebSocket session management
 *
 * Manages the `claude --server` subprocess and WebSocket connections.
 * Protocol reference: open-claude-code/src/server/directConnectManager.ts
 */

const { spawn } = require('child_process')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')

// ============================================================
// Types (JSDoc for IDE support)
// ============================================================

/**
 * @typedef {'starting'|'running'|'detached'|'stopping'|'stopped'} SessionState
 * @typedef {{
 *   sessionId: string,
 *   transcriptSessionId: string,
 *   cwd: string,
 *   permissionMode?: string,
 *   createdAt: number,
 *   lastActiveAt: number
 * }} SessionIndexEntry
 */

class ServerManager {
  constructor() {
    /** @type {import('child_process').ChildProcess|null} */
    this.serverProcess = null
    /** @type {WebSocket|null} */
    this.ws = null
    /** @type {string} */
    this.authToken = crypto.randomBytes(32).toString('hex')
    /** @type {number} */
    this.port = 0
    /** @type {string} */
    this.serverUrl = ''
    /** @type {string|null} */
    this.currentSessionId = null
    /** @type {string|null} */
    this.currentWsUrl = null
    /** @type {BrowserWindow|null} */
    this.mainWindow = null
    /** @type {'stopped'|'starting'|'running'|'error'} */
    this.serverStatus = 'stopped'
    /** @type {string|null} */
    this.workDir = null

    // Reconnect state
    this._reconnectTimer = null
    this._reconnectAttempts = 0
    this._maxReconnectAttempts = 5
  }

  /**
   * Set the main window reference for IPC event forwarding
   * @param {BrowserWindow} win
   */
  setMainWindow(win) {
    this.mainWindow = win
  }

  // ============================================================
  // Server Process Lifecycle
  // ============================================================

  /**
   * Start the claude --server subprocess
   * @param {string} [workDir] - Working directory for the server
   * @param {object} [opts] - Additional options
   * @param {number} [opts.port] - Specific port (0 = auto)
   * @returns {Promise<{success: boolean, port?: number, error?: string}>}
   */
  async startServer(workDir, opts = {}) {
    if (this.serverProcess && !this.serverProcess.killed) {
      return { success: true, port: this.port }
    }

    this.workDir = workDir || process.cwd()
    this.serverStatus = 'starting'
    this._emitStatus()

    // Find a free port if not specified
    this.port = opts.port || await this._findFreePort()
    this.serverUrl = `http://127.0.0.1:${this.port}`

    const args = [
      '--server',
      `--port=${this.port}`,
      `--auth-token=${this.authToken}`,
    ]

    if (this.workDir) {
      args.push(`--cwd=${this.workDir}`)
    }

    const claudeCmd = process.platform === 'win32' ? 'claude.cmd' : 'claude'

    return new Promise((resolve) => {
      try {
        this.serverProcess = spawn(claudeCmd, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
          shell: true,
        })

        let startupOutput = ''
        let resolved = false

        const onData = (data) => {
          const text = data.toString()
          startupOutput += text
          this._emitLog('stdout', text)

          // Detect server ready
          if (!resolved && (text.includes('listening') || text.includes('ready') || text.includes(String(this.port)))) {
            resolved = true
            this.serverStatus = 'running'
            this._emitStatus()
            resolve({ success: true, port: this.port })
          }
        }

        this.serverProcess.stdout.on('data', onData)
        this.serverProcess.stderr.on('data', (data) => {
          const text = data.toString()
          this._emitLog('stderr', text)
          // Some servers print ready on stderr
          if (!resolved && (text.includes('listening') || text.includes('ready'))) {
            resolved = true
            this.serverStatus = 'running'
            this._emitStatus()
            resolve({ success: true, port: this.port })
          }
        })

        this.serverProcess.on('error', (err) => {
          this.serverStatus = 'error'
          this._emitStatus()
          if (!resolved) {
            resolved = true
            resolve({ success: false, error: `Failed to start claude server: ${err.message}` })
          }
        })

        this.serverProcess.on('close', (code) => {
          this.serverStatus = 'stopped'
          this.serverProcess = null
          this._emitStatus()
          this._emit('server:stopped', { code })
          if (!resolved) {
            resolved = true
            resolve({ success: false, error: `Server exited with code ${code}. Output: ${startupOutput.slice(0, 500)}` })
          }
        })

        // Timeout: if server doesn't signal ready in 15s, assume it's running
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            // Check if process is still alive
            if (this.serverProcess && !this.serverProcess.killed) {
              this.serverStatus = 'running'
              this._emitStatus()
              resolve({ success: true, port: this.port })
            } else {
              resolve({ success: false, error: 'Server startup timeout' })
            }
          }
        }, 15000)

      } catch (err) {
        this.serverStatus = 'error'
        this._emitStatus()
        resolve({ success: false, error: err.message })
      }
    })
  }

  /**
   * Stop the claude server subprocess
   */
  stopServer() {
    this.disconnectSession()
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM')
      this.serverProcess = null
    }
    this.serverStatus = 'stopped'
    this._emitStatus()
    return { success: true }
  }

  /**
   * Get current server status
   */
  getStatus() {
    return {
      status: this.serverStatus,
      port: this.port,
      sessionId: this.currentSessionId,
      workDir: this.workDir,
      connected: this.ws?.readyState === WebSocket.OPEN,
    }
  }

  // ============================================================
  // Session Management via WebSocket
  // ============================================================

  /**
   * Create a new session on the server and connect via WebSocket
   * Reference: DirectConnectSessionManager protocol
   * @param {object} [opts]
   * @param {string} [opts.cwd] - Working directory for this session
   * @param {string} [opts.permissionMode] - Permission mode
   * @param {string} [opts.resumeSessionId] - Resume an existing session
   * @returns {Promise<{success: boolean, sessionId?: string, error?: string}>}
   */
  async createSession(opts = {}) {
    if (this.serverStatus !== 'running') {
      return { success: false, error: 'Server not running' }
    }

    try {
      // POST to create session
      const body = JSON.stringify({
        cwd: opts.cwd || this.workDir,
        permission_mode: opts.permissionMode || 'default',
        resume_session_id: opts.resumeSessionId || undefined,
      })

      const response = await this._httpPost(`${this.serverUrl}/sessions`, body)

      if (!response.session_id || !response.ws_url) {
        return { success: false, error: 'Invalid server response: missing session_id or ws_url' }
      }

      this.currentSessionId = response.session_id
      this.currentWsUrl = response.ws_url

      // Connect WebSocket
      await this._connectWebSocket(response.ws_url)

      return { success: true, sessionId: response.session_id }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  /**
   * Send a user message to the current session
   * Format: SDKUserMessage as defined in Claude Code SDK
   * @param {string|Array} content - Text string or array of content blocks
   * @returns {boolean}
   */
  sendMessage(content) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    // Must match SDKUserMessage format expected by --input-format stream-json
    const message = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: typeof content === 'string' ? content : content,
      },
      parent_tool_use_id: null,
      session_id: '',
    })

    this.ws.send(message)
    return true
  }

  /**
   * Respond to a permission request from the server
   * @param {string} requestId
   * @param {{behavior: 'allow'|'deny', updatedInput?: any, message?: string}} result
   */
  respondPermission(requestId, result) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const response = JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: {
          behavior: result.behavior,
          ...(result.behavior === 'allow'
            ? { updatedInput: result.updatedInput }
            : { message: result.message || 'Denied by user' }),
        },
      },
    })

    this.ws.send(response)
  }

  /**
   * Send interrupt signal to cancel current request
   */
  sendInterrupt() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const request = JSON.stringify({
      type: 'control_request',
      request_id: crypto.randomUUID(),
      request: {
        subtype: 'interrupt',
      },
    })

    this.ws.send(request)
  }

  /**
   * Disconnect the current WebSocket session
   */
  disconnectSession() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.currentSessionId = null
    this.currentWsUrl = null
    this._reconnectAttempts = 0
  }

  // ============================================================
  // Session Index (persisted sessions list)
  // ============================================================

  /**
   * Read the session index from ~/.claude/server-sessions.json
   * @returns {Record<string, SessionIndexEntry>}
   */
  getSessionIndex() {
    try {
      const filePath = path.join(os.homedir(), '.claude', 'server-sessions.json')
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch {}
    return {}
  }

  /**
   * List all saved sessions, sorted by lastActiveAt descending
   * @returns {Array<{key: string} & SessionIndexEntry>}
   */
  listSessions() {
    const index = this.getSessionIndex()
    return Object.entries(index)
      .map(([key, entry]) => ({ key, ...entry }))
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  }

  /**
   * Delete a session from the index
   * @param {string} sessionKey
   */
  deleteSession(sessionKey) {
    try {
      const filePath = path.join(os.homedir(), '.claude', 'server-sessions.json')
      if (fs.existsSync(filePath)) {
        const index = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        delete index[sessionKey]
        fs.writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf-8')
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Connect to the session WebSocket
   * @param {string} wsUrl
   * @returns {Promise<void>}
   */
  _connectWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl, {
          headers: {
            authorization: `Bearer ${this.authToken}`,
          },
        })

        this.ws.on('open', () => {
          this._reconnectAttempts = 0
          this._emit('server:connected', { sessionId: this.currentSessionId })
          resolve()
        })

        this.ws.on('message', (data) => {
          const text = typeof data === 'string' ? data : data.toString()
          this._handleWebSocketMessage(text)
        })

        this.ws.on('close', () => {
          this._emit('server:disconnected', { sessionId: this.currentSessionId })
          this._attemptReconnect()
        })

        this.ws.on('error', (err) => {
          this._emit('server:wsError', { error: err.message })
          reject(err)
        })

      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Parse and dispatch WebSocket messages
   * Protocol: newline-separated JSON, each is a StdoutMessage
   */
  _handleWebSocketMessage(rawData) {
    const lines = rawData.split('\n').filter(l => l.trim())

    for (const line of lines) {
      let parsed
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }

      if (!parsed || typeof parsed.type !== 'string') continue

      // Handle permission requests
      if (parsed.type === 'control_request') {
        if (parsed.request?.subtype === 'can_use_tool') {
          this._emit('server:permissionRequest', {
            requestId: parsed.request_id,
            toolName: parsed.request.tool_name,
            toolInput: parsed.request.tool_input,
            description: parsed.request.description,
          })
        }
        continue
      }

      // Skip internal control messages
      if (
        parsed.type === 'control_response' ||
        parsed.type === 'keep_alive' ||
        parsed.type === 'control_cancel_request'
      ) {
        continue
      }

      // Forward all SDK messages to renderer
      this._emit('server:message', parsed)
    }
  }

  /**
   * Attempt to reconnect WebSocket on disconnect
   */
  _attemptReconnect() {
    if (!this.currentWsUrl || this._reconnectAttempts >= this._maxReconnectAttempts) {
      return
    }

    this._reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 10000)

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this._connectWebSocket(this.currentWsUrl)
      } catch {
        // Will retry via close handler
      }
    }, delay)
  }

  /**
   * HTTP POST helper
   * @param {string} url
   * @param {string} body
   * @returns {Promise<any>}
   */
  _httpPost(url, body) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http

      const options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }

      const req = lib.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data))
            } catch {
              resolve(data)
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
          }
        })
      })

      req.on('error', reject)
      req.setTimeout(10000, () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.write(body)
      req.end()
    })
  }

  /**
   * Find a free port
   * @returns {Promise<number>}
   */
  _findFreePort() {
    return new Promise((resolve, reject) => {
      const server = require('net').createServer()
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        server.close(() => resolve(port))
      })
      server.on('error', reject)
    })
  }

  /**
   * Emit event to renderer via mainWindow IPC
   * @param {string} channel
   * @param {any} data
   */
  _emit(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  _emitLog(type, text) {
    this._emit('server:log', { type, text })
  }

  _emitStatus() {
    this._emit('server:statusChange', this.getStatus())
  }
}

module.exports = { ServerManager }
