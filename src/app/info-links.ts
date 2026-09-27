// Public information pages. Shared by the footers and sitemap.ts so a new
// page only has to be added here to be linked and listed for search engines.
export const infoLinks = [
  { href: '/services', label: 'Local services' },
  { href: '/shops', label: 'Local shops' },
  { href: '/area', label: 'Areas' },
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const

// When the info page text last changed. Bump it when you edit those pages,
// so the sitemap tells Google to re-read them.
export const INFO_PAGES_UPDATED = '2026-09-27'
