export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    py: 'python', pyw: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin', kts: 'kotlin',
    scala: 'scala',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', sass: 'sass', less: 'less',
    json: 'json', jsonc: 'json',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    md: 'markdown', mdx: 'markdown',
    sql: 'sql',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    tf: 'terraform',
    r: 'r',
    lua: 'lua',
    vim: 'viml',
    ex: 'elixir', exs: 'elixir',
    clj: 'clojure', cljs: 'clojure',
    hs: 'haskell',
    ml: 'ocaml', mli: 'ocaml',
    proto: 'protobuf',
    graphql: 'graphql', gql: 'graphql',
    env: 'dotenv',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    log: 'log',
    txt: 'plaintext',
  }

  // Special cases for extensionless files
  const basename = filePath.split('/').pop()?.split('\\').pop()?.toLowerCase() || ''
  if (basename === 'dockerfile') return 'dockerfile'
  if (basename === 'makefile' || basename === 'gnumakefile') return 'makefile'
  if (basename === '.env' || basename.startsWith('.env.')) return 'dotenv'
  if (basename === '.gitignore' || basename === '.gitattributes') return 'git-commit'

  return map[ext] || 'plaintext'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString()
}

export function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path
  const parts = path.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return '...' + path.slice(-maxLen)
  return '.../' + parts.slice(-2).join('/')
}

export function diffLines(oldText: string, newText: string): Array<{ type: '+' | '-' | ' '; text: string }> {
  const oldLines = (oldText ?? '').split('\n')
  const newLines = (newText ?? '').split('\n')
  const result: Array<{ type: '+' | '-' | ' '; text: string }> = []

  // Simple line-by-line diff (LCS-based would be better but this works for display)
  let oi = 0, ni = 0
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi >= oldLines.length) {
      result.push({ type: '+', text: newLines[ni] })
      ni++
    } else if (ni >= newLines.length) {
      result.push({ type: '-', text: oldLines[oi] })
      oi++
    } else if (oldLines[oi] === newLines[ni]) {
      result.push({ type: ' ', text: oldLines[oi] })
      oi++; ni++
    } else {
      result.push({ type: '-', text: oldLines[oi] })
      result.push({ type: '+', text: newLines[ni] })
      oi++; ni++
    }
  }
  return result
}
