export type ThemeId = 'minimal-green' | 'crimson-cyber' | 'liquid-glass' | 'midnight-violet'

export interface ThemeDefinition {
  id: ThemeId
  name: string
  subtitle: string
  accentColor: string
  accentSecondary: string
  accentName: string
  previewGradient: string
  glowColor: string
  mode: 'dark' | 'light'
  description: string
}

// Swatches mirror the token values in globals.css; the CSS is the source
// of truth for what actually renders.
export const APP_THEMES: ThemeDefinition[] = [
  {
    id: 'minimal-green',
    name: 'Emerald',
    subtitle: 'The Resident default',
    accentColor: '#6EE7B7',
    accentSecondary: '#107A5C',
    accentName: 'Mint',
    previewGradient: 'linear-gradient(135deg, #020D0E 0%, #041617 45%, #107A5C 80%, #6EE7B7 100%)',
    glowColor: 'rgba(110, 231, 183, 0.4)',
    mode: 'dark',
    description: 'Deep green-black glass with a bright mint signal colour.'
  },
  {
    id: 'crimson-cyber',
    name: 'Crimson',
    subtitle: 'High contrast',
    accentColor: '#FF4064',
    accentSecondary: '#9F1239',
    accentName: 'Neon red',
    previewGradient: 'linear-gradient(135deg, #050103 0%, #0A0306 45%, #9F1239 80%, #FF4064 100%)',
    glowColor: 'rgba(255, 64, 100, 0.45)',
    mode: 'dark',
    description: 'Near-black surfaces with a hot red accent and strong glow.'
  },
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    subtitle: 'Light mode',
    accentColor: '#4F46E5',
    accentSecondary: '#0891B2',
    accentName: 'Iris',
    previewGradient: 'linear-gradient(135deg, #FFFFFF 0%, #F1F5F9 45%, #A5B4FC 80%, #4F46E5 100%)',
    glowColor: 'rgba(79, 70, 229, 0.25)',
    mode: 'light',
    description: 'Bright frosted panels, dark text and an iris-blue accent. Best in daylight.'
  },
  {
    id: 'midnight-violet',
    name: 'Midnight',
    subtitle: 'Cosmic violet',
    accentColor: '#C084FC',
    accentSecondary: '#7E22CE',
    accentName: 'Lavender',
    previewGradient: 'linear-gradient(135deg, #05030D 0%, #0A0616 45%, #7E22CE 80%, #C084FC 100%)',
    glowColor: 'rgba(192, 132, 252, 0.4)',
    mode: 'dark',
    description: 'Deep violet night with a soft lavender glow.'
  }
]

export const DEFAULT_THEME: ThemeId = 'minimal-green'

export function getThemeDefinition(id: string | null | undefined): ThemeDefinition {
  const found = APP_THEMES.find(t => t.id === id)
  return found || APP_THEMES[0]
}
