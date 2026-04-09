import { create } from 'zustand'

export type RecentProject = {
  path: string
  name: string
  lastOpened: number
}

type ProjectStore = {
  recentProjects: RecentProject[]
  setRecentProjects: (projects: RecentProject[]) => void
  addRecentProject: (project: RecentProject) => void
  removeRecentProject: (path: string) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  recentProjects: [],

  setRecentProjects: (projects) => set({ recentProjects: projects }),

  addRecentProject: (project) => set((state) => {
    const filtered = state.recentProjects.filter(p => p.path !== project.path)
    return { recentProjects: [project, ...filtered].slice(0, 20) }
  }),

  removeRecentProject: (path) => set((state) => ({
    recentProjects: state.recentProjects.filter(p => p.path !== path),
  })),
}))
