"""
Prepare South African boundaries for res_jurisdictions.

WHAT IS SENT, AND WHY SO LITTLE. Only the 213 municipalities are transmitted.
Districts, provinces and the national outline are all unions of those same
municipalities, so they are built in PostGIS on arrival instead of being sent —
which cuts the payload from ~6MB to ~1MB and, more importantly, means the
parent/child containment that res_targetable_jurisdictions depends on is
computed by the same engine that will later test it, rather than by shapely
and hoped to survive the trip.

WARDS ARE DELIBERATELY NOT INCLUDED. The wards layer in this source is
pre-2016: it references municipalities abolished in the 2016 amalgamations
(Camdeboo, Aganang, //Khara Hais) and is missing the 20 created then (Dr Beyers
Naudé, Dawid Kruiper, Collins Chabane…). Loading it would bind councillors to
boundaries that stopped existing, so it is left out until a current
Municipal Demarcation Board ward set is available.

Source: https://github.com/RyzorBent/za-geojson (OCHA/HDX-derived admin
boundaries, validOn 2020-11-09 — the 2016 demarcation, which is current for
provinces, districts and municipalities).
"""
import json
from shapely.geometry import shape, mapping

TOLERANCE = 0.001   # ~110m; home pins are rounded to ~1.1km, so this is well inside existing error
COORD_DP  = 5       # ~1m

NAME_FIXES = {'Nothern Cape': 'Northern Cape'}   # misspelled in the source

def load(name):
    return json.load(open(f'{name}.json'))['features']

def clean(g):
    return g if g.is_valid else g.buffer(0)

def dumps_geo(geom):
    """Serialise with ~1m coordinates. The source carries 10+ decimal places —
    sub-millimetre — which is meaningless for deciding which municipality
    someone lives in and is the largest single contributor to payload size."""
    def rnd(o):
        return [rnd(x) for x in o] if isinstance(o, (list, tuple)) else round(o, COORD_DP)
    g = mapping(geom)
    return json.dumps({'type': g['type'], 'coordinates': rnd(g['coordinates'])},
                      separators=(',', ':'))

district_names = {f['properties']['ADM2_PCODE']: f['properties']['ADM2_EN'] for f in load('districts')}
province_names = {f['properties']['ADM1_PCODE']: NAME_FIXES.get(f['properties']['ADM1_EN'], f['properties']['ADM1_EN'])
                  for f in load('provinces')}

munis = []
for f in load('municipalities'):
    p = f['properties']
    g = clean(clean(shape(f['geometry'])).simplify(TOLERANCE, preserve_topology=True))
    munis.append({
        'name': p['ADM3_EN'], 'ref': p['ADM3_PCODE'],
        'district_ref': p['ADM2_PCODE'], 'province_ref': p['ADM1_PCODE'],
        'geometry': json.loads(dumps_geo(g))
    })

# A metro is a district containing exactly itself; its district row is dropped
# so a metro mayor is not offered "City of Tshwane" twice, and the municipality
# is parented straight to its province.
norm = lambda s: (s.replace(' Local Municipality', '')
                   .replace(' Metropolitan Municipality', '').strip().lower())
by_district = {}
for m in munis:
    by_district.setdefault(m['district_ref'], []).append(m)
metro_refs = {ref for ref, members in by_district.items()
              if len(members) == 1 and norm(members[0]['name']) == norm(district_names.get(ref, ''))}

meta = {
    'districts': [{'ref': r, 'name': district_names[r],
                   'province_ref': next(m['province_ref'] for m in by_district[r])}
                  for r in sorted(by_district) if r not in metro_refs],
    'provinces': [{'ref': r, 'name': n} for r, n in sorted(province_names.items())],
    'metro_district_refs': sorted(metro_refs)
}

json.dump({'municipalities': munis, 'meta': meta}, open('out/payload.json', 'w'))

sizes = [len(json.dumps(m['geometry'])) for m in munis]
print(f'{len(munis)} municipalities | {len(meta["districts"])} districts | '
      f'{len(meta["provinces"])} provinces | {len(metro_refs)} metros folded')
print(f'largest {max(sizes)/1024:.0f} KB, total {sum(sizes)/1024/1024:.2f} MB')
