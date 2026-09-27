// Server-side reads of the public directories (the res_public_services and
// res_public_vendors views, which only hold listings whose owners chose
// "Show on Google").
// Plain PostgREST fetches with the anon key, so no session or cookies are
// involved and the pages can be cached.

export interface PublicService {
  id: string
  business_name: string
  category: string
  suburb: string | null
  city: string | null
  description: string | null
  price_estimate: string | null
  website_url: string | null
  image: string | null
  rating: number | null
  reviews_count: number | null
  updated_at: string | null
}

export interface PublicVendor {
  id: string
  name: string
  kind: string
  sells: string[] | null
  hours: string | null
  description: string | null
  suburb: string | null
  city: string | null
  updated_at: string | null
}

// Pages re-read the database at most once an hour.
export const REVALIDATE_SECONDS = 3600

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function query<T>(view: string, params: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(`${url}/rest/v1/${view}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return []
    return (await res.json()) as T[]
  } catch {
    return []
  }
}

export function listPublicServices(): Promise<PublicService[]> {
  return query<PublicService>('res_public_services', 'select=*&order=business_name.asc&limit=5000')
}

export function listPublicVendors(): Promise<PublicVendor[]> {
  return query<PublicVendor>('res_public_vendors', 'select=*&order=name.asc&limit=5000')
}

export async function getPublicVendor(slug: string): Promise<PublicVendor | null> {
  const id = slug.match(UUID_RE)?.[0]
  if (!id) return null
  const rows = await query<PublicVendor>('res_public_vendors', `select=*&id=eq.${id}`)
  return rows[0] ?? null
}

export async function getPublicService(slug: string): Promise<PublicService | null> {
  const id = slug.match(UUID_RE)?.[0]
  if (!id) return null
  const rows = await query<PublicService>('res_public_services', `select=*&id=eq.${id}`)
  return rows[0] ?? null
}

// "Joe's Plumbing" + id -> "joes-plumbing-<id>". The name is for people and
// Google; only the id is used to look the listing up.
export function serviceSlug(s: Pick<PublicService, 'id' | 'business_name'>): string {
  return slugFor(s.business_name, s.id)
}

export function vendorSlug(v: Pick<PublicVendor, 'id' | 'name'>): string {
  return slugFor(v.name, v.id)
}

function slugFor(title: string, id: string): string {
  const name = slugify(title)
  return name ? `${name}-${id}` : id
}

// "Bakkie / Transport" -> "bakkie-transport", "Mofolo North" -> "mofolo-north".
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Listing slugs end in the row's uuid; category slugs never do. That is how
// /services/<slug> tells a business page from a category page.
export function isListingSlug(slug: string): boolean {
  return UUID_RE.test(slug)
}

// The stock photo the app gives every new service. It is not a picture of
// the business, so it is kept out of the sitemap and structured data.
export const DEFAULT_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80'

export function realImage(url: string | null): string | null {
  return url && /^https:\/\//i.test(url) && url !== DEFAULT_SERVICE_IMAGE ? url : null
}

// --- Directory: services and shops as one list, for category and area pages ---

export type Section = 'services' | 'shops'

export const SECTION_LABELS: Record<Section, string> = {
  services: 'Local services',
  shops: 'Local shops',
}

export interface DirectoryEntry {
  id: string
  section: Section
  name: string
  href: string
  category: string
  categorySlug: string
  suburb: string | null
  city: string | null
  areaSlug: string | null
  description: string | null
  image: string | null
  updated_at: string | null
}

export async function listDirectory(): Promise<DirectoryEntry[]> {
  const [services, vendors] = await Promise.all([listPublicServices(), listPublicVendors()])
  return [
    ...services.map((s): DirectoryEntry => ({
      id: s.id,
      section: 'services',
      name: s.business_name,
      href: `/services/${serviceSlug(s)}`,
      category: s.category,
      categorySlug: slugify(s.category),
      suburb: s.suburb,
      city: s.city,
      areaSlug: s.suburb ? slugify(s.suburb) || null : null,
      description: s.description,
      image: realImage(s.image),
      updated_at: s.updated_at,
    })),
    ...vendors.map((v): DirectoryEntry => ({
      id: v.id,
      section: 'shops',
      name: v.name,
      href: `/shops/${vendorSlug(v)}`,
      category: VENDOR_KIND_LABELS[v.kind] ?? 'Local shop',
      categorySlug: v.kind,
      suburb: v.suburb,
      city: v.city,
      areaSlug: v.suburb ? slugify(v.suburb) || null : null,
      description: v.description,
      image: null,
      updated_at: v.updated_at,
    })),
  ]
}

// The suburb as people typed it, e.g. "Mofolo North" for "mofolo-north".
export function areaLabel(entries: DirectoryEntry[], areaSlug: string): string | null {
  return entries.find(e => e.areaSlug === areaSlug)?.suburb?.trim() ?? null
}

// Distinct values of key, in first-seen order.
export function distinct<T, K>(items: T[], key: (item: T) => K | null): K[] {
  const seen = new Set<K>()
  for (const item of items) {
    const k = key(item)
    if (k != null) seen.add(k)
  }
  return [...seen]
}

export function latest(entries: DirectoryEntry[]): string | undefined {
  return entries.map(e => e.updated_at).filter((d): d is string => !!d).sort().at(-1)
}

export const VENDOR_KIND_LABELS: Record<string, string> = {
  spaza: 'Spaza shop',
  food: 'Food & takeaways',
  produce: 'Fruit & veg',
  airtime: 'Airtime & data',
  gas: 'Gas',
  other: 'Local shop',
}

export function servicePlace(s: { suburb: string | null; city: string | null }): string {
  return [s.suburb, s.city].filter(Boolean).join(', ')
}
