const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)
const { ServerManager } = require('./serverManager')
const { ConfigManager } = require('./configManager')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
const serverManager = new ServerManager()
const configManager = new ConfigManager()

function createAppIcon() {
  const svgPath = path.join(__dirname, '../../public/icon.svg')
  try {
    const svgData = fs.readFileSync(svgPath, 'utf-8')
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgData).toString('base64')}`
    const img = nativeImage.createFromDataURL(dataUrl)
    if (!img.isEmpty()) return img
  } catch {}
  return undefined
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    icon: createAppIcon(),
  })

  serverManager.setMainWindow(mainWindow)

  // Prevent Electron from navigating away when files are dragged onto the window.
  // Without this, dropping a file causes the renderer to navigate to file:// URL
  // instead of firing the DOM drop event that our React handler listens to.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    serverManager.stopServer()
  })
}

// ============================================================
// IPC - Claude Server (WebSocket mode)
// ============================================================

ipcMain.handle('server:start', async (_, { workDir, port }) => {
  return serverManager.startServer(workDir, { port })
})

ipcMain.handle('server:stop', async () => {
  return serverManager.stopServer()
})

ipcMain.handle('server:status', async () => {
  return serverManager.getStatus()
})

ipcMain.handle('server:createSession', async (_, opts) => {
  return serverManager.createSession(opts)
})

ipcMain.handle('server:sendMessage', async (_, content) => {
  return { success: serverManager.sendMessage(content) }
})

ipcMain.handle('server:interrupt', async () => {
  serverManager.sendInterrupt()
  return { success: true }
})

ipcMain.handle('server:respondPermission', async (_, { requestId, result }) => {
  serverManager.respondPermission(requestId, result)
  return { success: true }
})

ipcMain.handle('server:disconnectSession', async () => {
  serverManager.disconnectSession()
  return { success: true }
})

// ============================================================
// IPC - Session Management
// ============================================================

ipcMain.handle('session:list', async () => {
  return { success: true, sessions: serverManager.listSessions() }
})

ipcMain.handle('session:delete', async (_, sessionKey) => {
  return serverManager.deleteSession(sessionKey)
})

ipcMain.handle('session:resume', async (_, { sessionId, cwd }) => {
  return serverManager.createSession({ resumeSessionId: sessionId, cwd })
})

// ============================================================
// IPC - Configuration Management
// ============================================================

// Settings
ipcMain.handle('config:readSettings', async (_, { scope, projectRoot }) => {
  if (scope === 'global') return configManager.readGlobalSettings()
  if (scope === 'project' && projectRoot) return configManager.readProjectSettings(projectRoot)
  if (scope === 'merged' && projectRoot) return configManager.readMergedSettings(projectRoot)
  return configManager.readGlobalSettings()
})

ipcMain.handle('config:writeSettings', async (_, { scope, projectRoot, data }) => {
  if (scope === 'project' && projectRoot) return configManager.writeProjectSettings(projectRoot, data)
  return configManager.writeGlobalSettings(data)
})

// CLAUDE.md
ipcMain.handle('config:readClaudeMd', async (_, { scope, projectRoot }) => {
  if (scope === 'project' && projectRoot) return configManager.readProjectClaudeMd(projectRoot)
  return configManager.readGlobalClaudeMd()
})

ipcMain.handle('config:writeClaudeMd', async (_, { scope, projectRoot, content }) => {
  if (scope === 'project' && projectRoot) return configManager.writeProjectClaudeMd(projectRoot, content)
  return configManager.writeGlobalClaudeMd(content)
})

// MCP
ipcMain.handle('config:readMcpConfig', async (_, { scope, projectRoot }) => {
  if (scope === 'global') return configManager.readGlobalMcpConfig()
  if (scope === 'project' && projectRoot) return configManager.readProjectMcpConfig(projectRoot)
  if (scope === 'merged' && projectRoot) return configManager.readMergedMcpConfig(projectRoot)
  return configManager.readGlobalMcpConfig()
})

ipcMain.handle('config:writeMcpConfig', async (_, { scope, projectRoot, data }) => {
  if (scope === 'project' && projectRoot) return configManager.writeProjectMcpConfig(projectRoot, data)
  return configManager.writeGlobalMcpConfig(data)
})

// Hooks
ipcMain.handle('config:readHooks', async (_, { scope, projectRoot }) => {
  if (scope === 'project' && projectRoot) return configManager.readProjectHooks(projectRoot)
  return configManager.readGlobalHooks()
})

ipcMain.handle('config:writeHooks', async (_, { scope, projectRoot, hooks }) => {
  if (scope === 'project' && projectRoot) return configManager.writeProjectHooks(projectRoot, hooks)
  return configManager.writeGlobalHooks(hooks)
})

// Recent Projects
ipcMain.handle('config:readRecentProjects', async () => {
  return configManager.readRecentProjects()
})

ipcMain.handle('config:addRecentProject', async (_, projectPath) => {
  return configManager.addRecentProject(projectPath)
})

ipcMain.handle('config:removeRecentProject', async (_, projectPath) => {
  return configManager.removeRecentProject(projectPath)
})

// ============================================================
// IPC - Secrets (encrypted API key storage)
// ============================================================

const SECRETS_PATH = path.join(app.getPath('userData'), 'secrets.json')

function readSecretsFile() {
  try {
    if (!fs.existsSync(SECRETS_PATH)) return {}
    return JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSecretsFile(data) {
  try {
    fs.writeFileSync(SECRETS_PATH, JSON.stringify(data), 'utf-8')
  } catch {}
}

ipcMain.handle('secrets:store', async (_, { key, value }) => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value).toString('base64')
    const secrets = readSecretsFile()
    secrets[key] = { v: encrypted, encrypted: true }
    writeSecretsFile(secrets)
  } else {
    // Fallback: store plaintext with a flag
    const secrets = readSecretsFile()
    secrets[key] = { v: value, encrypted: false }
    writeSecretsFile(secrets)
  }
  return { success: true }
})

ipcMain.handle('secrets:get', async (_, key) => {
  const secrets = readSecretsFile()
  const entry = secrets[key]
  if (!entry) return { success: false, value: '' }
  if (entry.encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      const value = safeStorage.decryptString(Buffer.from(entry.v, 'base64'))
      return { success: true, value }
    } catch {
      return { success: false, value: '' }
    }
  }
  return { success: true, value: entry.v || '' }
})

ipcMain.handle('secrets:encryptionAvailable', async () => {
  return { available: safeStorage.isEncryptionAvailable() }
})

// ============================================================
// IPC - Claude API proxy (fallback/legacy mode)
// ============================================================

ipcMain.handle('claude:stream', async (event, { url, headers, body, streamId }) => {
  const httpLib = require('https')
  const httpModule = require('http')
  const { URL } = require('url')

  const chunkChannel = streamId ? `claude:chunk:${streamId}` : 'claude:chunk'
  const endChannel = streamId ? `claude:end:${streamId}` : 'claude:end'

  try {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib = isHttps ? httpLib : httpModule

    return await new Promise((resolve) => {
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
      }

      const req = lib.request(options, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errBody = ''
          res.on('data', c => { errBody += c })
          res.on('end', () => {
            resolve({ error: `HTTP ${res.statusCode}: ${errBody.slice(0, 200)}` })
          })
          return
        }

        res.on('data', (chunk) => {
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send(chunkChannel, chunk.toString())
          }
        })

        res.on('end', () => {
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send(endChannel)
          }
          resolve({ ok: true })
        })

        res.on('error', (err) => {
          resolve({ error: err.message })
        })
      })

      req.on('error', (err) => {
        resolve({ error: err.message })
      })

      req.setTimeout(120000, () => {
        req.destroy()
        resolve({ error: 'Request timeout (120s)' })
      })

      req.write(body)
      req.end()
    })
  } catch (err) {
    return { error: err.message }
  }
})

// ============================================================
// IPC - Tools (bash, glob, grep) - used in fallback mode
// ============================================================

ipcMain.handle('tool:bash', async (_, { command, cwd }) => {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: cwd || process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    })
    return { success: true, stdout, stderr }
  } catch (err) {
    return { success: false, error: err.message, stdout: err.stdout || '', stderr: err.stderr || '' }
  }
})

ipcMain.handle('tool:glob', async (_, { pattern, cwd }) => {
  try {
    const { stdout } = await execAsync(`find . -name "${pattern}" -type f`, {
      cwd: cwd || process.cwd(),
      shell: true,
    })
    return { success: true, files: stdout.trim().split('\n').filter(Boolean) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tool:grep', async (_, { pattern, path: searchPath, filePattern }) => {
  try {
    let cmd = `grep -r "${pattern}" ${searchPath || '.'}`
    if (filePattern) cmd += ` --include="${filePattern}"`
    const { stdout } = await execAsync(cmd, {
      cwd: process.cwd(),
      maxBuffer: 5 * 1024 * 1024,
    })
    return { success: true, results: stdout }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================================================
// IPC - File System
// ============================================================

ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return {
      success: true,
      entries: entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name),
      })).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const stat = fs.statSync(filePath)
    return { success: true, content, size: stat.size, mtime: stat.mtime }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return { success: false }
  return { success: true, path: result.filePaths[0] }
})

ipcMain.handle('fs:openInExplorer', async (_, filePath) => {
  shell.showItemInFolder(filePath)
  return { success: true }
})

ipcMain.handle('fs:mkdir', async (_, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:rename', async (_, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:delete', async (_, targetPath) => {
  try {
    const stat = fs.statSync(targetPath)
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(targetPath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================================================
// IPC - Terminal (node-pty)
// ============================================================

const terminals = new Map() // id → ptyProcess

ipcMain.handle('terminal:create', async (event, { cwd, cols, rows }) => {
  let pty
  try {
    pty = require('node-pty')
  } catch {
    return { success: false, error: 'node-pty not available' }
  }
  const os = require('os')
  const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')
  const id = Math.random().toString(36).slice(2)

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: cwd || process.env.HOME || process.cwd(),
    env: process.env,
  })

  ptyProcess.onData(data => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send(`terminal:data:${id}`, data)
    }
  })

  ptyProcess.onExit(() => {
    terminals.delete(id)
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send(`terminal:exit:${id}`)
    }
  })

  terminals.set(id, ptyProcess)
  return { success: true, id }
})

ipcMain.handle('terminal:write', async (_, { id, data }) => {
  const ptyProcess = terminals.get(id)
  if (!ptyProcess) return { success: false }
  ptyProcess.write(data)
  return { success: true }
})

ipcMain.handle('terminal:resize', async (_, { id, cols, rows }) => {
  const ptyProcess = terminals.get(id)
  if (!ptyProcess) return { success: false }
  ptyProcess.resize(cols, rows)
  return { success: true }
})

ipcMain.handle('terminal:destroy', async (_, id) => {
  const ptyProcess = terminals.get(id)
  if (ptyProcess) {
    ptyProcess.kill()
    terminals.delete(id)
  }
  return { success: true }
})

// ============================================================
// IPC - Window Controls
// ============================================================

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false)

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  serverManager.stopServer()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  serverManager.stopServer()
})
