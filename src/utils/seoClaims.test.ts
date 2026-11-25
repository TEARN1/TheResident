import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// The public pages search engines read must not call listings, landlords or
// providers "verified" or "vetted" (nobody checks them), or call anything
// "official". The flyer's file name and "official emergency numbers" are fine.

const app = join(process.cwd(), 'src', 'app')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })

const publicFiles = [
  ...files(join(app, '(info)')),
  ...['layout.tsx', 'entity-schema.ts', 'public-services.ts', 'auth/layout.tsx', 'llms.txt/route.ts', 'llms-full.txt/route.ts', 'image-sitemap.xml/route.ts'].map(f => join(app, f)),
]

test('public pages make no verified, vetted or official claims', () => {
  for (const file of publicFiles) {
    const text = readFileSync(file, 'utf8')
      .replace(/the-resident-crew-official-flyer/g, '')
      .replace(/official emergency numbers/g, '')
    assert.doesNotMatch(text, /\b(verified|vetted|official|premier|guarantee[ds]?|certified|accredited)\b/i, file)
  }
})

test('the site description does not promise a fair-price check on every listing', () => {
  const layout = readFileSync(join(app, 'layout.tsx'), 'utf8')
  assert.doesNotMatch(layout, /every listing|You Can Trust/)
})
