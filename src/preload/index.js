const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================
  // Claude Server (WebSocket mode - primary)
  // ============================================================
  server: {
    start: (config) => ipcRenderer.invoke('server:start', config),
    stop: () => ipcRenderer.invoke('server:stop'),
    status: () => ipcRenderer.invoke('server:status'),

    // Session management
    createSession: (opts) => ipcRenderer.invoke('server:createSession', opts),
    sendMessage: (content) => ipcRenderer.invoke('server:sendMessage', content),
    interrupt: () => ipcRenderer.invoke('server:interrupt'),
    respondPermission: (requestId, result) =>
      ipcRenderer.invoke('server:respondPermission', { requestId, result }),
    disconnectSession: () => ipcRenderer.invoke('server:disconnectSession'),

    // Event listeners
    onMessage: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:message', handler)
      return () => ipcRenderer.removeListener('server:message', handler)
    },
    onPermissionRequest: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:permissionRequest', handler)
      return () => ipcRenderer.removeListener('server:permissionRequest', handler)
    },
    onConnected: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:connected', handler)
      return () => ipcRenderer.removeListener('server:connected', handler)
    },
    onDisconnected: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:disconnected', handler)
      return () => ipcRenderer.removeListener('server:disconnected', handler)
    },
    onStatusChange: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:statusChange', handler)
      return () => ipcRenderer.removeListener('server:statusChange', handler)
    },
    onLog: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:log', handler)
      return () => ipcRenderer.removeListener('server:log', handler)
    },
    onStopped: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:stopped', handler)
      return () => ipcRenderer.removeListener('server:stopped', handler)
    },
    onError: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('server:wsError', handler)
      return () => ipcRenderer.removeListener('server:wsError', handler)
    },
  },

  // ============================================================
  // Session Management
  // ============================================================
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    resume: (opts) => ipcRenderer.invoke('session:resume', opts),
    delete: (sessionKey) => ipcRenderer.invoke('session:delete', sessionKey),
  },

  // ============================================================
  // Configuration Management
  // ============================================================
  config: {
    // Settings
    readSettings: (opts) => ipcRenderer.invoke('config:readSettings', opts || { scope: 'global' }),
    writeSettings: (opts) => ipcRenderer.invoke('config:writeSettings', opts),

    // CLAUDE.md
    readClaudeMd: (opts) => ipcRenderer.invoke('config:readClaudeMd', opts || { scope: 'global' }),
    writeClaudeMd: (opts) => ipcRenderer.invoke('config:writeClaudeMd', opts),

    // MCP
    readMcpConfig: (opts) => ipcRenderer.invoke('config:readMcpConfig', opts || { scope: 'global' }),
    writeMcpConfig: (opts) => ipcRenderer.invoke('config:writeMcpConfig', opts),

    // Hooks
    readHooks: (opts) => ipcRenderer.invoke('config:readHooks', opts || { scope: 'global' }),
    writeHooks: (opts) => ipcRenderer.invoke('config:writeHooks', opts),

    // Recent Projects
    readRecentProjects: () => ipcRenderer.invoke('config:readRecentProjects'),
    addRecentProject: (projectPath) => ipcRenderer.invoke('config:addRecentProject', projectPath),
    removeRecentProject: (projectPath) => ipcRenderer.invoke('config:removeRecentProject', projectPath),
  },

  // ============================================================
  // Secrets (encrypted storage)
  // ============================================================
  secrets: {
    store: (key, value) => ipcRenderer.invoke('secrets:store', { key, value }),
    get: (key) => ipcRenderer.invoke('secrets:get', key),
    encryptionAvailable: () => ipcRenderer.invoke('secrets:encryptionAvailable'),
  },

  // ============================================================
  // Claude API proxy (fallback mode - bypasses CORS)
  // ============================================================
  claude: {
    stream: (url, headers, body, onChunk, onEnd, streamId) => {
      const chunkChannel = streamId ? `claude:chunk:${streamId}` : 'claude:chunk'
      const endChannel = streamId ? `claude:end:${streamId}` : 'claude:end'

      const chunkHandler = (_, chunk) => onChunk(chunk)
      const endHandler = () => {
        onEnd()
        ipcRenderer.removeListener(chunkChannel, chunkHandler)
        ipcRenderer.removeListener(endChannel, endHandler)
      }
      ipcRenderer.on(chunkChannel, chunkHandler)
      ipcRenderer.on(endChannel, endHandler)
      return ipcRenderer.invoke('claude:stream', { url, headers, body, streamId })
    },
  },

  // ============================================================
  // File System
  // ============================================================
  fs: {
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
    openInExplorer: (filePath) => ipcRenderer.invoke('fs:openInExplorer', filePath),
    mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    delete: (targetPath) => ipcRenderer.invoke('fs:delete', targetPath),
  },

  // ============================================================
  // Shell utilities
  // ============================================================
  shell: {
    showItemInFolder: (filePath) => ipcRenderer.invoke('fs:openInExplorer', filePath),
  },

  // ============================================================
  // Tools (fallback mode)
  // ============================================================
  tools: {
    bash: (command, cwd) => ipcRenderer.invoke('tool:bash', { command, cwd }),
    glob: (pattern, cwd) => ipcRenderer.invoke('tool:glob', { pattern, cwd }),
    grep: (pattern, path, filePattern) => ipcRenderer.invoke('tool:grep', { pattern, path, filePattern }),
  },

  // ============================================================
  // Terminal (node-pty)
  // ============================================================
  terminal: {
    create: (opts) => ipcRenderer.invoke('terminal:create', opts),
    write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
    onData: (id, callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on(`terminal:data:${id}`, handler)
      return () => ipcRenderer.removeListener(`terminal:data:${id}`, handler)
    },
    onExit: (id, callback) => {
      const handler = () => callback()
      ipcRenderer.on(`terminal:exit:${id}`, handler)
      return () => ipcRenderer.removeListener(`terminal:exit:${id}`, handler)
    },
  },

  // ============================================================
  // Window Controls
  // ============================================================
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
})
