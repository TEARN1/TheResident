# South African boundary data

`za-municipalities.json` holds the 213 South African municipalities as
simplified polygons, plus the district and province names they roll up into.
It is the input to `theresident_import_boundaries.sql`, which loads
`res_jurisdictions` — the table that decides which area an official may
broadcast to.

## Why only municipalities are in here

Districts, provinces and the national outline are all unions of these same
municipalities, so they are built in PostGIS on import rather than stored.
That keeps this file small and, more importantly, means the parent/child
containment `res_targetable_jurisdictions` depends on is computed by the same
engine that later tests it, instead of being computed elsewhere and hoped to
survive the trip.

## Why wards are NOT in here

**This is the important caveat.** The ward layer in the upstream source is
pre-2016. It references municipalities abolished in the 2016 amalgamations
(Camdeboo, Aganang, //Khara Hais) and is missing the twenty created at the same
time (Dr Beyers Naudé, Dawid Kruiper, Collins Chabane, Alfred Duma…). Its 4,277
wards are the 2011 set; there have been two redeterminations since.

Loading it would bind ward councillors to boundaries that no longer exist —
they would broadcast to the wrong residents, confidently, with a verified
badge. That is worse than having no ward data at all, so it is left out.

**To add wards:** download the current ward set from the Municipal Demarcation
Board (https://dataportal-mdb-sa.opendata.arcgis.com) and run:

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key> \
node scripts/import-boundaries.mjs \
  --file wards.geojson --level ward \
  --name-field WardLabel --ref-field WardID \
  --parent-level municipality --parent-ref-field MunicipalityID
```

Check the ward count first: it should be in the region of 4,468, not 4,277.

## Provenance and accuracy

- Source: https://github.com/RyzorBent/za-geojson — OCHA/HDX-derived
  administrative boundaries, `validOn` 2020-11-09, which is the 2016
  demarcation and remains current for provinces, districts and municipalities.
- Simplified to a ~110m tolerance and rounded to ~1m coordinates. A resident's
  home pin is rounded to about 1.1km when they choose "approximate", so this
  is comfortably inside the error already present in the containment test.
- Counts check out against the real country: 9 provinces, 44 district
  municipalities, 8 metros, 213 local-plus-metro municipalities.

Regenerate with `python3 scripts/prepare-boundaries.py` from a checkout of the
source repo (needs `shapely`).
