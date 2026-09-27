import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isListingSlug } from '../../../../public-services'
import { CategoryView, categoryMetadata, loadCategory } from '../../../directory-views'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

// A category in one suburb, e.g. /shops/spaza/soweto. Only exists
// while that suburb has at least one listing in the category.
type Props = { params: Promise<{ slug: string; area: string }> }

async function load(slug: string, area: string) {
  return isListingSlug(slug) ? null : loadCategory('shops', slug, area)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, area } = await params
  return categoryMetadata(await load(slug, area))
}

export default async function CategoryInArea({ params }: Props) {
  const { slug, area } = await params
  const d = await load(slug, area)
  if (!d) notFound()
  return <CategoryView d={d} />
}
