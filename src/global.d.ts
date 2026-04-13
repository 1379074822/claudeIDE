declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.css' {
  const content: string
  export default content
}

// ============================================================
// Electron API Types (exposed via contextBridge)
// ============================================================

interface FsEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface FsResult {
  success: boolean
  error?: string
}

interface FsReadDirResult extends FsResult {
  entries: FsEntry[]
}

interface FsReadFileResult extends FsResult {
  content: string
  size?: number
  mtime?: Date
}

interface FsSelectFolderResult extends FsResult {
  path: string
}

interface ToolBashResult {
  success: boolean
  stdout: string
  stderr: string
  error?: string
}

interface ToolGlobResult {
  success: boolean
  files: string[]
  error?: string
}

interface ToolGrepResult {
  success: boolean
  results: string
  error?: string
}

interface TerminalCreateResult {
  success: boolean
  id: string
  error?: string
}

interface ServerStartResult {
  success: boolean
  error?: string
  port?: number
}

interface ServerStatusResult {
  running: boolean
  port?: number
  pid?: number
}

interface SessionListResult {
  success: boolean
  sessions: Array<{ id: string; cwd: string; createdAt: number }>
}

interface ConfigResult<T = unknown> {
  success: boolean
  data?: T
  content?: string
  error?: string
}

interface SecretResult {
  success: boolean
  value: string
}

interface GitCommit {
  hash: string
  subject: string
  author: string
  date: string
}

interface GitStatusResult {
  success: boolean
  statusMap: Record<string, string>
}

interface GitBranchResult {
  success: boolean
  branch: string
}

interface GitLogResult {
  success: boolean
  commits: GitCommit[]
  error?: string
}

interface GitDiffResult {
  success: boolean
  diff: string
  error?: string
}

interface RecentProject {
  path: string
  name: string
  lastOpened: number
}

interface ElectronAPI {
  // Claude Server (WebSocket mode)
  server: {
    start: (config: { workDir?: string; port?: number }) => Promise<ServerStartResult>
    stop: () => Promise<FsResult>
    status: () => Promise<ServerStatusResult>
    createSession: (opts: {
      cwd?: string
      resumeSessionId?: string
      model?: string
      tools?: string[]
    }) => Promise<FsResult & { sessionId?: string }>
    sendMessage: (content: string) => Promise<FsResult>
    interrupt: () => Promise<FsResult>
    respondPermission: (
      requestId: string,
      result: { behavior: 'allow' | 'deny'; message?: string }
    ) => Promise<FsResult>
    disconnectSession: () => Promise<FsResult>
    onMessage: (callback: (data: unknown) => void) => () => void
    onPermissionRequest: (callback: (data: {
      requestId: string
      toolName: string
      toolInput: Record<string, unknown>
      description?: string
    }) => void) => () => void
    onConnected: (callback: (data: unknown) => void) => () => void
    onDisconnected: (callback: (data: unknown) => void) => () => void
    onStatusChange: (callback: (data: unknown) => void) => () => void
    onLog: (callback: (data: string) => void) => () => void
    onStopped: (callback: (data: unknown) => void) => () => void
    onError: (callback: (data: unknown) => void) => () => void
  }

  // Session Management
  session: {
    list: () => Promise<SessionListResult>
    resume: (opts: { sessionId: string; cwd?: string }) => Promise<FsResult>
    delete: (sessionKey: string) => Promise<FsResult>
  }

  // Configuration
  config: {
    readSettings: (opts?: { scope?: 'global' | 'project' | 'merged'; projectRoot?: string }) => Promise<ConfigResult>
    writeSettings: (opts: { scope: 'global' | 'project'; projectRoot?: string; data: unknown }) => Promise<FsResult>
    readClaudeMd: (opts?: { scope?: 'global' | 'project'; projectRoot?: string }) => Promise<ConfigResult<string>>
    writeClaudeMd: (opts: { scope: 'global' | 'project'; projectRoot?: string; content: string }) => Promise<FsResult>
    readMcpConfig: (opts?: { scope?: 'global' | 'project' | 'merged'; projectRoot?: string }) => Promise<ConfigResult>
    writeMcpConfig: (opts: { scope: 'global' | 'project'; projectRoot?: string; data: unknown }) => Promise<FsResult>
    readHooks: (opts?: { scope?: 'global' | 'project'; projectRoot?: string }) => Promise<ConfigResult>
    writeHooks: (opts: { scope: 'global' | 'project'; projectRoot?: string; hooks: unknown }) => Promise<FsResult>
    readRecentProjects: () => Promise<ConfigResult<RecentProject[]>>
    addRecentProject: (projectPath: string) => Promise<FsResult>
    removeRecentProject: (projectPath: string) => Promise<FsResult>
  }

  // Secrets (encrypted storage)
  secrets: {
    store: (key: string, value: string) => Promise<FsResult>
    get: (key: string) => Promise<SecretResult>
    encryptionAvailable: () => Promise<{ available: boolean }>
  }

  // Claude API proxy (fallback mode)
  claude: {
    stream: (
      url: string,
      headers: Record<string, string>,
      body: string,
      onChunk: (chunk: string) => void,
      onEnd: () => void,
      streamId?: string
    ) => Promise<{ ok?: boolean; error?: string }>
  }

  // File System
  fs: {
    readDir: (dirPath: string) => Promise<FsReadDirResult>
    readFile: (filePath: string) => Promise<FsReadFileResult>
    writeFile: (filePath: string, content: string) => Promise<FsResult>
    selectFolder: () => Promise<FsSelectFolderResult>
    openInExplorer: (filePath: string) => Promise<FsResult>
    mkdir: (dirPath: string) => Promise<FsResult>
    rename: (oldPath: string, newPath: string) => Promise<FsResult>
    delete: (targetPath: string) => Promise<FsResult>
    watch: (rootPath: string) => Promise<FsResult>
    unwatch: () => Promise<FsResult>
    onChanged: (callback: (data: { type: string; path: string }) => void) => () => void
  }

  // Shell utilities
  shell: {
    showItemInFolder: (filePath: string) => Promise<FsResult>
  }

  // Tools (fallback mode)
  tools: {
    bash: (command: string, cwd?: string) => Promise<ToolBashResult>
    glob: (pattern: string, cwd?: string) => Promise<ToolGlobResult>
    grep: (pattern: string, path: string, filePattern?: string, caseSensitive?: boolean, useRegex?: boolean) => Promise<ToolGrepResult>
  }

  // Terminal (node-pty)
  terminal: {
    create: (opts: { cwd?: string; cols?: number; rows?: number }) => Promise<TerminalCreateResult>
    write: (id: string, data: string) => Promise<FsResult>
    resize: (id: string, cols: number, rows: number) => Promise<FsResult>
    destroy: (id: string) => Promise<FsResult>
    onData: (id: string, callback: (data: string) => void) => () => void
    onExit: (id: string, callback: () => void) => () => void
  }

  // Git
  git: {
    status: (rootPath: string) => Promise<GitStatusResult>
    branch: (rootPath: string) => Promise<GitBranchResult>
    log: (rootPath: string, maxCount?: number) => Promise<GitLogResult>
    diff: (rootPath: string, filePath?: string) => Promise<GitDiffResult>
    stage: (rootPath: string, filePath: string) => Promise<FsResult>
    unstage: (rootPath: string, filePath: string) => Promise<FsResult>
    stageAll: (rootPath: string) => Promise<FsResult>
    commit: (rootPath: string, message: string) => Promise<FsResult>
    discard: (rootPath: string, filePath: string) => Promise<FsResult>
  }

  // Window Controls
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
