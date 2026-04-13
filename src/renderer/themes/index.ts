/**
 * Theme system for Claude IDE
 */

export type ThemeId = 'pure-black' | 'clean-light'

export type ThemeDefinition = {
  id: ThemeId
  name: string
  type: 'dark' | 'light'
  colors: Record<string, string>
}

const pureBlack: ThemeDefinition = {
  id: 'pure-black',
  name: 'Pure Black',
  type: 'dark',
  colors: {
    '--bg-base': '#1a1a1a',
    '--bg-surface': '#141414',
    '--bg-overlay': '#111111',
    '--bg-muted': '#222222',
    '--bg-subtle': '#2a2a2a',
    '--border': '#252525',
    '--border-hover': '#333333',
    '--text': '#cccccc',
    '--text-secondary': '#999999',
    '--text-muted': '#666666',
    '--text-faint': '#444444',
    '--text-disabled': '#3a3a3a',
    '--accent': '#4db8b8',
    '--accent-hover': '#3da0a0',
    '--accent-bg': 'rgba(77,184,184,0.10)',
    '--success': '#4d9e6e',
    '--success-bg': 'rgba(77,158,110,0.10)',
    '--warning': '#b89550',
    '--warning-bg': 'rgba(184,149,80,0.10)',
    '--error': '#c05050',
    '--error-bg': 'rgba(192,80,80,0.10)',
    '--info': '#5090c0',
    '--info-bg': 'rgba(80,144,192,0.10)',
    '--pink': '#a06090',
    '--peach': '#b07850',
    '--scrollbar-track': '#141414',
    '--scrollbar-thumb': '#2e2e2e',
    '--scrollbar-thumb-hover': '#3e3e3e',
    '--monaco-theme': 'vs-dark',
  },
}

const cleanLight: ThemeDefinition = {
  id: 'clean-light',
  name: 'Clean Light',
  type: 'light',
  colors: {
    '--bg-base': '#f0ede8',
    '--bg-surface': '#e8e4de',
    '--bg-overlay': '#dedad4',
    '--bg-muted': '#d4cfc8',
    '--bg-subtle': '#c8c2ba',
    '--border': '#ccc7bf',
    '--border-hover': '#b8b2aa',
    '--text': '#1e1c1a',
    '--text-secondary': '#3d3a36',
    '--text-muted': '#6b6560',
    '--text-faint': '#9e9790',
    '--text-disabled': '#b0aaa3',
    '--accent': '#2563a8',
    '--accent-hover': '#1d4f8a',
    '--accent-bg': 'rgba(37,99,168,0.10)',
    '--success': '#2d6e45',
    '--success-bg': 'rgba(45,110,69,0.10)',
    '--warning': '#8a5c10',
    '--warning-bg': 'rgba(138,92,16,0.10)',
    '--error': '#a83228',
    '--error-bg': 'rgba(168,50,40,0.10)',
    '--info': '#2563a8',
    '--info-bg': 'rgba(37,99,168,0.10)',
    '--pink': '#8a3870',
    '--peach': '#a04e28',
    '--scrollbar-track': '#e0dbd4',
    '--scrollbar-thumb': '#bcb6ae',
    '--scrollbar-thumb-hover': '#a8a29a',
    '--monaco-theme': 'vs',
  },
}

export const THEMES: ThemeDefinition[] = [pureBlack, cleanLight]

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find(t => t.id === id) || pureBlack
}

export function applyTheme(id: ThemeId): void {
  const theme = getTheme(id)
  const root = document.documentElement

  root.setAttribute('data-theme', id)
  root.setAttribute('data-theme-type', theme.type)

  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value)
  }
}
