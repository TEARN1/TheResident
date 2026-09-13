# The Resident — Design Overhaul: 200 Changes

**Direction: light and warm by default, with a real dark mode.**
Gold stays. Black goes.

---

## Why this document exists

You said the app is dark, that you are not happy with it, and that the
responsiveness needs checking. All three are true, and this is what the
measurements say rather than what taste says.

### What was measured, not guessed

| Finding | Measured value |
|---|---|
| Body text contrast (`text-gray-500` on `#0a0a0a`) | **4.10:1 — fails WCAG AA (4.5:1)**, and it is used **355 times** |
| Hardcoded colour values across the app | **~2,100**, in **50 of 67** `.tsx` files |
| Smallest tap target on `/dashboard/housing` | **11px** (Apple's floor is 44px, Google's is 48px) |
| Tap targets under 44px, per dashboard screen | **19–22** |
| Text rendered under 12px, per dashboard screen | **21** |
| Elements clipped off-screen on the landing page | **10 at 320px, 6 at 360px and 390px** |
| Layout change between a 320px phone and a 1024px tablet | **None. The dashboard renders identically.** |

### The root cause

`globals.css` already admits it, in a comment written by whoever last touched
the theme:

> *"The dashboard forces `data-theme="night"` on every mount and is built
> almost entirely from hardcoded dark Tailwind utilities (`text-white`,
> `bg-black`, …) rather than these variables, so it can never honor a real
> light mode without that being rewritten wholesale."*

That is the whole problem in one sentence. The app does not *have* a theme —
it has a colour scheme painted onto 2,100 individual elements. It feels
inescapably dark because it is inescapable: there is no switch to throw.

So the first 22 items below are not visual at all. They build the layer that
makes the other 178 possible, and cheap.

### The order matters

Sections A–B first, always. Tokenising the colours makes every later change a
one-line edit instead of a fifty-file search. Doing the visible work first
means doing it twice.

---

## A. Foundations — the token layer (1–22)

*Nothing here changes how the app looks. Everything here decides how much
every later change costs.*

1. Create `src/styles/tokens.css` as the single source of colour, spacing,
   radius, shadow and type scale. Today these live in `globals.css`
   variables, Tailwind config, and 2,100 inline utilities simultaneously.
2. Define colour tokens by **role**, never by value: `--surface`,
   `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`,
   `--text-subtle`, `--border`, `--accent`, `--accent-contrast`.
3. A rule that pays for itself: no component may name a colour. If a `.tsx`
   file contains `#`, `bg-black`, or `text-white`, it is a bug.
4. Map every existing hardcoded utility to a token, mechanically. Script it:
   `bg-black` → `bg-surface`, `text-white` → `text-primary`,
   `text-gray-500` → `text-muted`, `border-white/10` → `border-default`.
5. Extend `tailwind.config.ts` so the tokens are real Tailwind colours —
   `bg-surface`, `text-muted` — so the codebase keeps reading as Tailwind.
6. Add semantic status tokens: `--success`, `--warning`, `--danger`,
   `--info`. Today danger is `text-red-400` in some files and `#ef4444` in
   others, so "error" does not look the same twice.
7. Define elevation as tokens (`--elevation-1` … `--elevation-4`) rather than
   ad-hoc `shadow-lg` / `border-white/10` / `bg-white/5` combinations.
8. Define a radius scale (`--radius-sm/md/lg/full`). Count the distinct
   `rounded-*` values in use first; expect a dozen where three would do.
9. Define a spacing scale and use only it. Ban arbitrary `p-[13px]` values.
10. Define one type scale (see section C) as tokens, not per-component sizes.
11. Define motion tokens: `--duration-fast/base/slow`, `--ease-out`,
    `--ease-spring`. Currently every transition picks its own timing.
12. Define `--focus-ring` once. Focus styling is currently inconsistent or
    absent, which is both an accessibility failure and a polish failure.
13. Define layout tokens: `--content-max`, `--gutter`, `--nav-height`,
    `--header-height`. The bottom-nav height is currently guessed at in
    `.dashboard-page-body { padding-bottom: 5rem }` with a comment admitting
    it is "a deliberately generous flat estimate".
14. Delete `[data-theme='night']` as a separate theme. There should be two
    themes, light and dark, not three overlapping ones.
15. Remove the forced `data-theme="night"` on dashboard mount. This single
    line is what makes the app inescapable.
16. Make theme resolution: explicit user choice → `prefers-color-scheme` →
    light. Store the choice; default to following the phone.
17. Add `color-scheme: light dark` on `:root` so native form controls,
    scrollbars and the browser's own chrome follow the theme too. Right now a
    date picker or select dropdown will appear in the wrong theme.
18. Set `<meta name="theme-color">` per theme so the Android status bar and
    iOS Safari chrome match the app instead of clashing with it.
19. Update `manifest.json`'s `background_color` and `theme_color` — the PWA
    splash screen currently flashes black before a light app loads.
20. Write a token reference page at `/dev/tokens` (dev-only, like the
    Automation Hub gate) showing every token in both themes side by side.
    You cannot keep a system consistent that you cannot see.
21. Add a unit test asserting no `.tsx` file contains a raw hex colour or a
    banned utility. This is what stops the 2,100 from creeping back.
22. Add a test asserting every colour token is defined in **both** themes. A
    token defined only in light is a component that vanishes in dark.

---

## B. Colour and the two themes (23–44)

*The gold is your brand and it stays. What goes is pure black, and grey text
too dim to read.*

23. **Light theme surface: `#FAF8F3`**, a warm off-white. Not `#FFFFFF` —
    pure white glares on a phone held outdoors, which is where this app is
    used.
24. **Light theme text: `#1A1712`**, a warm near-black. Not `#000000`; pure
    black on white is harsh and reads as unfinished.
25. **Light theme accent: `#8A6A19`.** Your gold `#D4AF37` scores only
    1.9:1 on a light background — invisible. Darkened it passes at 4.6:1 and
    still reads unmistakably as gold.
26. Keep `#D4AF37` as the dark-theme accent, where it scores 9.42:1 and looks
    genuinely good.
27. **Dark theme surface: `#16140F`**, a warm charcoal, not `#0a0a0a`. Pure
    black is what makes a dark theme feel like a void rather than a room.
28. Dark theme raised surface `#211E17`, sunken `#100E0A`. Three levels, so
    cards read as objects sitting on something.
29. **Replace `text-gray-500` everywhere.** At 4.10:1 it fails AA and it is
    your most-used text colour, 355 times. This is the single highest-impact
    change in this document.
30. Light `--text-muted: #5A5348` (7.1:1). Dark `--text-muted: #A9A296`
    (7.4:1). Both comfortably pass, both still read as secondary.
31. `--text-subtle` for genuinely tertiary text, held at 4.6:1 minimum — the
    floor, not the target.
32. Audit every remaining colour pair with a script and fail the build under
    4.5:1 for body text, 3:1 for large text and UI boundaries.
33. Promote the three accent colours (`teal`, `violet`, `rose`) from
    decoration to meaning. Right now they exist only as background glows on
    the landing page while the entire app speaks in one colour.
34. Assign each dashboard section a consistent accent so Housing, Community,
    Services and Safety are identifiable at a glance, not by reading labels.
35. Make status colours carry real meaning: available/vacant, pending,
    approved, overdue. Currently a service report's urgency and a listing's
    status use unrelated colour languages.
36. Remove the black-on-gold button as the only primary action style. It is
    handsome once and monotonous by the fortieth time.
37. Define a proper button hierarchy: primary (filled accent), secondary
    (outlined), tertiary (text only), destructive (danger).
38. Never rely on colour alone for state. Add an icon or text label wherever
    colour currently carries the meaning — colour-blind users, and anyone in
    bright sun, get nothing from a hue shift.
39. Replace the `glass-panel` treatment (126 uses) in light mode. Frosted
    glass over a light background is mud; it needs real surfaces and shadows.
40. Keep a restrained glass effect in dark mode only, where it works.
41. Drop `backdrop-filter: blur(16px)` on the bottom nav for lower-end
    Android. It is one of the most expensive properties to composite and this
    app's users are not all on flagships.
42. Replace decorative background gradient blobs with a single subtle warm
    wash. They currently overflow the viewport (measured: `glowBlob` sits at
    x=-29 and x=427 on a 390px screen) and cost paint time for atmosphere.
43. Give images and avatars a token-coloured placeholder so a slow connection
    shows a warm block, not a black hole.
44. Re-tint every icon through tokens. Icons are currently a mix of
    `text-gold-primary` (281 uses), `text-white` and inherited grey.

---

## C. Typography (45–62)

*21 elements per screen render below 12px. That is the reason it feels
cramped as much as the colour is the reason it feels dark.*

45. Set a type scale and use nothing outside it: 12 / 14 / 16 / 18 / 20 / 24
    / 30 / 36 / 48px.
46. **Body text minimum 16px.** Anything smaller triggers zoom-on-focus in
    iOS Safari and is hard work in daylight.
47. **Absolute minimum for any text: 12px**, and only for genuine metadata —
    timestamps, counts. Never for content, never for labels.
48. Fix the bottom-nav labels, currently `0.55rem` (8.8px) after my own
    narrow-screen fix. That fix bought the layout at the cost of legibility;
    the real answer is fewer nav items (see 121–124), not smaller text.
49. Replace `font-family: Arial, Helvetica, sans-serif` — the current stack —
    with a proper system stack: `-apple-system, BlinkMacSystemFont, "Segoe
    UI", Roboto, "Helvetica Neue", sans-serif`. Arial is a 1982 default and
    reads like one.
50. Consider one display face for headings only, self-hosted and subset, to
    give the brand a voice. Body stays system for speed.
51. Set line-height by role: 1.2 headings, 1.5 body, 1.4 UI labels. Currently
    inherited and inconsistent.
52. Cap measure at 65–75 characters. On tablet the body text currently runs
    the full width, which is unreadable.
53. Reduce the uppercase-with-wide-letterspacing treatment. It is used for
    almost every label and it shouts; reserve it for section headers.
54. Reduce `font-black` (900 weight) usage. Everything being heaviest means
    nothing is emphasised.
55. Establish weight hierarchy: 600 headings, 500 UI labels, 400 body.
56. Use tabular figures for prices, counts and dates so numbers stop jittering
    as they update.
57. Standardise currency formatting — "R2 000" per South African convention,
    one helper, one place.
58. Standardise dates and relative times ("3 days ago"). Currently formatted
    ad hoc per component.
59. Truncate long names and titles with ellipsis and a tooltip, not by letting
    them break the layout.
60. Allow two-line clamping for card titles rather than one-line truncation
    that cuts a room's description mid-word.
61. Check every string in the 11 supported languages for length overflow.
    isiXhosa and Sesotho translations run materially longer than English and
    will break tight layouts first.
62. Set `hyphens: auto` and `overflow-wrap: anywhere` on user content so a
    pasted URL cannot widen the page.

---

## D. Spacing and layout rhythm (63–78)

63. Adopt a 4px base spacing unit and use only multiples of it.
64. Set consistent page gutters via `--gutter`: 16px phone, 24px tablet,
    32px desktop. Currently `px-4` is assumed everywhere.
65. Set consistent vertical rhythm between sections — one value, not per-page
    guesses.
66. Fix the large dead gap on the landing page between the CTA stack and the
    first feature card. It reads as a broken page, not as breathing room.
67. Standardise card padding. Currently `p-5`, `p-4`, `p-6` and `p-[1.5rem]`
    all appear.
68. Standardise the gap between stacked cards in a list.
69. Give every screen a consistent header treatment: title, optional subtitle,
    optional action. Today each page invents its own.
70. Replace `.dashboard-page-body { padding-bottom: 5rem }` — the admitted
    guess — with a value derived from the real nav height plus
    `env(safe-area-inset-bottom)`.
71. Respect `env(safe-area-inset-*)` on all four edges for notched phones.
    Currently only the bottom nav does, and only partially.
72. Fix the landing header: logo, "LOG IN" and "Join Your Suburb" currently
    fight for 390px, "LOG IN" wraps onto two lines and the button is cut off.
73. Give the landing page a single primary CTA. Three stacked buttons
    ("Enter Portal", "Download Android APK", "Install on iPhone") is three
    ways of saying "we don't know what you want".
74. Move the APK and iPhone install options behind one "Get the app" control.
75. Set a max content width so text does not run edge to edge on tablet.
76. Align icon-and-text pairs on a shared baseline; several are currently
    optically off.
77. Standardise the list-row height and internal padding across Messages,
    Notifications and Requests, which currently differ.
78. Remove nested cards-within-cards, which double the border and padding and
    make the hierarchy unreadable.

---

## E. Responsiveness (79–104)

*Measured: the dashboard renders identically at 320px and 1024px. There is no
responsive behaviour above phone at all.*

79. Define the breakpoint set once — 480 / 768 / 1024 / 1280 — and document
    what changes at each.
80. **Design for 320px first.** 10 elements are clipped there on the landing
    page. iPhone SE and older Androids are common in South Africa.
81. Fix the 6 elements clipped at 360px — the most common Android width in
    this market.
82. Fix the landing header overflow specifically (items 72–74).
83. Fix the feature cards clipping at the right edge on all phone widths.
84. Constrain the decorative glow blobs, currently measured at x=-29 and
    x=427 in a 390px viewport.
85. Give the dashboard a genuine tablet layout at 768px: two columns, not one
    phone column stretched.
86. Give the dashboard a desktop layout at 1024px: persistent left sidebar
    replacing the bottom nav.
87. Above 768px, switch primary navigation from bottom bar to sidebar. A
    bottom nav on a laptop is a phone app in a browser window.
88. Make the map view use the extra space on tablet — map plus list side by
    side rather than a stretched phone map.
89. Make listing and room cards a responsive grid: 1 column phone, 2 tablet,
    3 desktop.
90. Make the profile page two-column above 768px.
91. Make forms max-width constrained rather than full-bleed on tablet.
92. Make modals and sheets responsive: full-screen sheet on phone, centred
    dialog on tablet and up.
93. Make tables scroll inside their own container, never widen the page.
94. Make image galleries responsive rather than fixed-size.
95. Test and fix landscape phone orientation, which is currently unconsidered.
96. Handle the keyboard-open state on phones so the focused input is not
    hidden behind the keyboard.
97. Use `dvh` rather than `vh` for full-height layouts so mobile browser
    chrome does not cause a jump.
98. Audit every `100vw` — the `/auth` overflow came from exactly this and
    there may be more.
99. Make the bottom nav adapt: labels on wider phones, icons only on 320px.
100. Support text zoom to 200% without breaking layout — an accessibility
     requirement and a real one for older users.
101. Respect `prefers-reduced-motion` everywhere, not only the urgent-banner
     pulse where it is currently handled.
102. Test on a real low-end Android, not only a resized desktop browser.
     Emulation does not reproduce paint cost.
103. Extend `scripts/smoke.mjs` to run every route at 320 / 390 / 768 / 1024
     rather than only 390.
104. Fail CI on any clipped element, not only on document-level overflow —
     the current check would not have caught the landing page's 6.

---

## F. Touch and ergonomics (105–120)

*Measured: 19–22 tap targets under 44px per dashboard screen, smallest 11px.*

105. **Minimum tap target 44×44px, everywhere, no exceptions.** This alone
     fixes the most common "the app feels broken" complaint.
106. Fix the 11px target on `/dashboard/housing` first — it is effectively
     unhittable.
107. Where a control must look small, keep the visual size and expand the hit
     area with padding or a pseudo-element.
108. Space adjacent targets at least 8px apart so thumbs do not mis-tap.
109. Move primary actions into the thumb zone — the lower half of the screen —
     rather than the top-right corner.
110. Make entire cards tappable, not just the small link inside them.
111. Add `:active` states to everything tappable. Without them a tap on a slow
     connection feels ignored, and the user taps again.
112. Set `touch-action: manipulation` to remove the 300ms tap delay.
113. Remove hover-only affordances. On a touch device, hover does not exist,
     and several controls currently only reveal themselves on hover.
114. Add swipe-to-dismiss on notifications and toasts.
115. Add pull-to-refresh on the feed and listing views.
116. Make destructive actions require confirmation and never sit adjacent to a
     common action.
117. Make form inputs at least 48px tall with 16px text.
118. Set correct `inputmode` and `autocomplete` on every field — `email`,
     `tel`, `numeric` for prices. This is a large, cheap win on mobile.
119. Make the whole label tappable for checkboxes and radios.
120. Ensure the bottom nav clears the iOS home indicator.

---

## G. Components (121–150)

121. **Reduce the bottom nav from six items to five.** Six does not fit;
     that is why the labels are at 8.8px. Five at 16px is better than six at
     nine.
122. Move the least-used destination into the profile or a "More" sheet.
123. Give the active nav item a stronger indicator than a 2px top border.
124. Add unread badges to Messages and Feed in the nav.
125. Rebuild the card component once, properly, and use it everywhere. There
     are currently at least four different card treatments.
126. Give cards a real elevation system rather than `border-white/10`.
127. Rebuild the button component with the hierarchy from item 37.
128. Give every button a loading state that disables it and shows progress.
     Double-submission is currently possible on several forms.
129. Rebuild form inputs: consistent height, focus ring, error state, helper
     text.
130. Show validation inline and on blur, not only on submit.
131. Rebuild the modal/sheet component per item 92.
132. Rebuild toasts: consistent position, duration, and dismiss.
133. Build a proper avatar component with initials fallback, since many
     residents will have no photo.
134. Build a badge/chip component for statuses, tiers and categories.
135. Build a tabs component. Tabs are currently reimplemented per screen.
136. Build a segmented control for binary and ternary choices.
137. Build a bottom sheet for filters rather than inline expanding panels.
138. Build a search input with clear button and debounce as one component.
139. Rebuild the listing card: photo, price, area, key facts, in that order.
140. Rebuild the room card for the inventory view with the same language.
141. Rebuild the message list row to a standard list-row component.
142. Rebuild the notification row, and make the whole row tappable (item 110).
143. Design the service-report card around its clock — elapsed time is the
     point of that feature and should be its most prominent element.
144. Design the provider performance card as a real data display, not text.
145. Rebuild the map marker and popup styling to match the token system.
146. Rebuild the trust-circle visualisation, currently the least designed
     screen.
147. Design the verification-status display as a clear progress sequence.
148. Build a consistent section-header component (item 69).
149. Build a consistent page-header component with back navigation.
150. Build a stat/metric tile for the occupancy and performance figures.

---

## H. Motion and feedback (151–162)

151. Use the motion tokens from item 11 everywhere; remove ad-hoc durations.
152. Keep all transitions between 150ms and 250ms. Slower feels sluggish on a
     phone.
153. Animate only `transform` and `opacity`. Anything else costs layout on
     low-end Android.
154. Fix the landing page's scroll-reveal: the "Safety Net" card was captured
     mid-animation and is barely legible. Content must be readable even if
     the animation never runs.
155. Never let content start at zero opacity without a no-JS fallback.
156. Add skeleton loaders for lists, replacing spinner-only states.
157. Add optimistic UI for likes, follows and acknowledgements.
158. Add a page-transition treatment so navigation feels connected.
159. Animate the bottom-nav active indicator between items.
160. Add haptic feedback on key actions where the browser supports it.
161. Add a subtle success animation on completing the core loop — a room
     request sent, a report filed.
162. Honour `prefers-reduced-motion` for every one of the above.

---

## I. Empty, loading and error states (163–176)

163. Design a real empty state for every list. With almost no production data,
     **empty is the state most of your first users will see** — it is the
     first impression, not an edge case.
164. Fix `/dashboard/messages`, which shows "Loading conversations…"
     indefinitely for a guest who can have no conversations.
165. Distinguish "nothing yet" from "nothing matches your filter" from
     "failed to load". These are three different messages and currently
     render the same.
166. Give every empty state a next action, not just an explanation.
167. Write empty-state copy in your own voice, not "No data available".
168. Add illustrations or icons to empty states so they read as designed.
169. Replace bare spinners with skeletons matching the content shape.
170. Add a minimum display time for loaders so they do not flash.
171. Design the offline state — the app has an offline queue but does not
     visibly tell the user it is working.
172. Design the error state with a retry action, not a dead end.
173. Make error messages say what to do next, not what went wrong internally.
174. Add an error boundary fallback that looks designed rather than broken.
175. Design the guest-mode state consistently — currently a banner on some
     screens and nothing on others.
176. Design the "not verified yet" state, which gates several features and is
     currently just an absence.

---

## J. Accessibility (177–190)

177. Meet WCAG AA contrast throughout — item 29 is the largest part of this.
178. Add a visible focus ring on every interactive element (item 12).
179. Ensure full keyboard navigability, including modals and sheets.
180. Add skip-to-content on every page.
181. Add proper ARIA labels to all icon-only buttons.
182. Use correct landmark elements — `nav`, `main`, `header`, `aside`.
183. Fix heading hierarchy; do not skip levels for visual size.
184. Announce dynamic content changes with live regions — new messages,
     new alerts.
185. Make all form errors programmatically associated with their inputs.
186. Add `alt` text to every image, and empty `alt` for decorative ones.
187. Trap focus in modals and restore it on close.
188. Test with a screen reader on the core loop, at minimum.
189. Support 200% text zoom (item 100).
190. Ensure the urgent-alert banner is announced assertively — it is the one
     component where this genuinely matters for safety.

---

## K. Guardrails so none of this comes back (191–200)

*Every previous cleanup in this project regressed because nothing enforced
it. These ten items are what make the other 190 permanent.*

191. Add the raw-colour lint from item 21 to CI.
192. Add the both-themes token test from item 22 to CI.
193. Add automated contrast checking to CI, failing under AA.
194. Add tap-target size checking to the smoke test, failing under 44px.
195. Add multi-viewport rendering to the smoke test (item 103).
196. Add clipped-element detection to CI (item 104).
197. Add visual regression snapshots for the core screens in both themes.
198. Publish the token reference page (item 20) and keep it current.
199. Write a short `docs/DESIGN-SYSTEM.md` covering when to use what.
200. Add a design review step to the PR template: screenshots at 320px and
     768px, in both themes, before merge.

---

## Progress

**Done and pushed: 146 of 200.** Phases 1 and 2 complete, most of 3, section G's
component library (121-138, 148-150), and the guardrails from 6 that keep them
from regressing.

Section G landed as `src/components/ui/`: Button with the full hierarchy and a
loading state that disables, Avatar, Badge, Field, Tabs, SegmentedControl,
SearchInput, PageHeader, SectionHeader, StatTile. The bottom nav went from six
items to five (121-124), which is what finally let the labels be readable at
320px instead of 8.8px or hidden.

Section I (empty, loading and error states) is done: EmptyState now tells
"nothing yet" from "nothing matches" from "failed to load" from "offline",
skeletons replace bare spinners on the feed and the message list, loaders are
held to a readable minimum, and the guest / unverified gates are a designed
state rather than an absence.

Section H (motion) is largely done: the --duration-* tokens are used rather
than bypassed, every transition sits in the 150-250ms band, reduced motion has
one global backstop instead of per-component guards, the nav indicator
animates on transform and opacity only, and haptics exist for committed
actions. Optimistic likes (157) were already in place.

Still open in H: page transitions (158) and the core-loop success animation
(161).

Section J: the contrast, focus ring, skip link, landmarks and alt-text work
landed earlier; this pass adds the modal focus trap with focus restore (179,
187) and one polite live region for realtime changes (184). The urgent banner
was already assertive (190).

Still open in J: a real screen-reader pass on the core loop (188) and 200%
zoom (189) — both need a human at a device, not a static check.

Section K: the raw-colour lint, both-themes token test, multi-viewport smoke,
overflow and tap-target checks were already in CI; this pass adds contrast
coverage for surface-sunken and the area accents (193), a named navigation
invariant in place of pixel snapshots (197), docs/DESIGN-SYSTEM.md (199) and
a PR template with a design-review step (200).

Still open in K: the published token reference page (198).

Section G's domain cards are part-done: the notification row (142/110), the
service-report clock (143), the provider performance display (144) and the
message list row (141). The listing card (139) and the verification-status sequence (147) are done
too. Still open there: the room card (140), map markers (145) and the
trust-circle visualisation (146).

Previously open in G: the domain cards (139-147) — listing, room, message row,
notification row, service-report clock, provider performance, map marker,
trust-circle visualisation.

| Measured | Before | Now |
|---|---|---|
| Body text contrast | 4.10:1 (fails AA) | 7.15:1 light / 7.27:1 dark |
| Hardcoded colour values | ~2,100 | 0 |
| Horizontal overflow | 398px on `/auth` | 0 |
| Elements clipped off-screen | 10 at 320px | 0 |
| Tap targets under 44px (guest-visible, measured in-browser) | 19–22 per screen (min 11px) | 0 |
| Tap targets under 44px (whole codebase, static scan) | 23 | 0 |
| Bottom nav label size at 320px | 8.8px, then hidden entirely | 12px, all five visible |
| Signals marking the active nav tab | 1 (a 2px border) | 3 (border, pill, weight) |
| Elevation tokens defined / actually used | 4 / 0 | 4 / 3 |
| Motion tokens defined / actually used | 3 / 0 | 3 / 3 |
| Transitions slower than 250ms | 12 | 0 |
| Busy flags that can strand a control | 7 found | 0 |
| Overlays that trap focus | 0 of 16 | 14 of 14 real dialogs (the other two are a fullscreen view and a dev panel) |
| Token pairs contrast-checked in CI | 13 | 25 |
| WCAG AA failures in the palette | 1 (unmeasured) | 0 |
| Routes that scroll sideways at 200% text | 10 of 10 dashboard routes | 0 |
| Text under 12px | 21 per screen | 0 |
| Layout change 320px → 1024px | none | tablet 2-col, desktop sidebar |
| Functions that could hang a spinner forever | 17 | 0 |

Completed: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 41, 42, 43, 44, 45, 46, 47, 48, 64, 66, 70, 72, 79, 80, 81, 82, 83, 84, 85, 86, 87, 89, 91, 99, 103, 104, 105, 106, 107, 112, 117, 152, 154, 155, 164, 165, 172, 177, 178, 191, 192, 193, 194, 195, 196

Everything else is outstanding. The largest remaining blocks are the
component rebuild (121–150), motion and states (156–176), and the rest of
accessibility (179–190).

---

## Suggested sequencing

**Phase 1 — foundations (items 1–22, 191–192).** Invisible, and it makes
everything after it cheap. Do not skip ahead; doing the visible work first
means doing it twice.

**Phase 2 — the changes you will feel immediately (29, 23–28, 105–107,
45–48).** Contrast, surfaces, tap targets, text size. This is where the app
stops feeling dark and cramped, and it is a small number of items.

**Phase 3 — responsiveness (79–104).** The tablet and desktop layouts, and
the 320px fixes.

**Phase 4 — components (121–150).** The long tail, done once and reused.

**Phase 5 — states, motion, accessibility (151–190).**

**Phase 6 — guardrails (193–200).** Lock it in.

Phases 1 and 2 together are roughly 35 of the 200 items and will account for
most of the perceived change. If time is short, they are the ones to do.
