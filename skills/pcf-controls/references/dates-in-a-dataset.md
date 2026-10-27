# Dates in a dataset

A date read through a view: the ISO string and the user's zone, the timeline
and a drag with nothing to drop on, and the demo presets a date control needs.

Split out of `dates.md` on 15 Oct 2026, so each file can be read whole.

- [A date read through a dataset](#a-date-read-through-a-dataset)
- [The timeline, and a drag with nothing to drop on](#the-timeline-and-a-drag-with-nothing-to-drop-on)
- [Demo presets](#demo-presets)

## A date read through a dataset

Everything above assumes a bound field: `attributes.Behavior` is on the
property, `raw` is a `Date`. A **dataset** hands over less, and a control
that places records on days — `pcf-calendar-view` is the exemplar — has to
recover each piece from somewhere else.

**`record.getValue` on a date column is an ISO string, not a `Date`**
(measured, `pcf-data-table` 2026-09-11): `"2026-08-31T00:00:00.000Z"` for a
Date Only column showing 8/31, `"2026-09-01T04:30:00.000Z"` for a Date and
Time column showing 8/31 11:30 PM. The dataset `Column` carries `dataType`
(`DateAndTime.DateOnly` | `DateAndTime.DateAndTime`) — the **format** — and
nothing about the behaviour. So the shape of the value is the only clue until
metadata answers, and the rule that works is: a string ending
`T00:00:00(.000)?Z` is a Date Only day read from its **UTC** components;
anything else is an instant. A User Local value that happens to fall on UTC
midnight is misread by that rule, which is the one ambiguity only metadata
resolves.

**The behaviour comes from `getEntityMetadata`, and it arrives late.** The
datetime node carries `Behavior` (1 User Local, 2 Date Only, 3 Time Zone
Independent) and `Format` on the node itself. The call is asynchronous and
`updateView` is not, so hand the loader to the component and hold the answer
in React state — the same shape as Kanban's lanes, and for the same reason:
`notifyOutputChanged()` does not repaint a control whose outputs did not
change. Keep a copy on the control instance for the writes. (Where the
answer has to be decided in the control rather than the component,
**`context.factory.requestRender()` does repaint a dataset control**:
measured 2026-10-17 in `pcf-data-table` 0.8.0, whose refined error replaced
the first half a second later with no dataset fetch in the network log.)

**The day is the Dataverse user's, and the browser is not the user.** A User
Local instant belongs to the day it falls in the zone from
`userSettings.getTimeZoneOffsetMinutes(date)` — always the dated call — so
shift by that offset and read the **UTC** components, which sidesteps the
browser's zone entirely:

```ts
const wall = new Date(instant.getTime() + userOffset(instant) * 60_000);
// wall.getUTCFullYear(), getUTCMonth(), getUTCDate(), getUTCHours() …
```

A calendar is the control where this shows: one event per day, and a reading
in the browser's zone puts an evening appointment on the wrong day for every
user east of the author — silently. **The dev rig's `userTimeZoneOffset` is
the only thing that catches it**, because a suite on the author's machine
otherwise agrees with the author's browser. Mutating the read to the browser's
zone on `pcf-calendar-view` broke six assertions: the UTC−5 case passed on a
UTC−6 machine and the UTC+10 case failed — the same "look at which cells fail"
pattern as the table above, in a different tool.

**And the write from that browser lands right.** Measured 2026-09-16 on the
test form with the browser at UTC−6 and the Dataverse user at UTC−5:
`record.setValue` was handed a `Date` whose *browser-local* components said
Oct 5 00:00 (`06:00Z`), and the platform stored `05:00Z` — Oct 5 00:00 in
the **user's** zone, shown as *10/5/2026 12:00 AM*. The record route reads a
`Date`'s local components as the user's wall clock, the same rule
*A time is written by its components* above found on a bound field. So a
whole day anchored at the user's midday and a time built from local
components are both right from any browser; nothing needs the browser's
offset on the way out.

**Format the time yourself from `dateFormattingInfo.shortTimePattern`**
(`h:mm tt`, `HH:mm`), with `amDesignator`/`pmDesignator` from the same bag,
and take `firstDayOfWeek`, `dayNames` and `monthNames` from it too. The demo
harness publishes none of it, so every read is optional with an English
fallback.

**The visible range is a server-side window, from an effect.** `start ≤ last
day AND (end ≥ first day OR end IS NULL)` — `OnOrBefore` (26) and
`OnOrAfter` (27) with `yyyy-MM-dd`, the `Or` as a child `filters` entry —
then `paging.reset()` then one `refresh()`, guarded on the window's key,
because the component reports its range from an effect that fires on every
mount and a control that re-fetched on each would loop through the
`updateView` the refresh itself triggers. **A nested `filters[]` is honoured
on a model-driven subgrid, and the window narrows the view's own filter
rather than replacing it** — measured 2026-09-16: a one-week window
returned 6 of 12 and included an event starting a fortnight earlier that
spans in, the flat window on the start column alone returned 5 and dropped
it, and the same window on a *Kind ≠ Meeting* view returned 4. The refresh
landed inside 5 s at page size 4.

**Writing a moved date takes both columns in one call.** Start and end move
together, and a start written through the record while the end goes through
the Web API is two round trips that can disagree — so the route is decided
once, on `isEditable(startColumn)`, and both columns take it. The record route
takes the `Date` from *Anchor a whole day at midday* above; the API route
takes an ISO instant — the user's offset subtracted for User Local (measured
2026-09-16, read back exactly +1 day) and the components verbatim as UTC for
Time Zone Independent — and `yyyy-MM-dd` **only** for a column whose
metadata says `Behavior: 2`.

⚠️ **A date-formatted column is not a Date Only column, and a bare day into
it lands a day early.** The maker portal's default behaviour is User Local
whatever the format, so "Date Only" in the column picker is usually a User
Local instant underneath — the pairing Microsoft's own page warns against.
Measured 2026-09-16 on such a column: it held `2026-10-03T05:00:00Z` (midnight
in the user's zone, not UTC), and `updateRecord` with `"2026-10-04"` stored
UTC midnight and displayed **10/3/2026**. So the shape of the column's
`dataType` decides nothing about the write; only the metadata node's
`Behavior` does, and with no metadata a whole day goes as an instant at the
**user's noon**, which is the same calendar day in every zone within twelve
hours of the user.

**A day as a form parameter is the user's short date, never the ISO day.**
`openForm(options, { [column]: day })` is how the **+** on a day opens the
quick create with the date set. Measured 2026-09-16 on a quick create:
`2026-09-20` was parsed as UTC midnight and the form opened on **9/19 6:00
PM**; `09/20/26`, `09/20/2026` and `09/20/2026 12:00 PM` all landed on the
20th, the last with its time. Format the day with
`userSettings.dateFormattingInfo.shortDatePattern` (`M/d/yyyy`, `dd.MM.yyyy`
…), falling back to the US pattern where no settings are published — whether
a `dd/MM/yyyy` user's form parses that spelling back is not yet measured.

**A time as a form parameter is `yyyy-MM-ddTHH:mm:00`, and needs no
pattern.** Measured 2026-10-04 on the same quick create (`pcf-calendar-view`
0.2.5's probe, from a UTC−6 browser for a UTC−5 user): a start *and* an end
passed in one `openForm` call both arrived; `10/8/2026 2:30 PM`,
`10/8/2026 14:30` and `2026-10-08T14:30:00` all opened on 2:30 PM and saved
14:30 **in the user's zone** — so the zone-less ISO date-time is read as the
user's wall clock, not the browser's, where the zone-less ISO *day* above is
read as UTC midnight. A control that sends a time (an hour grid's free slot)
sends that spelling and never asks which pattern the user has; the day's
**+** keeps the short date, because the ISO day is the one spelling that
fails.

**And memoise the offset by the UTC hour, not the day, once times matter.**
`getTimeZoneOffsetMinutes(date)` is worth caching (a tenant with no DST rule
for a year logs an error per call), but the test form's user turned out to
be in a zone *with* daylight saving — US Central: −300 to 1 November, −360
after (measured 2026-10-04). A cache keyed by the UTC day hands every
instant of a transition day the first answer asked for, up to five hours
wrong: invisible on a month of whole days, an hour out in an hour grid.
`pcf-calendar-view` 0.3.0 keys it by the UTC hour, and its rig's
`userTimeZoneOffset` takes a function of the date to test the change.

**The user's working day is one Web API read away.** `usersettings`, one row
by `systemuserid` (the user's id unbraced, lower-case), through
`webAPI.retrieveMultipleRecords` — 163–254 ms as System Administrator,
`workdaystarttime` and `workdaystoptime` as `"08:00"` / `"17:00"` strings
(measured 2026-10-04). Use it for where a day view opens, never for anything
that must be right: a canvas app has no row to read and an ordinary user's
read is not yet measured, so fall back to 08:00–17:00.

Two rendering traps from the same control, because they are cheap to hit and
invisible to every assertion: **`-webkit-line-clamp` does not apply to a
`<button>`** (Chrome lays a button's content out in an anonymous box where
`-webkit-box` is ignored, and the clamp reads as "break anywhere"); and **a
space inside a `white-space: nowrap` span is not a break opportunity**, so
`<span class="time">10:30 AM </span>Interview` is one unbreakable token —
the space goes *outside* the span, and a margin is not a space.

## The timeline, and a drag with nothing to drop on

`pcf-calendar-view` 0.2.0's third view: one row per event, the days of the
month across, a bar from start to end, and an **edge** the user drags to move
one end alone. Four things it settled in the dev harness and headless
Chrome, and two more on the test form, all 2026-09-17; the six walkthrough
questions in its `SPEC.md` (an edge dragged writes one column and the bar
holds through the refresh; the pointer stays with the bar under the
platform; the section keeps its width while the month scrolls inside; the
narrow layout on a real section; **+ New** on the pressed day; an end given
to an endless event) all answered the right way, and v0.2.0 is tagged.

**A bar drags by pointer capture, not HTML5 drag-and-drop.** The month view
drops a chip onto a day cell, which is a real drop target; a bar has no
target — it moves by the *distance* dragged — and `dragstart` carries no
pointer position. So the bar takes the pointer on `pointerdown`
(`setPointerCapture`, in a `try` because a pointer the browser is not
tracking throws), turns each `pointermove` into whole days by the measured
width of one day column, and commits on `pointerup`. Capture keeps the
events coming when the pointer leaves the bar; there is no document
listener, so `destroy` owes nothing. `touch-action: none` and `user-select:
none` on the bar, or a finger scrolls and a mouse selects instead. A press
that never moved is a click and opens the record; one that moved is not.

**A handle takes only the press.** The resize handles are children of the
bar with their own `onPointerDown` (`stopPropagation`, then begin the drag
with the edge named). They must have **no** `onPointerUp` of their own: the
moves and the release bubble to the bar's handlers, and a handle that also
handled the release committed one resize twice — once itself and once when
the event reached the bar, whose closure still held the drag. Measured in
the harness as one drag, two `save()`s.

**Capture on movement, not on the press, when the thing dragged holds
anything to click.** The timeline's bar is itself what opens the record, so
capturing on `pointerdown` costs nothing there. `pcf-calendar-view` 0.3.0's
hour-grid block holds a title link and a ⋯ menu, and capturing on the press
broke both, one after the other, on the form (2026-10-05):

- **Chrome sends the click that ends a captured press to the capturing
  element**, not to what was pressed — so no title opened its record. Take
  capture in `pointermove`, once the pointer has moved a few pixels (3px
  there); a press that stays put is then an ordinary click on whatever was
  pressed, and one that leaves the element before moving that far is
  abandoned rather than left held.
- **A Fluent menu is a portal, and React bubbles a portal's events through
  the *component* tree**, so a press on a menu item reached the block's
  `onPointerDown` and the block captured it — the menu opened and no item
  did anything. Start a drag only when `currentTarget.contains(target)`: the
  DOM says where the press really was.

Neither shows in a suite that renders without a browser, nor in a page
driven with `dispatchEvent`, which runs no hit-testing, capture retargeting
or click synthesis. `pcf-calendar-view`'s `dev/clicks.js` presses with real
input — `Input.dispatchMouseEvent` through the template's `dev/cdp.js`, in
the hub's own harness — and failed on both builds before passing on the
fixed one. Its drags send `button: 'left'` on every move: without it Chrome
drops the capture, and only a bar wide enough to stay under the pointer
still drags (*A drag over the protocol sends `button` on every move* in
`pcfhub-new-control/references/rig-maintenance-and-checks.md`).

**A resize retires its override when both days agree.** A move of both
columns could retire on the start day alone; a resize moves the end only,
so the start agrees on the very next pass and retiring on it snapped the
bar back to its old length until the refresh landed. `reconcile` compares
the start *and* the end against the record, and the rig's `reread()` — the
separate fetch a real `save()` does not perform — is what a suite needs to
prove the override survives the pass in between. A mutation that dropped
the end comparison failed exactly two assertions.

**A bar's text is decided by measured pixels, never by its day count.** The
first rule drew text only on a bar spanning two or more days — right at the
harness's 36px a day, and wrong on the test form, 2,000px wide at 58px a
day, where every one-day bar sat blank beside a month view saying "6:00 PM
Meeting 4". A `ResizeObserver` on the grid measures the day width; the
title appears from 48px, the time as well from 120px, and below that the
bar is a plain chip with the title in the sticky label column. The badge
goes in the label too — on the bar it took the whole width. The general
rule: **any "is there room for this" decision is a measurement of the host,
not a count of the data.**

**A pressed day has to look pressed.** Selecting a day is what
`selectedDate` reports and what the timeline's **+ New** creates on, and the
form walkthrough's W5 found the quick create opening on the right day while
the calendar showed nothing pressed — a selection that was real and
invisible, in all three views. A brand ring on the day's number (distinct
from today's filled disc), a tint on the timeline's column, `aria-pressed`
on every day button. An output the host reads back is still a state the
user has to be able to see.

Three rendering traps from the same view, each found by looking and by no
assertion: **`min-width: max-content` on a CSS grid sizes every `1fr` track
to the longest item it spans** (a month 6,414px wide from one long title —
the 36px track minimum alone is what overflows a narrow control into a
sideways scroll); **a narrow-layout rule that hides `.Control-eventTitle`
hides it wherever the class is reused** (thirteen empty timeline rows in a
phone frame, until the rule was scoped to the chip); and the sideways
scroll belongs on a box *inside* the root, never on the root — a form
section sizes itself from the control, and a root that scrolled would be
0.1.3's collapse the other way round.

## Demo presets

**A control that queries Dataverse demos on a stand-in Dataverse, not on a
demo input.** The hub's harness has no `webAPI`, no `contextInfo` and no
organisation URL of its own; its `demo.datasetFixture` can carry a `dataverse`
section that answers them (see *The demo block* in `pcfhub-publish/references/hub-demo.md`):
`contextInfo`, `page.getClientUrl()`, `getEntityMetadata`, an OData subset on
`webAPI`, `EntityDefinitions` relationship reads, `$ref`, and `lookupObjects`.
A dataset control carries it beside its rows; **any other control carries only
the section** (pcfhub #34, 2026-09-24). The control then runs its live route
unchanged, which is the point: the demo exercises the code a form runs.

**The sample-data route is what came before, and it is retired except where
the stand-in cannot reach.** It was one `Multiple` input named `sampleData`,
blank on a real form, holding a JSON document the control drew instead of
querying. It worked, and it was a demo-only property in every maker's panel —
`pcf-tag-list` 0.4.0's owner rejected it, 0.5.0 removed it, and
`pcf-hierarchy-view` 0.2.0 followed. It survives only in `pcf-audit-history`,
whose subject is Web API **functions** the stand-in does not answer. If a
control must keep one, two rules still hold: the sample route honours every
other input (Hierarchy View 0.1.2 drew details a preset had switched off), and
every input that changes what renders is in the source key, because the demo
changes inputs on a mounted control.

What moving `pcf-hierarchy-view` onto the stand-in taught, 2026-09-24:

- **One fixture is one form record.** `dataverse.record` is shared by every
  preset over that fixture, so presets vary inputs around a single record; a
  state that needs a different record (the top of a tree, a leaf) goes in the
  screenshots and `demo.limitations` — or, from 2026-10-12, in a preset that
  names a fixture of its own, which nobody has tried for a field control yet
  (*A preset can name a fixture of its own* in `pcfhub-publish/references/hub-demo.md`). Pick the record
  that shows the most — a mid-level one, with ancestors above and children
  below.
- **A bound column's logical name comes from `boundColumns`.** The harness
  reports `attributes.LogicalName` as the *property's* name (`value`) unless
  the fixture names the column (`{ "value": "parentaccountid" }`, pcfhub
  #35). A control that builds `_<column>_value` from it queries a column no
  row has.
- **Running the real code against the stand-in finds the stand-in's bugs.**
  The first run drew the tree one level short: the stand-in answered
  `$select=parentaccountid` with `parentaccountid: null`, where the Web API
  renames a selected lookup to `_parentaccountid_value`. The control was
  right; the stand-in was fixed in #35. Budget a local run in the hub's harness
  (`npm run dev:demo-harness`, see below) before claiming `mocked`.
- **The rule a sample route taught has to move to the live one.** Hierarchy
  View's "blank detail columns rebuilds the tree" was asserted on the sample
  route; removing the route removed the assertion unless it was rewritten
  against the live source.

**The hub's own harness can be run locally.** `npm run dev:demo-harness` in the
hub repository (port 4174; only the dev build accepts a parent that is not
pcfhub.dev). Opened top-level, `window.parent` is the page itself, so a script
run in it can answer its `harness:hello` with `harness:init` —
`{ v: 1, sessionId, manifest, props, theme, locale, viewport, datasetFixture }`
— within its 1.5 s wait, and later send `harness:updateProps` or
`harness:reset`. `manifest.styles` is the stylesheet's **text**, not a URL;
`bundleUrl` may be another localhost origin, since it loads as a classic
script. The frame the hub embeds is sandboxed with `allow-scripts` only, so
`window.confirm`/`alert` return at once there and `location.origin` is
`"null"`.

**An overlay in the demo must be `absolute`, not `fixed`.** The hub sizes its
frame to the content and its `measure-height.ts` deliberately skips fixed
subtrees, so a fixed dropdown never grows the frame, finds no room below and —
with a "flip when above beats below" rule — opens over the control.
`pcf-tag-list` 0.5.0: the list is absolute inside a body-level layer placed at
the page's origin (identical on a form), and flips upward only with real room
above.

A date in `demo.presets[].props` is JSON, so it is a string. Write
`2026-08-20T12:00:00`, not `2026-08-20`: the date-only form parses as UTC
midnight, so a control doing the right thing locally renders a day early in its
own demo for every visitor west of UTC. A date-time string with no zone parses
as local, and midday clears either boundary.

This is the same rule as *Anchor a whole day at midday* above, and the fixtures
usually learn it first. Worth checking the control agrees with them: on
`pcf-date-range-picker` the demo presets carried `T12:00:00` from the first
release while the control itself emitted midnight for four more, and the gap
between the two was the bug.
