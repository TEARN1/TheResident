# Screen-reader pass

Design plan item 188. This is the one item in the 200 that cannot be done
from a keyboard and a browser — it needs a real screen reader on a real
phone, which means it needs you.

Everything below that says "suspected" comes from reading the code and
measuring the running app, not from hearing it. That is exactly the gap this
pass closes: the whole point is to find the places where the code looks right
and sounds wrong.

Budget about 90 minutes. Do it in one sitting if you can — the value is in
noticing that the app is tiring to listen to, and that only shows up in a
continuous run.

---

## 1. Before you start

### Turn the screen reader on

**iPhone (VoiceOver).** Settings → Accessibility → VoiceOver → on. Set
Settings → Accessibility → Accessibility Shortcut → VoiceOver first, so a
triple-click of the side button toggles it — you will want that within the
first two minutes.

- Swipe right / left — next / previous element
- Double-tap — activate the selected element
- Two-finger swipe down — read continuously from the selection
- Two-finger tap — stop speaking
- Rotor (two fingers, rotate like a dial) — switch between headings, links,
  form controls. **The rotor is the most important tool in this pass**: it is
  how a real user skips your layout instead of swiping through all of it.

**Android (TalkBack).** Settings → Accessibility → TalkBack → on. Hold both
volume keys for three seconds to toggle.

- Swipe right / left — next / previous element
- Double-tap — activate
- Swipe down then right — TalkBack menu
- Swipe up / down — move by the current reading control (set it to Headings
  to do the heading sweep below)

### Two rules for the whole pass

1. **Turn the screen off, or look away.** Everything here can be faked by
   glancing at the screen. If you can see it, you are testing your memory of
   the app, not the app.
2. **Write down the words you actually hear**, not what you know the control
   is. "Button" is a finding. "Button, five" is a finding. The gap between
   what it says and what it is *is* the bug.

---

## 2. Already verified — don't spend time here

Measured in the running app this session, so you can skip these unless
something sounds wrong in passing:

- `lang="en"` is set on the document, so the voice pronounces English text
  correctly.
- The **skip link** works: it is the first thing in the tab order, moves
  on-screen when focused (accent background, white text, top-left), and jumps
  to `#main-content`.
- **Dialogs are correct.** `Modal.tsx` and `DialogShell.tsx` both set
  `role="dialog"`, `aria-modal="true"` and require an `aria-label` — plus a
  focus trap, Escape to close, and focus restored to whatever opened them.
- **Heading outline** on the public pages (`/`, `/auth`, `/privacy`,
  `/terms`) is sane: one `h1`, `h2`s under it, no skipped levels.
- Every `<img>` on the reachable pages has an `alt` attribute.
- The **alert banner stack** now has `aria-live="polite"` and success
  messages are spoken through the live region. This was added this session —
  before it, filing a report said nothing at all. **Confirm it actually
  speaks** (§4, step 5); it is the newest and least-proven thing here.

---

## 3. The suspects, in priority order

Found by scanning the source. Each is a prediction — confirm or clear it.

### A. Form fields with no programmatic label — the big one

The app has **193 form controls** and **112 `<label>` elements**, but only
**24 labels use `htmlFor`** and **22 wrap their control**. The rest sit
*beside* the field as plain text. Sighted users see a labelled form; a screen
reader gets a control with no name.

`src/app/auth/onboarding/page.tsx:126` is the pattern:

```tsx
<label style={labelStyle}>Account Role</label>
<select required value={role} …>
```

Nothing connects those two. Expect to hear something like "pop-up button"
with no idea what it sets.

A second variant is fields with **only a placeholder** —
`src/app/page.tsx:121` (`name@domain.com`) and `:129` (`secure key...`). A
placeholder is not a label: it vanishes as soon as you type, and it is not
reliably announced as the control's name.

Worst-affected files: `dashboard/housing/page.tsx` (23),
`dashboard/services/page.tsx` (17), `dashboard/profile/page.tsx` (13),
`OrgBroadcastsPanel.tsx` (10), `RoomInventoryPanel.tsx` and
`PropertiesPanel.tsx` (8 each), `auth/onboarding/page.tsx` (7).

**There is already a component that does this correctly** —
`src/components/ui/Field.tsx` sets `htmlFor`, `aria-invalid` and
`aria-describedby` for hints and errors. **Zero files import it.** So the fix
for most of this is adoption, not invention.

> On the numbers: the scan cannot see a `<label>` that wraps its control, so
> the true count is somewhat lower than 159. Both spot-checks I opened were
> real. Treat it as "most of the forms", and let your ears set the number.

### B. Icon-only buttons with no accessible name

**26 of 167** icon-bearing buttons have no `aria-label`, no `title` and no
text. **13 of those are the close/dismiss `X`** on panels and sheets — so the
predicted failure is that a screen-reader user cannot find how to close
things. Confirmed by eye:

- `dashboard/messages/[threadId]/page.tsx:176` — **the send button in a
  conversation.** Icon only. This is the messaging core loop.
- `components/map/VibeMap.tsx:1418`, `:1459`, `:1600`, `:1607`, `:1614` —
  five unnamed `X` buttons on the map.
- `components/community/NoticeBoardTab.tsx:347` and `:350` — the like and
  share buttons contain an icon and a **bare count**, so they announce as
  "5, button". The number is not the action.

Others: `community/page.tsx:510,843`, `MarketTab.tsx:384`,
`SavedSearches.tsx:111,139`, `HouseholdTab.tsx:341`,
`DistanceMatrixPanel.tsx:54`, `MapSearchBox.tsx:128`,
`services/page.tsx:599,862`, `housing/page.tsx:1289`,
`profile/page.tsx:258`, `AreaNoticesPanel.tsx:99`,
`RequestVerificationPanel.tsx:181`, `VerificationQueuePanel.tsx:214`,
`OrgBroadcastsPanel.tsx:359`, `AutomationControlPanel.tsx:104`.

### C. Tab strips that are not tabs

`src/components/ui/Tabs.tsx` does it properly — `role="tablist"`,
`role="tab"`, `aria-selected`. **One file uses it.** Three screens build
their own tab strips out of plain buttons with no roles and no selected
state:

- `src/app/auth/page.tsx` — **Create Profile / Log In**, on the first screen
  anyone meets
- `src/app/dashboard/housing/page.tsx` — Rent / Buy / Guest Houses
- `src/app/dashboard/services/page.tsx`

Predicted: you hear a row of buttons with no indication which one is
currently showing. On `/auth` that means not knowing whether you are about to
create an account or sign in.

### D. Things to listen for that no scan can find

- **Reading order.** Does the page speak in the order it looks? Absolutely
  positioned elements and flex `order` are the usual culprits.
- **Focus after an action.** Filing a report, sending a request, closing a
  sheet — where does focus land? If it silently returns to the top of the
  document you have lost your place in a long list.
- **Realtime interruptions.** New gossip posts and messages arrive on their
  own. Does the live region talk over you mid-sentence?
- **Decorative icons.** 58 places use `aria-hidden`. Listen for icons being
  read as meaningless names, and for meaningful icons wrongly hidden.
- **Status by colour alone.** Verified badges, room vacant/occupied, report
  severity — is the state in the words, or only in the colour?

---

## 4. The walkthrough

Do these in order. They are the app's real core loops.

**1. Land and sign in.** Open `/` with the screen reader on. Swipe from the
top. Can you reach the login form and submit it without sight? At `/auth`,
can you tell which tab is selected (suspect C)? Are the email and password
fields named (suspect A)?

**2. Sweep the headings.** On each main screen — Home, Housing, Community,
Services, Gossip, Profile — use the rotor (or TalkBack's Headings control) to
jump heading to heading. You should be able to understand the screen's shape
from the headings alone. If a screen has no headings, note it: that user has
to swipe through everything.

**3. The bottom nav.** Five items. Each should announce its label and say
which one is current — `aria-current="page"` is set, so expect VoiceOver to
say "selected" or TalkBack "selected". Confirm it actually does.

**4. File a service report** (Community → Safety → Service Desk). The full
loop: choose a category, describe the problem, submit. Suspect A lands hard
here. Then listen for the confirmation — see step 5.

**5. Confirm the success announcement.** This is the newest code in the app.
After the report is filed, the message should be spoken without you going
looking for it. If you hear nothing, the live region is not working and I
need to know.

**6. Send a message.** Open a conversation, type, send. Can you find the send
button (suspect B, confirmed unnamed)? Does the sent message get announced,
or do you only know it worked by swiping back to find it?

**7. Request a room.** Housing → a listing → request. The tab strip is
suspect C, the form is suspect A.

**8. The map.** Open VibeMap. Be honest about whether it is usable at all —
a map may simply not be, and the right answer might be a text alternative
("3 reports within 2km: …") rather than making the map itself navigable.
Note the five unnamed `X` buttons (suspect B).

**9. Close everything.** Every sheet, modal and panel you opened — could you
find the way out each time? This is where the 13 unnamed `X` buttons will
show up.

---

## 5. Recording what you find

One line each, in this shape:

```
SCREEN — what you did — what it SAID — what it SHOULD have said
Services → Service Desk — swiped to the category picker — "pop-up button" — "Category, pop-up button, Water"
```

The middle column is the part I cannot get any other way. Send me the list
and I will fix them; the quoted wording is what tells me whether a field
needs a label, a different label, or a description as well.

---

## 6. Afterwards

Fixing these is mostly mechanical:

- Suspect A is largely **adopting `Field.tsx`**, which already exists and is
  already correct — the work is migration, not design.
- Suspect B is adding `aria-label` to 26 buttons.
- Suspect C is adopting `Tabs.tsx` in three files.

The thing worth guarding afterwards is adoption, not the individual fixes. A
component library that half the app ignores is worse than no library, because
now there are two answers — which is how `Field.tsx` came to be correct,
finished and used nowhere. When these are fixed, the test that keeps them
fixed should count raw `<input>` and ad-hoc tab strips, not audit ARIA
attributes one by one.
