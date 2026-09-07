/**
 * Theme resolution, in one place.
 *
 * THE BUG THIS REPLACES. The boot script read:
 *
 *     document.documentElement.setAttribute(
 *       'data-theme', t === 'light' ? 'light' : 'night')
 *
 * Anything that was not the exact string 'light' became dark — including the
 * case that matters most, having never chosen at all. `prefers-color-scheme`
 * was never consulted, so a resident whose phone is set to light mode still
 * got a dark app, permanently, with no indication that a choice existed.
 * Combined with a dashboard built from hardcoded dark utilities, that is why
 * the app felt inescapable.
 *
 * There are THREE states, not two. "System" is a real choice and it is the
 * default: no attribute on the root element, so the media query in tokens.css
 * decides. Only an explicit choice stamps an attribute, and it then wins over
 * the operating system in both directions.
 */

export type Theme = 'light' | 'dark' | 'system'

export const THEME_KEY = 'residentTheme'

/** Normalise anything found in storage, including the legacy 'night'. */
export function parseTheme(stored: string | null | undefined): Theme {
  if (stored === 'light') return 'light'
  // 'night' was the old name for the same thing. Read it so a resident who
  // deliberately chose dark before this change keeps what they chose.
  if (stored === 'dark' || stored === 'night') return 'dark'
  return 'system'
}

/** What the viewer will actually SEE, given their choice and their device. */
export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

/**
 * The script that runs before React hydrates, to avoid a flash of the wrong
 * theme. Kept here as a string so the logic lives beside its tests rather
 * than only inside a dangerouslySetInnerHTML in the layout.
 */
export const THEME_BOOT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    if (t === 'light') { document.documentElement.setAttribute('data-theme','light'); }
    else if (t === 'dark' || t === 'night') { document.documentElement.setAttribute('data-theme','dark'); }
    else { document.documentElement.removeAttribute('data-theme'); }
  } catch (e) {
    document.documentElement.removeAttribute('data-theme');
  }
})();`

/** Apply a choice: stamp an attribute, or remove it to follow the device. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try { localStorage.setItem(THEME_KEY, theme) } catch { /* private mode */ }
}

/** Read the stored choice. Safe on the server and in private browsing. */
export function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system'
  try { return parseTheme(localStorage.getItem(THEME_KEY)) } catch { return 'system' }
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
