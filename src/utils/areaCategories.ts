// The topics an official can file a notice under, and the mute keys that let a
// resident silence one without silencing the office. Backlog A5 and H5.
//
// WHY THIS FILE EXISTS. res_resolve_area_audience already honours a mute of
// 'res_area_broadcast:<category>', so a resident could always have muted
// library events while still hearing the police station. Nothing ever set a
// category, so every notice arrived uncategorised and the whole mechanism was
// dead — a resident's only choice was all area notices or none, which for a
// channel that reaches people who never opted in is the difference between a
// service and a nuisance.
//
// The list is deliberately short. A category a resident cannot confidently
// predict the meaning of is a category they will not mute, and one an official
// has to think hard about is one they will pick wrongly.

export interface AreaCategory {
  value: string
  label: string
  /** Shown to the official when choosing, so notices land under the right topic. */
  hint: string
}

export const AREA_CATEGORIES: AreaCategory[] = [
  { value: 'water',       label: 'Water',            hint: 'Shutdowns, burst mains, tanker schedules' },
  { value: 'electricity', label: 'Electricity',      hint: 'Outages, load reduction, cable faults' },
  { value: 'waste',       label: 'Refuse & waste',   hint: 'Collection days, missed routes, dumping' },
  { value: 'roads',       label: 'Roads & traffic',  hint: 'Closures, roadworks, detours' },
  { value: 'safety',      label: 'Safety',           hint: 'Crime alerts, missing persons, patrols' },
  { value: 'health',      label: 'Health',           hint: 'Clinic hours, vaccination drives, outbreaks' },
  { value: 'education',   label: 'Schools',          hint: 'Closures, registration, exam notices' },
  { value: 'library',     label: 'Library & culture', hint: 'Opening hours, study space, events' },
  { value: 'meetings',    label: 'Meetings',         hint: 'Ward meetings, public participation, consultations' },
  { value: 'other',       label: 'Other',            hint: 'Anything that does not fit above' }
]

/** Prefix the resolver matches on. Muting this silences every area notice. */
export const AREA_MUTE_ALL = 'res_area_broadcast'

/**
 * The mute key for one topic. Must match res_resolve_area_audience exactly —
 * it compares against `'res_area_broadcast:' || category`, so a mismatch here
 * silently mutes nothing at all rather than failing loudly.
 */
export function areaMuteKey(category: string): string {
  return `${AREA_MUTE_ALL}:${category}`
}

export function categoryLabel(value: string | null): string {
  if (!value) return 'General'
  return AREA_CATEGORIES.find(c => c.value === value)?.label ?? value
}

/**
 * Every mute option a resident is offered for area notices: the blanket one
 * first, then each topic.
 *
 * `critical` is never mutable and is not represented here — the server
 * delivers it regardless (res_resolve_area_audience) and the client plays it
 * regardless (shouldDeliver). Offering a control that does nothing would be
 * worse than offering none.
 */
export function areaMuteOptions(): { value: string; label: string }[] {
  return [
    { value: AREA_MUTE_ALL, label: 'All area notices (except emergencies)' },
    ...AREA_CATEGORIES.map(c => ({ value: areaMuteKey(c.value), label: `Area: ${c.label}` }))
  ]
}
