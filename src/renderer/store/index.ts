// Unified store exports
// All stores are now in separate files for better organization

export { useFileStore, type FileEntry, type OpenFile, type PendingDiff } from './fileStore'
export { useChatStore, type ChatMessage, type FileDiff, type InlineToolCall, type ContentSegment, type ChatTab } from './chatStore'
export { useToolStore, type ToolCallEntry } from './toolStore'
export { useModelStore, type ModelProfile } from './modelStore'
export { useSessionStore, type ServerStatus, type ConnectionMode, type SessionEntry } from './sessionStore'
export { usePermissionStore, type PermissionMode, type PermissionRequest } from './permissionStore'
export { useConfigStore, type ConfigSettings, type HooksConfig, type McpConfig } from './configStore'
export { useProjectStore, type RecentProject } from './projectStore'
export { useUIStore } from './uiStore'
export { useLocaleStore, useT, type Locale } from '../locales'

// Legacy re-export: useApiStore was deprecated in favor of useModelStore
// Keep a thin wrapper for backward compatibility during migration
export { useModelStore as useApiStore } from './modelStore'
