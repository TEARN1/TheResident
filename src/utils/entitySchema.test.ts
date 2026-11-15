import test from 'node:test'
import assert from 'node:assert'
import { buildGlobalKnowledgeGraph, FOUNDER_IMAGES, FOUNDER_PROFILE } from '../app/entity-schema'

test('Knowledge Graph contains all 4 linked entities with distinct @id fragments', () => {
  const base = 'https://theresidentcrew.com'
  const kg = buildGlobalKnowledgeGraph(base)

  assert.strictEqual(kg['@context'], 'https://schema.org')
  assert.ok(Array.isArray(kg['@graph']))
  assert.strictEqual(kg['@graph'].length, 4)

  const byId = new Map<string, Record<string, unknown>>()
  for (const node of kg['@graph'] as Record<string, unknown>[]) {
    const id = node['@id'] as string
    assert.ok(id && id.startsWith(`${base}/#`), `Unexpected @id: ${id}`)
    byId.set(id, node)
  }

  assert.ok(byId.has(`${base}/#founder`), 'Missing #founder entity')
  assert.ok(byId.has(`${base}/#parent-org`), 'Missing #parent-org entity')
  assert.ok(byId.has(`${base}/#app`), 'Missing #app entity')
  assert.ok(byId.has(`${base}/#website`), 'Missing #website entity')
})

test('Founder and Parent Organization link The Resident Crew, The Gruvs, and Excellency Academy', () => {
  const base = 'https://theresidentcrew.com'
  const kg = buildGlobalKnowledgeGraph(base)
  const nodes = kg['@graph'] as Record<string, unknown>[]

  const founder = nodes.find(n => n['@id'] === `${base}/#founder`)!
  assert.strictEqual(founder.name, 'Asemahle "TEARN" Nkwali')
  assert.strictEqual(founder.jobTitle, 'Founder & CEO')
  assert.deepStrictEqual(founder.worksFor, { '@id': `${base}/#parent-org` })
  assert.deepStrictEqual(founder.mainEntityOfPage, { '@id': `${base}/founder#webpage` })
  assert.ok(Array.isArray(founder.knowsLanguage) && founder.knowsLanguage.includes('en-ZA'))
  assert.deepStrictEqual(founder.workLocation, { '@type': 'Place', name: 'Johannesburg, Gauteng, South Africa' })
  assert.ok(FOUNDER_IMAGES.some(img => img.path === '/founder/asemahle-tearn-nkwali-ceo-portrait.jpg'), 'FOUNDER_IMAGES must include CEO primary JPG')
  assert.ok(FOUNDER_IMAGES.some(img => img.path === '/founder/asemahle-nkwali-field-operations-johannesburg.jpg'), 'FOUNDER_IMAGES must include CEO field ops JPG')
  assert.ok(FOUNDER_IMAGES.some(img => img.path === '/founder/asemahle-tearn-nkwali-monochrome-portrait.jpg'), 'FOUNDER_IMAGES must include CEO monochrome JPG')
  assert.ok(FOUNDER_IMAGES.some(img => img.path === '/founder/asemahle-tearn-nkwali-tembisa-roots.jpg'), 'FOUNDER_IMAGES must include CEO Tembisa roots JPG')
  assert.ok(FOUNDER_IMAGES.some(img => img.path === '/founder/portrait.png'), 'FOUNDER_IMAGES must include /founder/portrait.png')
  assert.strictEqual((founder.image as unknown[]).length, FOUNDER_IMAGES.length)

  const parentOrg = nodes.find(n => n['@id'] === `${base}/#parent-org`)!
  assert.strictEqual(parentOrg.name, 'TEARN Ventures')
  assert.deepStrictEqual(parentOrg.founder, { '@id': `${base}/#founder` })
  assert.deepStrictEqual(parentOrg.foundingLocation, { '@type': 'Place', name: 'Johannesburg, Gauteng, South Africa' })
  assert.ok(Array.isArray(parentOrg.areaServed) && parentOrg.areaServed.length >= 6)

  const subOrgs = parentOrg.subOrganization as { name: string; url: string }[]
  assert.ok(subOrgs.some(o => o.name === 'The Resident Crew' && o.url === 'https://theresidentcrew.com'))
  assert.ok(subOrgs.some(o => o.name === 'The Gruvs' && o.url === 'https://thegruvs.com'))
  assert.ok(subOrgs.some(o => o.name === 'Excellency Academy' && o.url === 'https://excellencyacs.com'))

  const app = nodes.find(n => n['@id'] === `${base}/#app`)!
  assert.strictEqual(app.name, 'The Resident Crew')
  assert.strictEqual(app.applicationCategory, 'LifestyleApplication')
  assert.strictEqual(app.countriesSupported, 'ZA')
  assert.ok(Array.isArray(app.featureList) && app.featureList.length >= 5)
  assert.deepStrictEqual(app.creator, { '@id': `${base}/#founder` })
  assert.deepStrictEqual(app.publisher, { '@id': `${base}/#parent-org` })

  const website = nodes.find(n => n['@id'] === `${base}/#website`)!
  assert.deepStrictEqual(website.publisher, { '@id': `${base}/#parent-org` })
  assert.deepStrictEqual(website.copyrightHolder, { '@id': `${base}/#parent-org` })
})

test('Knowledge Graph and founder profile exclude GitHub URLs as requested', () => {
  const serialized = JSON.stringify(buildGlobalKnowledgeGraph('https://theresidentcrew.com'))
  assert.doesNotMatch(serialized, /github\.com/i)
  for (const url of FOUNDER_PROFILE.sameAs) {
    assert.doesNotMatch(url, /github\.com/i)
  }
})
