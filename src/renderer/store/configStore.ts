import { create } from 'zustand'

export type ConfigSettings = Record<string, unknown>
export type HooksConfig = Record<string, unknown>
export type McpConfig = { mcpServers?: Record<string, unknown> }

type ConfigStore = {
  globalSettings: ConfigSettings
  projectSettings: ConfigSettings
  globalHooks: HooksConfig
  projectHooks: HooksConfig
  globalMcpConfig: McpConfig
  projectMcpConfig: McpConfig
  globalClaudeMd: string
  projectClaudeMd: string

  setGlobalSettings: (s: ConfigSettings) => void
  setProjectSettings: (s: ConfigSettings) => void
  setGlobalHooks: (h: HooksConfig) => void
  setProjectHooks: (h: HooksConfig) => void
  setGlobalMcpConfig: (c: McpConfig) => void
  setProjectMcpConfig: (c: McpConfig) => void
  setGlobalClaudeMd: (md: string) => void
  setProjectClaudeMd: (md: string) => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  globalSettings: {},
  projectSettings: {},
  globalHooks: {},
  projectHooks: {},
  globalMcpConfig: {},
  projectMcpConfig: {},
  globalClaudeMd: '',
  projectClaudeMd: '',

  setGlobalSettings: (s) => set({ globalSettings: s }),
  setProjectSettings: (s) => set({ projectSettings: s }),
  setGlobalHooks: (h) => set({ globalHooks: h }),
  setProjectHooks: (h) => set({ projectHooks: h }),
  setGlobalMcpConfig: (c) => set({ globalMcpConfig: c }),
  setProjectMcpConfig: (c) => set({ projectMcpConfig: c }),
  setGlobalClaudeMd: (md) => set({ globalClaudeMd: md }),
  setProjectClaudeMd: (md) => set({ projectClaudeMd: md }),
}))
