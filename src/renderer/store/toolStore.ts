import { create } from 'zustand'

export type ToolCallEntry = {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
  timestamp: number
  duration?: number
}

type ToolStore = {
  toolCalls: ToolCallEntry[]
  addToolCall: (call: ToolCallEntry) => void
  updateToolCall: (id: string, updates: Partial<ToolCallEntry>) => void
  clearToolCalls: () => void
}

const MAX_TOOL_CALLS = 200

export const useToolStore = create<ToolStore>((set) => ({
  toolCalls: [],

  addToolCall: (call) => set((state) => {
    const calls = [...state.toolCalls, call]
    // Auto-trim: drop oldest completed calls when over limit
    if (calls.length > MAX_TOOL_CALLS) {
      const trimmed = calls.filter(c => c.status === 'running' || c.status === 'pending')
      const completed = calls.filter(c => c.status !== 'running' && c.status !== 'pending')
      return { toolCalls: [...completed.slice(-MAX_TOOL_CALLS + trimmed.length), ...trimmed] }
    }
    return { toolCalls: calls }
  }),

  updateToolCall: (id, updates) => set((state) => ({
    toolCalls: state.toolCalls.map(c => {
      if (c.id !== id) return c
      // Truncate very large results to prevent memory bloat
      const merged = { ...c, ...updates }
      if (merged.result && merged.result.length > 50000) {
        merged.result = merged.result.slice(0, 50000) + '\n... (truncated)'
      }
      return merged
    }),
  })),

  clearToolCalls: () => set({ toolCalls: [] }),
}))
