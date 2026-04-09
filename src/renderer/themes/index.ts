/**
 * Theme system for Claude IDE
 * Each theme defines CSS custom properties that components reference.
 */

export type ThemeId = 'catppuccin-mocha' | 'catppuccin-latte' | 'ayu-dark'

export type ThemeDefinition = {
  id: ThemeId
  name: string
  type: 'dark' | 'light'
  colors: Record<string, string>
}

const catppuccinMocha: ThemeDefinition = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  type: 'dark',
  colors: {
    '--bg-base': '#1e1e2e',
    '--bg-surface': '#181825',
    '--bg-overlay': '#11111b',
    '--bg-muted': '#313244',
    '--bg-subtle': '#45475a',
    '--border': '#313244',
    '--border-hover': '#45475a',
    '--text': '#cdd6f4',
    '--text-secondary': '#a6adc8',
    '--text-muted': '#6c7086',
    '--text-faint': '#45475a',
    '--text-disabled': '#585b70',
    '--accent': '#cba6f7',
    '--accent-hover': '#b490e0',
    '--accent-bg': 'rgba(203,166,247,0.1)',
    '--success': '#a6e3a1',
    '--success-bg': 'rgba(166,227,161,0.1)',
    '--warning': '#f9e2af',
    '--warning-bg': 'rgba(249,226,175,0.1)',
    '--error': '#f38ba8',
    '--error-bg': 'rgba(243,139,168,0.1)',
    '--info': '#89b4fa',
    '--info-bg': 'rgba(137,180,250,0.1)',
    '--pink': '#f5c2e7',
    '--peach': '#fab387',
    '--scrollbar-track': '#181825',
    '--scrollbar-thumb': '#45475a',
    '--scrollbar-thumb-hover': '#585b70',
    '--monaco-theme': 'vs-dark',
  },
}

const catppuccinLatte: ThemeDefinition = {
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  type: 'light',
  colors: {
    '--bg-base': '#eff1f5',
    '--bg-surface': '#e6e9ef',
    '--bg-overlay': '#dce0e8',
    '--bg-muted': '#ccd0da',
    '--bg-subtle': '#bcc0cc',
    '--border': '#ccd0da',
    '--border-hover': '#bcc0cc',
    '--text': '#4c4f69',
    '--text-secondary': '#5c5f77',
    '--text-muted': '#7c7f93',
    '--text-faint': '#9ca0b0',
    '--text-disabled': '#8c8fa1',
    '--accent': '#8839ef',
    '--accent-hover': '#7428d8',
    '--accent-bg': 'rgba(136,57,239,0.1)',
    '--success': '#40a02b',
    '--success-bg': 'rgba(64,160,43,0.1)',
    '--warning': '#df8e1d',
    '--warning-bg': 'rgba(223,142,29,0.1)',
    '--error': '#d20f39',
    '--error-bg': 'rgba(210,15,57,0.1)',
    '--info': '#1e66f5',
    '--info-bg': 'rgba(30,102,245,0.1)',
    '--pink': '#ea76cb',
    '--peach': '#fe640b',
    '--scrollbar-track': '#e6e9ef',
    '--scrollbar-thumb': '#bcc0cc',
    '--scrollbar-thumb-hover': '#9ca0b0',
    '--monaco-theme': 'vs',
  },
}

const ayuDark: ThemeDefinition = {
  id: 'ayu-dark',
  name: 'Ayu Dark',
  type: 'dark',
  colors: {
    '--bg-base': '#0b0e14',
    '--bg-surface': '#0d1017',
    '--bg-overlay': '#07090f',
    '--bg-muted': '#1c1f27',
    '--bg-subtle': '#2a2d35',
    '--border': '#1c1f27',
    '--border-hover': '#2a2d35',
    '--text': '#bfbdb6',
    '--text-secondary': '#9da1a8',
    '--text-muted': '#6c7086',
    '--text-faint': '#444b55',
    '--text-disabled': '#555b66',
    '--accent': '#e6b450',
    '--accent-hover': '#d4a43e',
    '--accent-bg': 'rgba(230,180,80,0.1)',
    '--success': '#7fd962',
    '--success-bg': 'rgba(127,217,98,0.1)',
    '--warning': '#e6b450',
    '--warning-bg': 'rgba(230,180,80,0.1)',
    '--error': '#d95757',
    '--error-bg': 'rgba(217,87,87,0.1)',
    '--info': '#59c2ff',
    '--info-bg': 'rgba(89,194,255,0.1)',
    '--pink': '#d2a6ff',
    '--peach': '#ffb454',
    '--scrollbar-track': '#0d1017',
    '--scrollbar-thumb': '#2a2d35',
    '--scrollbar-thumb-hover': '#3a3d45',
    '--monaco-theme': 'vs-dark',
  },
}

export const THEMES: ThemeDefinition[] = [catppuccinMocha, catppuccinLatte, ayuDark]

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find(t => t.id === id) || catppuccinMocha
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
