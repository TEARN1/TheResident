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

export const APP_THEMES: ThemeDefinition[] = [
  {
    id: 'minimal-green',
    name: 'Minimal Emerald',
    subtitle: 'Creator Brands & Digital Products',
    accentColor: '#8EB69B',
    accentSecondary: '#235347',
    accentName: 'Emerald Sage',
    previewGradient: 'linear-gradient(135deg, #051F20 0%, #0B2B26 40%, #235347 70%, #8EB69B 100%)',
    glowColor: 'rgba(142, 182, 155, 0.35)',
    mode: 'dark',
    description: 'Deep forest greens (#051F20, #0B2B26) paired with soft sage (#8EB69B) and mint highlights (#DAF1DE).'
  },
  {
    id: 'crimson-cyber',
    name: 'Neon Crimson Glass',
    subtitle: 'High-Impact Cyberpunk UI',
    accentColor: '#FF2A4D',
    accentSecondary: '#8B0018',
    accentName: 'Neon Crimson',
    previewGradient: 'linear-gradient(135deg, #080305 0%, #1A050B 40%, #5C0817 75%, #FF2A4D 100%)',
    glowColor: 'rgba(255, 42, 77, 0.45)',
    mode: 'dark',
    description: 'Obsidian glass surfaces with intense neon red underglows, glossy specular pills, and high-contrast badges.'
  },
  {
    id: 'liquid-glass',
    name: 'Liquid Glass Frost',
    subtitle: 'Prismatic Neomorphic Elegance',
    accentColor: '#6366F1',
    accentSecondary: '#06B6D4',
    accentName: 'Prismatic Iris',
    previewGradient: 'linear-gradient(135deg, #F0F4F8 0%, #DDE7F0 40%, #C7D9EC 75%, #E8EEF5 100%)',
    glowColor: 'rgba(99, 102, 241, 0.25)',
    mode: 'light',
    description: 'Ultra-clean frosted glass tiles with smooth pill drop-shadows, iridescent pastel borders, and crisp dark text.'
  },
  {
    id: 'midnight-violet',
    name: 'Midnight Lavender Glass',
    subtitle: 'Deep Night & Cosmic Glow',
    accentColor: '#C084FC',
    accentSecondary: '#7E22CE',
    accentName: 'Cosmic Amethyst',
    previewGradient: 'linear-gradient(135deg, #090514 0%, #150D2A 40%, #341857 75%, #C084FC 100%)',
    glowColor: 'rgba(192, 132, 252, 0.4)',
    mode: 'dark',
    description: 'Dark royal violet glass with luminous magenta-lavender rim lighting, glossy floating capsules, and stellar accents.'
  }
]

export const DEFAULT_THEME: ThemeId = 'minimal-green'

export function getThemeDefinition(id: string | null | undefined): ThemeDefinition {
  const found = APP_THEMES.find(t => t.id === id)
  return found || APP_THEMES[0]
}
