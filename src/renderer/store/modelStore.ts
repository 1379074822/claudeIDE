import { create } from 'zustand'

export type ModelProfile = {
  id: string
  name: string
  modelId: string
  apiKey?: string
  baseURL?: string
  description?: string
}

type ModelStore = {
  models: ModelProfile[]
  defaultApiKey: string
  defaultBaseURL: string
  activeModelId: string
  addModel: (model: ModelProfile) => void
  removeModel: (id: string) => void
  setDefaultApiKey: (key: string) => Promise<void>
  setDefaultBaseURL: (url: string) => void
  setActiveModel: (id: string) => void
  getActiveModel: () => ModelProfile | undefined
  loadApiKey: () => Promise<void>
}

const DEFAULT_MODELS: ModelProfile[] = [
  { id: 'opus-4.6', name: 'Opus 4.6', modelId: 'claude-opus-4-6', description: 'Most capable' },
  { id: 'sonnet-4.6', name: 'Sonnet 4.6', modelId: 'claude-sonnet-4-6', description: 'Balanced' },
  { id: 'haiku-4.5', name: 'Haiku 4.5', modelId: 'claude-haiku-4-5-20251001', description: 'Fast' },
]

const api = () => (window as any).electronAPI

export const useModelStore = create<ModelStore>((set, get) => ({
  models: JSON.parse(localStorage.getItem('claude_models') || 'null') || DEFAULT_MODELS,
  defaultApiKey: localStorage.getItem('claude_api_key') || '',
  defaultBaseURL: localStorage.getItem('claude_base_url') || 'https://api.anthropic.com',
  activeModelId: localStorage.getItem('claude_active_model') || 'opus-4.6',

  loadApiKey: async () => {
    // Try encrypted storage first, fall back to localStorage
    const electronAPI = api()
    if (electronAPI?.secrets) {
      const result = await electronAPI.secrets.get('api_key')
      if (result?.success && result.value) {
        set({ defaultApiKey: result.value })
        return
      }
    }
    // Use localStorage value (already loaded in initial state)
  },

  addModel: (model) => set((state) => {
    const newModels = [...state.models, model]
    localStorage.setItem('claude_models', JSON.stringify(newModels))
    return { models: newModels }
  }),

  removeModel: (id) => set((state) => {
    const newModels = state.models.filter(m => m.id !== id)
    localStorage.setItem('claude_models', JSON.stringify(newModels))
    return { models: newModels }
  }),

  setDefaultApiKey: async (key) => {
    localStorage.setItem('claude_api_key', key)
    // Also try to save to encrypted storage if available
    const electronAPI = api()
    if (electronAPI?.secrets) {
      electronAPI.secrets.store('api_key', key).catch(() => {})
    }
    set({ defaultApiKey: key })
  },

  setDefaultBaseURL: (url) => {
    localStorage.setItem('claude_base_url', url)
    set({ defaultBaseURL: url })
  },

  setActiveModel: (id) => {
    localStorage.setItem('claude_active_model', id)
    set({ activeModelId: id })
  },

  getActiveModel: () => {
    const state = get()
    return state.models.find(m => m.id === state.activeModelId)
  },
}))
