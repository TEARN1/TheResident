#!/usr/bin/env node
/**
 * import-boundaries.mjs — load official boundary polygons into
 * res_jurisdictions, so that "a councillor cannot reach past their ward"
 * becomes a fact about geometry rather than a promise.
 *
 * The data is NOT bundled with this repo: the national ward set is tens of
 * megabytes and it is published, versioned and occasionally redetermined by
 * someone else. Fetch it and point this script at it.
 *
 * SOUTH AFRICA — Municipal Demarcation Board (https://dataportal-mdb-sa.opendata.arcgis.com)
 * publishes Wards, Local Municipalities, District Municipalities and
 * Provinces as GeoJSON. Download the layer you want, then:
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
 *   node scripts/import-boundaries.mjs \
 *     --file wards.geojson \
 *     --level ward \
 *     --name-field WardLabel \
 *     --ref-field WardID \
 *     [--parent-level municipality --parent-ref-field MunicipalityID] \
 *     [--dry-run]
 *
 * Import parents before children (provinces, then municipalities, then
 * wards) so the parent lookup resolves.
 *
 * Writes go through res_upsert_jurisdiction, which is service-role only and
 * upserts on (level, external_ref) — so re-running after a redetermination
 * updates a ward in place rather than creating a second one that would then
 * double-notify everyone inside it.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = name => process.argv.includes(`--${name}`)

const file = arg('file')
const level = arg('level')
const nameField = arg('name-field')
const refField = arg('ref-field')
const parentLevel = arg('parent-level')
const parentRefField = arg('parent-ref-field')
const dryRun = has('dry-run')

const LEVELS = ['ward', 'municipality', 'district', 'province', 'national', 'service_area']

if (!file || !level || !nameField) {
  console.error('Missing required arguments. See the header of this file for usage.')
  process.exit(1)
}
if (!LEVELS.includes(level)) {
  console.error(`--level must be one of: ${LEVELS.join(', ')}`)
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !serviceKey)) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (service role — this writes boundaries).')
  process.exit(1)
}

const geo = JSON.parse(readFileSync(file, 'utf8'))
const features = geo.type === 'FeatureCollection' ? geo.features : [geo]
if (!Array.isArray(features) || features.length === 0) {
  console.error('No features found in that file.')
  process.exit(1)
}

console.log(`${features.length} features, importing as level "${level}"${dryRun ? ' (dry run)' : ''}`)

const client = dryRun ? null : createClient(url, serviceKey, { auth: { persistSession: false } })

let ok = 0
let skipped = 0
const failures = []

for (const [i, feature] of features.entries()) {
  const props = feature.properties || {}
  const name = props[nameField]
  const ref = refField ? props[refField] : null
  const parentRef = parentRefField ? props[parentRefField] : null

  if (!name || !feature.geometry) {
    skipped++
    continue
  }

  if (dryRun) {
    if (i < 5) console.log(`  would import: ${name}${ref ? ` (${ref})` : ''}`)
    ok++
    continue
  }

  const { error } = await client.rpc('res_upsert_jurisdiction', {
    p_name: String(name),
    p_level: level,
    p_external_ref: ref != null ? String(ref) : null,
    p_geojson: JSON.stringify(feature.geometry),
    p_parent_ref: parentRef != null ? String(parentRef) : null,
    p_parent_level: parentLevel
  })

  if (error) {
    failures.push(`${name}: ${error.message}`)
  } else {
    ok++
    // Boundary files run to thousands of features; a heartbeat beats silence.
    if (ok % 100 === 0) console.log(`  ${ok}/${features.length}…`)
  }
}

console.log(`\nDone. imported/updated: ${ok}, skipped (no name or geometry): ${skipped}, failed: ${failures.length}`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures.slice(0, 20)) console.log(`  - ${f}`)
  if (failures.length > 20) console.log(`  …and ${failures.length - 20} more`)
  process.exit(1)
}
