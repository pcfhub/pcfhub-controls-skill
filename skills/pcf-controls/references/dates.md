# Dates

Date columns on a field control and through a dataset: behaviour and format,
the user's time zone against the browser's, whole days, and the demo presets a
date control needs.

- [Dates, and the day that moves](#dates-and-the-day-that-moves)
  - [`Behavior` decides the shape of the value you are handed](#behavior-decides-the-shape-of-the-value-you-are-handed)
  - [A canvas app states a behaviour for no column](#a-canvas-app-states-a-behaviour-for-no-column)
  - [Format and Behavior are different fields, and the manifest gates on Format](#format-and-behavior-are-different-fields-and-the-manifest-gates-on-format)
  - [Anchor a whole day at midday](#anchor-a-whole-day-at-midday)
  - [A time is written by its components, and read by its behaviour](#a-time-is-written-by-its-components-and-read-by-its-behaviour)
  - [The shift is in serialising, not reading](#the-shift-is-in-serialising-not-reading)
  - [Subtracting timestamps is an hour out across DST](#subtracting-timestamps-is-an-hour-out-across-dst)
  - [Formatting](#formatting)
  - [Today, and ranges counted from it](#today-and-ranges-counted-from-it)
  - [A date read through a dataset](#a-date-read-through-a-dataset)

## Dates, and the day that moves

Dates are the highest-frequency bug class in PCF controls, and the bug is not
where the received wisdom points. It is worth being precise about this because
the wrong fix is widely repeated.

### `Behavior` decides the shape of the value you are handed

The received wisdom is to branch on `attributes.Behavior`, and **the received
wisdom is right** — reasoning that says otherwise looks sound until it meets
a live form. What follows is what
a live form showed.

The platform typings type it as a bare `0 | 1 | 2 | 3` — but they document it,
in a doc comment above `FormattingApi.Types.DateTimeFieldBehavior`:

```
0 - None - Unknown DateTime Behavior,
1 - UserLocal - Respect user local time. Dates stored as UTC,
2 - DateOnly. Dates with time stored as midnight without conversion to UTC.
3 - TimeZoneIndependent - Dates and time stored without conversion to UTC.
```

**`context.parameters.x.raw` and `Xrm.Page.getAttribute(...).getValue()` do not
agree, and nothing documents it.** Measured on a real form, one column, one
moment, the same stored day:

| | |
| --- | --- |
| attribute API | `2026-09-18T06:00:00.000Z` — local midnight |
| PCF `raw` | `2026-09-18T00:00:00.000Z` — **UTC** midnight |

So the day lives in a different half of the `Date` depending on the column:

- **`1` UserLocal** — stored as UTC, handed over as a genuine instant. The
  **local** components are the day.
- **`2` DateOnly and `3` TimeZoneIndependent** — the day itself, handed over at
  **UTC** midnight. The **UTC** components are the day. Read locally, it is the
  previous day for every browser west of UTC.
- **`0` None, or no column behind the value** — a canvas app, an unmapped
  property, the hub's demo. Fall to the instant reading; it cannot be wrong
  about a value it was never told anything about. **A canvas app is in this
  branch although it states a `Behavior`** — `2` on a date-only property and
  `3` on a date-time one, over a value that is the true instant. See *A canvas
  app states a behaviour for no column* below before reading `Behavior` off any
  property that can sit in a canvas app.

Convert **once on the way in and once on the way out**, and let everything
between work in plain local-midnight days. `pcf-date-range-picker` does this
with two functions in `range.ts` — `dayFromPlatform` and `dayToPlatform` — and
the payoff is that its calendar grid, `toInputValue` and `dayNumber` needed no
changes at all when this was found.

```ts
const storesTheDayItself = (behavior: number | undefined): boolean =>
    behavior === 2 || behavior === 3;

const dayFromPlatform = (value: Date, behavior: number | undefined): Date =>
    storesTheDayItself(behavior)
        ? new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
        : new Date(value.getFullYear(), value.getMonth(), value.getDate());
```

**How to tell this one from a formatting bug**, because they look identical from
across the room: if the value itself is wrong, *everything* that reads local
components agrees on the wrong day — the grid, a typed `<input type="date">`,
the trigger. If only the formatted text is wrong, it disagrees with the typed
input beside it. That distinction is what separated these two bugs, one release
apart, on the same control.

`Behavior` is also worth reading to *document* a column, and `formatTime` takes
it as an argument.

### A canvas app states a behaviour for no column

**Read `Behavior` only where a column stands behind the value.** Everything
above was measured on a model-driven form, and this file said until 6 October
2026 that canvas has no `attributes` to read. It has, and they are about
nothing. Read
with a probe control in a published canvas app on 6 October 2026, the same
properties fed from a literal, a variable, a collection and a Dataverse row,
with the browser in three zones:

| Property, value | Mexico City (UTC−6) | Berlin (UTC+2) | Tokyo (UTC+9) |
| --- | --- | --- | --- |
| date-only, 6 Oct — `Behavior` | `2`, `Format: 'date'` | `2` | `2` |
| …its `raw` | `2026-10-06T06:00Z` | `2026-10-05T22:00Z` | `2026-10-05T15:00Z` |
| date-time, `23:30Z` — `Behavior` | `3`, `Format: 'datetime'` | `3` | `3` |
| …its `raw` | `2026-10-06T23:30Z` | the same | the same |

So in a canvas app:

- **`raw` is always the true instant.** A date is **local** midnight, whatever
  it was read from: a Dataverse Date Only column, `Date(2026, 10, 6)`, a
  variable. The **local** components are the day.
- **`Behavior` is the property's declared type talking**, `2` for
  `DateAndTime.DateOnly` and `3` for `DateAndTime.DateAndTime`, with
  `EntityLogicalName` empty and `LogicalName` the property's own name. On a
  form a Dataverse Date Only column (a loan due 20 October) answered
  `Behavior: 2` over `2026-10-20T00:00Z` — UTC midnight — and named its
  table; the same column in the canvas app arrived as `2026-10-20T06:00Z` at
  UTC−6.
- **Following the rule above on canvas moves the day.** Reading the UTC
  components of a `2` gives 5 October for 6 October everywhere east of UTC,
  and the right day west of it — so it survives every check made from the
  Americas. `pcf-date-range-picker` 0.3.1 reads `Behavior` this way (by its
  code; not yet watched in a canvas app east of UTC). Reading the UTC clock
  of a `3` moves a time by the whole offset: `pcf-sla-timer` 0.2.0 did, and
  its canvas deadlines were late by the browser's six hours (its `SPEC.md`
  has the readings).

The source of the behaviour is therefore one function, and it is the gate for
`dayFromPlatform` and everything else here:

```ts
/** The column's date behaviour, or `undefined` where no column stands behind the value. */
const behaviorOf = (parameter: ComponentFramework.PropertyTypes.DateTimeProperty): number | undefined => {
    const attributes = parameter.attributes as { Behavior?: number; EntityLogicalName?: unknown } | undefined;

    return typeof attributes?.EntityLogicalName === 'string' && attributes.EntityLogicalName !== ''
        ? attributes.Behavior
        : undefined;
};
```

(`columnOf` in the template's scaffolds is the same test for any property —
*`attributes` is where canvas and model-driven actually diverge* in
`references/properties.md`.) `pcf-sla-timer` 0.3.0 asks a narrower version,
`EntityLogicalName` empty *and* `LogicalName` equal to the property's name.

**A canvas maker cannot say "this is a whole day" through the column, so a
control that needs to know asks.** A date-time property handed a date-only
column's value gets local midnight and `Behavior: 3`, indistinguishable from a
deadline at midnight. `pcf-sla-timer` 0.3.0 added a `wholeDay` input for it.

**Three more things the canvas host does with a date**, from the same readings:

- **`userSettings.getTimeZoneOffsetMinutes(date)` is the browser's
  `getTimezoneOffset()`** — `360` at UTC−6, `-120` in Berlin, `-540` in Tokyo:
  minutes *behind* UTC, the opposite sign to a form, where it answered `-300`
  for a user in UTC−5. The no-argument call answers the same there. There is no
  Dataverse user's zone in a canvas app, only the browser's; arithmetic written
  for a form's sign is wrong by twice the offset.
- **`formatting.formatTime(raw, 1)` is wrong by twice the offset**: `23:30Z`,
  which is 5:30 PM in Mexico City, rendered `10/7/2026 5:30 AM`, and local
  midnight rendered `12:00 PM`. `formatDateShort(raw)` and the property's own
  `formatted` were right in all three zones. Format a canvas time from the
  local components or with `Intl`.
- **The value does not depend on the data source, and neither does the
  `Behavior`.** A SharePoint, Excel or SQL date was not read; a Dataverse one
  arrives exactly like a literal.

**Testing it:** the template's rig hands a canvas property this placeholder
(`placeholderAttributes` in `dev/host.js`), so a suite can assert a date under
`host: 'canvas'` at a zone east of UTC. Until 6 October 2026 it handed
`undefined`, and every assertion written against that proved nothing about
canvas.

### Format and Behavior are different fields, and the manifest gates on Format

`of-type="DateAndTime.DateOnly"` restricts binding by the column's **format**.
Behaviour is a separate property, so a column can read as *Date Only* in the
maker portal and still behave as **UserLocal** — dates stored as UTC. The
control binds happily, everything looks right, and the value is an instant
rather than a day.

This is not exotic; it is the default for a column created before someone
thought about it. A control that works in whole days should say so in
`docs/limitations.md` and name the symptom, because the symptom is what a user
searches for: **both ends of a range off by exactly one day**. Checking it is a
metadata query the user can run in the browser console on the form:

```js
const ctx = Xrm.Utility.getGlobalContext();
const entity = Xrm.Utility.getPageContext().input.entityName;
const url = `${ctx.getClientUrl()}/api/data/v9.2/EntityDefinitions(LogicalName='${entity}')`
    + '/Attributes/Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    + '?$select=LogicalName,Format,DateTimeBehavior';

console.table((await fetch(url, { headers: { Accept: 'application/json' } }).then((r) => r.json())).value);
```

Changing UserLocal to DateOnly fixes it at the source, and is worth knowing
before recommending: the change is one-way and does **not** convert existing
data, so historical rows are reinterpreted rather than migrated.

### Anchor a whole day at midday

**Three timezones are in play and any two of them can disagree**: the browser's,
the *Dataverse user's* (a separate personal setting), and whatever the column's
behaviour stores in. A whole day held at **midnight** has no tolerance for that
at all — one hour of disagreement moves the date. Held at **midday** it absorbs
almost twelve hours in either direction.

So a control working in whole days should anchor at midday everywhere a date
crosses a boundary:

```ts
const atMidday = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
```

Two boundaries, and both were found the hard way on `pcf-date-range-picker`,
one release apart:

- **What `getOutputs` hands back.** On a UserLocal column the value is stored as
  UTC. A day picked at 00:00 in a UTC-6 browser is `06:00Z`, still the previous
  day for every viewer west of UTC-6. Reported from a real form as a range
  saved 6 Sep – 31 Oct reading back 5 Sep – 30 Oct. Anchor in the frame the
  column uses: **UTC midday** for a behaviour that stores the day itself, local
  midday for an instant.
- **What you pass to `context.formatting`.** See *Formatting* below — this one
  is display-only, with the stored value perfectly correct, which makes it the
  most confusing of the family to diagnose.

For behaviours 2 and 3 the time of day is discarded, so midday costs nothing
there. It is a wider window rather than a guarantee: beyond half a day of
disagreement the date still moves, and no client-side code fixes a column that
stores a day as an instant.

### A time is written by its components, and read by its behaviour

Measured on 12 September 2026 (`pcf-date-range-picker` 0.2.7, a probe build)
against a User Local and a Time Zone Independent **Date and Time** column on
one record, from a UTC-6 browser whose Dataverse user was in UTC-5. It
explains the midday rule above rather than replacing it, and it is the whole
contract for a control that carries a time:

**On write the platform never reads the instant.** It reads the `Date` a
control hands back by its **browser-local components** and treats those as
the wall clock — then the behaviour decides what to do with that wall clock:

| handed over (local components `08:30:45`) | User Local stored | TZI stored |
| --- | --- | --- |
| `2026-09-18T14:30:45Z` | `13:30:45Z` — 08:30:45 in the *user's* UTC-5 | `08:30:45Z` — verbatim |

So there is nothing for a control to convert on the way out: a `Date` whose
local components are the wall clock the user means is already the shape every
behaviour wants, and an offset or a midday anchor applied to a time is undone
or doubled on the other side. Seconds are stored and come back.

**On read the two behaviours hand the wall clock back in different halves of
the `Date`:** User Local `raw` is the true instant (`13:30:45Z`, equal to
`getAttribute().getValue()` and to the Web API), so the wall clock is that
instant in the **Dataverse user's** zone — `userSettings.getTimeZoneOffsetMinutes(raw)`,
which is in the platform's sign (minutes *ahead* of UTC, `-300` for UTC-5, the
opposite of `getTimezoneOffset()`), and **always with the date argument**:
the no-argument call answers the *standard* offset (`-360` on a day the dated
call answered `-300`), where `Xrm`'s same-named call answers today's. TZI
`raw` carries the wall clock in its **UTC** components (`08:30:45Z`), the same
shape a DateOnly column keeps its day in, with `getValue()` six hours away.

**Which formatter agrees with the form:** on the same instant,
`formatDateShort(x, true)` rendered the *browser's* clock, `formatTime(x, 1)`
the *user's*, `formatTime(x, 2|3)` the UTC components — and every one of them
prints the date in front of the time. The property's own `formatted` matches
the native field. A control that holds the wall clock as local components
needs only `dateFormattingInfo.shortTimePattern` (`h:mm tt`, with
`amDesignator`/`pmDesignator`; every key is present under both Pascal and
camel spellings on a real tenant) and can format the time itself.

`attributes.Format` is `'date'` or `'datetime'`, lower-case, and is how a
control tells the two column kinds apart on a form. In a canvas app it says
which **property type** was declared, not what the maker bound — a date-time
property fed a date-only column answers `'datetime'` — so a manifest input has
to say (*A canvas app states a behaviour for no column* above). The node
carries fourteen keys where the typings name three.

### The shift is in serialising, not reading

Two operations move the day, and both are the obvious thing to write:

```ts
date.toISOString().slice(0, 10)   // converts to UTC first
new Date('2026-08-20')            // date-only ISO parses as UTC midnight
```

`pcf-date-range-picker` measured both under real timezones rather than reasoning
about them:

| | UTC-6 | UTC+12 |
| --- | --- | --- |
| `toISOString()` on a DateOnly midnight | ok | **a day early** |
| `toISOString()` on an evening UserLocal value | **a day late** | ok |
| `new Date('2026-08-20')` read back locally | **a day early** | ok |
| local components | ok | ok |

**Look at which cells fail.** The naive code breaks on *different inputs* in each
hemisphere. A developer in UTC-6 cannot reproduce the UTC+12 report and vice
versa, and each concludes the other is mistaken — which is most of why this one
survives review, testing and several releases.

The fix is one boundary, converted explicitly in both directions:

```ts
const toInputValue = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;

const fromInputValue = (value: string): Date | null => {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    return parts
        ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
        : null;
};
```

`<input type="date">` pairs well with this: its value is `yyyy-mm-dd` regardless
of the display locale, so there is exactly one format to convert at exactly one
place. It is also the reason to reach for it over a component library picker —
Fluent 9's lives in `@fluentui/react-datepicker-compat`, which is not a platform
library and would be bundled.

### Subtracting timestamps is an hour out across DST

`(b - a) / 86400000` is wrong at a daylight-saving boundary — enough to make a
`Math.round` of "days between" off by one. Build a UTC instant out of *local*
components and subtract those:

```ts
const dayNumber = (d: Date): number =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
```

### Formatting

Use `context.formatting` — `formatDateShort`, `formatDateLong`,
`formatTime(value, behavior)` — over `Intl`. It follows the user's Dataverse
settings rather than the browser's, so the control agrees with the rest of the
form instead of merely looking plausible. `context.userSettings` carries
`dateFormattingInfo` and `getTimeZoneOffsetMinutes(date)`; pass the date, since
the offset is not constant across a DST boundary.

**Now draw the consequence of "rather than the browser's", because it is a bug
and not a footnote.** The Dataverse user's timezone is a separate personal
setting that routinely differs from the machine's. Hand `formatDateShort` a day
at local midnight and a user whose Dataverse timezone is west of their browser's
gets **the day before** — with the column correct, the read correct, and only
the text wrong. Every check of the data agrees with you, which is why this one
took a second bug report to find after the first had been fixed.

So pass `atMidday(date)` to every formatter, not the date you were handed:

```ts
formatDate: (date: Date): string => context.formatting.formatDateShort(atMidday(date)),
```

The call site that hurts is the one nobody looks at. `formatDateYearMonth` is
handed the **first** of the month by a calendar heading, so a westward user
reads *August* over September's grid — and `formatDateLong` usually feeds an
`aria-label`, where only a screen-reader user would ever have met it.

**Testing it:** a fixture has one timezone and cannot reproduce the
disagreement. What it can hold is the half the control owns — let `dev/host.js`
record what its formatters were handed, and assert every one is at midday.
`pcf-date-range-picker` does this with a `formatCalls` array on the fixture:
67 calls in a default render, none at midnight.

### Today, and ranges counted from it

Quick ranges ("last 90 days", "this fiscal quarter") and bounds that move with
the date ("nothing before 30 days ago") all start from one *today*. Get that,
and the ends, right once, in a pure module the suite can hand any day to.
`pcf-date-range-picker` 0.4.1's `calendar.ts` and `range.ts` are the worked
example.

- **One today per render, handed down.** Read `new Date()` once in
  `updateView` and pass it to the presets, the bounds and the calendar's
  highlight, so the three cannot disagree across midnight. It is the
  **browser's** day. The Dataverse user's zone can be on another date for a
  few hours, and nothing in the platform hands a control the user's today.
  Say so in the limitations instead of half-converting.
- **Both ends inclusive, and build days from local components.** "Last 7
  days" is today and the six before it. Use `new Date(y, m, d + n)` for
  arithmetic and the day-number difference (*Subtracting timestamps is an
  hour out across DST*) for comparisons. A month step clamps to the target
  month's last day, or 31 January plus a month is 3 March.
- **Quarters and fiscal years are one function with a first month.** The
  quarter containing `day`, with quarters starting in `first` (0–11), begins
  at `day.getMonth() - ((day.getMonth() - first + 12) % 12) % 3`. The fiscal
  year begins in `first` of this year if `day.getMonth() >= first`, else of
  last year. Calendar quarters are `first = 0`. Test both sides of the year
  boundary and a leap February.
- **The organisation's fiscal start is an instant, not a day.**
  `organization.fiscalcalendarstart` is **UserLocal behind a Date Only
  format**. That is the shape *Format and Behavior are different fields* warns
  about. Read on a real organisation (2026-10-29): set to 1 April, it held
  `"2022-04-01T10:59:00Z"` (formatted `"4/1/2022"`), and the original
  1 January held the same 10:59Z. Take the month from that instant moved into
  the user's zone (`getTimeZoneOffsetMinutes(that date)`, the platform's
  sign), never from its UTC or browser components. 10:59Z is already the next
  day east of UTC+13, and a start entered near midnight is the previous day
  in UTC. `fiscalperiodtype` 2002 is quarters. A control that needs other
  period shapes (4-4-5, four-week) has to read more than the start month.
- **Read it once, and only when a fiscal range is shown.** Read it once per
  control, held on the instance: nothing promises the same `webAPI` object
  on every `updateView`, and the rig does not give one. A rail without a
  fiscal range should cost no request. A failed or missing read falls back
  to January, the platform's own default, never to a broken rail.
- **Month names arrive with 13 entries.** `dateFormattingInfo.monthNames`,
  `abbreviatedMonthNames` and both genitive arrays are .NET's: twelve names
  and an empty string (measured 2026-10-29). Take the first twelve, and fall
  back unless all twelve are non-empty. A fixture with exactly twelve hides
  an off-by-one; give the rig the thirteen.
- **A control that reuses buttons across a re-render must not `disable` the
  focused one.** A month grid redrawn for the next year keeps the same twelve
  buttons, so the one holding focus can turn out of bounds under it. It was
  blurred to `BODY` on the form (`pcf-date-range-picker` 0.4.0, Page Down
  onto September 2027 under a 90-day bound). Make an out-of-range cell
  `aria-disabled` and refuse its press: *A button that is working keeps
  focus* in [accessibility.md](accessibility.md).

### A date read through a dataset

Moved to [dates-in-a-dataset.md](dates-in-a-dataset.md) on 15 Oct 2026, with
the sections that followed it, so each file can be read whole:

- **A date read through a dataset**
- **The timeline, and a drag with nothing to drop on**
- **Demo presets**
