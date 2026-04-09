import { useCallback, useEffect, useState, useMemo } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { Files, Search, Settings, History } from 'lucide-react'
import TitleBar from './components/TitleBar/TitleBar'
import FileTree from './components/FileTree/FileTree'
import SearchPanel from './components/Search/SearchPanel'
import Editor from './components/Editor/Editor'
import Chat from './components/Chat/Chat'
import SettingsPanel from './components/Settings/SettingsPanel'
import SessionPanel from './components/Session/SessionPanel'
import WelcomePage from './components/Project/WelcomePage'
import StatusBar from './components/StatusBar/StatusBar'
import CommandPalette from './components/CommandPalette/CommandPalette'
import QuickOpen from './components/QuickOpen/QuickOpen'
import TerminalPanel from './components/Terminal/TerminalPanel'
import { useFileStore, useUIStore, useSessionStore, useChatStore, useToolStore, useT, useModelStore } from './store'
import { serverClient } from './utils/serverClient'
import styles from './App.module.css'

export default function App() {
  const { rootPath, openFiles, setRootPath } = useFileStore()
  const { showFileTree, showChat, activePanel, setActivePanel, toggleFileTree, toggleChat, setTheme } = useUIStore()
  const { connectionMode, setConnectionMode } = useSessionStore()
  const { loadApiKey } = useModelStore()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const t = useT()

  const showWelcome = openFiles.length === 0 && !rootPath

  // Load encrypted API key on startup
  useEffect(() => {
    loadApiKey()
  }, [])

  // Restore last project on startup
  useEffect(() => {
    if (rootPath) return
    const api = (window as any).electronAPI
    if (!api?.config) return
    api.config.readRecentProjects().then((result: any) => {
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setRootPath(result.data[0].path)
      }
    })
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+P → Command Palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setCommandPaletteOpen(v => !v)
      }
      // Ctrl+P → Quick Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpenOpen(v => !v)
      }
      // Ctrl+Shift+F → Search panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setActivePanel('search')
      }
      // Ctrl+` → Toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setShowTerminal(v => !v)
      }
      // Ctrl+B → Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !e.shiftKey) {
        e.preventDefault()
        toggleFileTree()
      }
      // Ctrl+J → Toggle chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'j' && !e.shiftKey) {
        e.preventDefault()
        toggleChat()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleFileTree, toggleChat, setActivePanel])

  // Command palette commands
  const commands = useMemo(() => [
    { id: 'open-folder', label: t.cmdOpenFolder, category: t.catFile, action: () => handleOpenFolder() },
    { id: 'toggle-sidebar', label: t.cmdToggleSidebar, category: t.catView, shortcut: 'Ctrl+B', action: () => toggleFileTree() },
    { id: 'toggle-chat', label: t.cmdToggleChat, category: t.catView, shortcut: 'Ctrl+J', action: () => toggleChat() },
    { id: 'show-explorer', label: t.cmdShowExplorer, category: t.catView, action: () => setActivePanel('files') },
    { id: 'show-search', label: t.cmdShowSearch, category: t.catView, action: () => setActivePanel('search') },
    { id: 'show-sessions', label: t.cmdShowSessions, category: t.catView, action: () => setActivePanel('sessions') },
    { id: 'show-settings', label: t.cmdShowSettings, category: t.catView, action: () => setActivePanel('settings') },
    { id: 'theme-mocha', label: t.cmdThemeMocha, category: t.catTheme, action: () => setTheme('catppuccin-mocha') },
    { id: 'theme-latte', label: t.cmdThemeLatte, category: t.catTheme, action: () => setTheme('catppuccin-latte') },
    { id: 'theme-ayu', label: t.cmdThemeAyu, category: t.catTheme, action: () => setTheme('ayu-dark') },
    { id: 'clear-chat', label: t.cmdClearChat, category: t.catChat, action: () => {
      const store = useChatStore.getState()
      const tabId = store.activeTabId
      store.closeTab(tabId)
      store.createTab()
      useToolStore.getState().clearToolCalls()
    }},
  ], [t])

  // Server init
  useEffect(() => {
    const tryServerConnect = async () => {
      const api = (window as any).electronAPI
      if (!api?.server) {
        setConnectionMode('api')
        return
      }
      const result = await serverClient.initialize(rootPath || undefined)
      if (result.success) {
        setConnectionMode('server')
      } else {
        console.log('[App] Server mode unavailable:', result.error)
        setConnectionMode('api')
      }
    }
    tryServerConnect()
    return () => { serverClient.disconnect() }
  }, [])

  useEffect(() => {
    if (!rootPath) return
    const api = (window as any).electronAPI
    if (api?.config) {
      api.config.addRecentProject(rootPath)
    }
    if (connectionMode === 'server' && serverClient.isInitialized) {
      serverClient.disconnect().then(() => { serverClient.initialize(rootPath) })
    }
  }, [rootPath])

  const handleOpenFolder = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api) {
      const path = prompt('Enter folder path:')
      if (path) setRootPath(path)
      return
    }
    const result = await api.fs.selectFolder()
    if (result.success) {
      setRootPath(result.path)
    }
  }, [setRootPath])

  return (
    <div className={styles.app}>
      <TitleBar onOpenFolder={handleOpenFolder} />

      <div className={styles.body}>
        {/* Activity Bar */}
        <div className={styles.activityBar}>
          <button
            className={`${styles.activityBtn} ${activePanel === 'files' ? styles.activityActive : ''}`}
            onClick={() => setActivePanel('files')}
            title="Explorer"
          >
            <Files size={20} />
          </button>
          <button
            className={`${styles.activityBtn} ${activePanel === 'search' ? styles.activityActive : ''}`}
            onClick={() => setActivePanel('search')}
            title="Search"
          >
            <Search size={20} />
          </button>
          <button
            className={`${styles.activityBtn} ${activePanel === 'sessions' ? styles.activityActive : ''}`}
            onClick={() => setActivePanel('sessions')}
            title="Sessions"
          >
            <History size={20} />
          </button>
          <div className={styles.activitySpacer} />
          <button
            className={`${styles.activityBtn} ${activePanel === 'settings' ? styles.activityActive : ''}`}
            onClick={() => setActivePanel('settings')}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>

        {/* Main content */}
        <div className={styles.mainContent}>
          <PanelGroup direction="horizontal" autoSaveId="claude-ide-layout" style={{ flex: 1 }}>
            {showFileTree && (
              <>
                <Panel defaultSize={18} minSize={12} maxSize={35} id="sidebar">
                  <div className={styles.sidebar}>
                    {activePanel === 'files' && <FileTree />}
                    {activePanel === 'search' && (
                      <SearchPanel rootPath={rootPath || ''} />
                    )}
                    {activePanel === 'sessions' && <SessionPanel />}
                    {activePanel === 'settings' && <SettingsPanel />}
                  </div>
                </Panel>
                <PanelResizeHandle className={styles.resizeHandle} />
              </>
            )}

            <Panel id="editor">
              <div className={styles.editorArea}>
                {showWelcome ? (
                  <WelcomePage onOpenFolder={handleOpenFolder} />
                ) : (
                  <Editor />
                )}
              </div>
            </Panel>

            {showChat && (
              <>
                <PanelResizeHandle className={styles.resizeHandle} />
                <Panel defaultSize={28} minSize={22} maxSize={50} id="chat">
                  <div className={styles.chatArea}>
                    <Chat />
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>

          {/* Terminal Panel (bottom, inside mainContent) */}
          {showTerminal && (
            <div className={styles.terminalArea}>
              <TerminalPanel rootPath={rootPath || undefined} onClose={() => setShowTerminal(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Command Palette */}
      <CommandPalette
        commands={commands}
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Quick Open (Ctrl+P) */}
      <QuickOpen
        isOpen={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        rootPath={rootPath || ''}
      />
    </div>
  )
}
