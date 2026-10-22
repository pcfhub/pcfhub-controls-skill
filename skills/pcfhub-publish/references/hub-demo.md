# The demo

What `demo` in `pcfhub.json` asks the hub to run, and the harness it runs in:
fidelity, the host surface, presets, fixtures and the stand-in Dataverse. The
rest of the hub contract — `pcfhub.json` itself, the docs, the media, the
release artifacts — is in [pcfhub-manifest.md](pcfhub-manifest.md).

- [The demo block](#the-demo-block)
  - [`demo.host`](#demohost)
  - [Choosing the fidelity: what leaves the browser, and what the harness answers](#choosing-the-fidelity-what-leaves-the-browser-and-what-the-harness-answers)
  - [The device and navigation](#the-device-and-navigation)
  - [A dataset, and a lookup, in the harness](#a-dataset-and-a-lookup-in-the-harness)
  - [Presets: set every input](#presets-set-every-input)
  - [The canvas host](#the-canvas-host)
  - [A preset's state](#a-presets-state)
  - [A preset's own fixture, and the role aliases](#a-presets-own-fixture-and-the-role-aliases)
  - [A `dataverse` section: a small Dataverse behind the demo](#a-dataverse-section-a-small-dataverse-behind-the-demo)
  - [The demo bundle, and its path](#the-demo-bundle-and-its-path)

## The demo block

At `fidelity: "none"` the hub never requests a manifest and shows the video and
screenshots instead, regardless of what the release carries. Everything else in
the block is inert until fidelity says otherwise.

```json
"demo": {
  "fidelity": "mocked",
  "bundle": "out/controls/TagList/bundle.js",
  "styles": ["out/controls/TagList/css/TagList.css"],
  "datasetFixture": "demo/tags.json",
  "presets": [
    {
      "slug": "default",
      "name": "Default",
      "description": "A typical set of tags on a record.",
      "props": {},
      "isDefault": true
    }
  ]
}
```

| `fidelity` | Means |
| --- | --- |
| `full` | Fully interactive — the control never reaches Dataverse, WebAPI, or anything else the harness cannot fake |
| `mocked` | Interactive against simulated data instead of a real platform call |
| `limited` | Partially interactive; `demo.limitations` must list what is stubbed |
| `none` | No demo — video and screenshots only |

### `demo.host`

Which surface the harness stands up **around** the control: `form` (the default,
and every demo written before the key existed) or `grid`.

`form` hands the control a container and lets it render into it, the way a
model-driven form hosts one. `grid` renders a grid over the `datasetFixture` and
calls the control's cell renderers and editors per cell — the shape a
[grid customizer](../../pcf-controls/references/grid-customizers.md#grid-customizers) needs, because its
`updateView` returns an empty fragment and hosting it the `form` way produces a
correctly-loaded, entirely blank iframe.

```json
"demo": {
  "fidelity": "mocked",
  "host": "grid",
  "bundle": "out/controls/GridCellStyler/bundle.js",
  "datasetFixture": "demo/accounts.json",
  "limitations": ["Error, secured and required cell states are not exercised"]
}
```

**Declared, never inferred** — same reason as `fidelity`. The only sniffable
signal is "has a bound `SingleLine.Text` property", which describes an enormous
number of ordinary field controls, and guessing wrong puts a table of records on
a page where a form belongs. A malformed value is an ingestion error rather than
a fallback, since the two surfaces are not interchangeable.

Four consequences worth knowing before setting it:

- **`datasetFixture` is required in practice.** It is the grid's *rows*. For a
  dataset control the same file becomes the control's bound dataset; a grid
  customizer has no dataset property to bind it to. The validator warns when a
  grid host declares none, because the demo then renders an empty table and the
  cell renderers never run — unless every preset names a fixture of its own
  (below). The file may carry a `dataverse` section too (from 2026-09-28): the
  grid then has `page.getClientUrl()` and the fetch routes behind it, and a
  choice cell's `formattedValue` is its label, its `value` still the number.
- **`fidelity` tops out at `mocked`.** The grid is a stand-in for the Power Apps
  grid, so `full` is a claim it cannot support, and the hub's validator warns
  on it at `/demo/fidelity` (from 2026-10-13). A warning, not the rejection
  this file once described: until that change nothing noticed at all (asked
  2026-10-12). Note this is the one place `mocked` and a populated
  `limitations` array belong together — the tier describes the interactions,
  the array names what the stand-in does not exercise.
- **The manifest must declare `<platform-library name="React">`.** The harness
  refuses to boot a grid host without one, deliberately: cell renderers dispatch
  hooks through the React instance their own bundle imported, and a control
  bundling its own React fails with `Invalid hook call` thrown from inside a
  minified bundle, which names nothing.
- **The harness seeds the event-name property itself**, since in the platform
  the host generates that value and nothing would here. It looks for a property
  named `EventName`, falling back to the single text input a customizer manifest
  has — so keep the name.

What the grid host does *not* exercise, and therefore what belongs in
`limitations`: `PAGridAPI`, server-side sorting/filtering/paging, row
virtualization and selection, and the cell states a fixture carries no metadata
to derive — `validationError` is always `null`, `secured` and `isRequired`
always `false`. **A green grid demo is
therefore not evidence that a control's error, secured or required paths work.**

Choosing it is an author judgement the hub cannot infer from the code. Two
questions, in order.

### Choosing the fidelity: what leaves the browser, and what the harness answers

**Does any user-visible path leave the browser?** `<uses-feature name="WebAPI">`,
a `context.webAPI` call, `context.device.*`, or a `context.navigation` method
that opens something — a form, a URL, a platform dialog — all mean not `full`.
Pure rendering and local state means `full`.

**Can the harness supply what every remaining path needs?** This is the question
people skip, and it is what separates `mocked` from `limited`.

- `mocked` — every interaction works, just against simulated data instead of a
  real platform call. Nothing in the UI is dead.
- `limited` — at least one interaction has nothing truthful to return and
  visibly does not work. `demo.limitations` must name each one.

`demo.datasetFixture` seeds only the **bound** dataset. So a chip control that
removes an already-attached record is `mocked` — the record is in the fixture.
The same control with an attach type-ahead that searches records the harness was
never given is `limited` — unless its fixture gives the harness those records
through a `dataverse` section (below), which is what took `pcf-tag-list` 0.5.0
back to `mocked`.

**Most of what used to make a demo `limited` is now answered, and this section
said otherwise until 2026-10-12.** Each rule below replaces one that read "is
`limited`" or "do not"; each was true when written and is not now. A control
whose `demo.limitations` still describes the old harness is describing a demo
it no longer has — reread them against this before a release.

**An `external-service-usage enabled="true"` control calls a service the
sandbox cannot reach, and the fixture can answer for it.** The demos origin's
CSP closes `connect-src` to everything but the hub, so the request itself fails
as an unreachable network. From 2026-09-29 the fixture may carry a `services`
list of canned answers beside `dataverse` (the hub's
`docs/demo-harness-service-answers.md`), for the hosts the control's manifest
declares and no others:

```json
"services": [
  { "url": "https://atlas.microsoft.com/geocode:autocomplete",
    "query": { "query": "1 Microsoft Way, Redmond" }, "delayMs": 250,
    "body": { "type": "FeatureCollection", "features": ["…"] } },
  { "url": "https://atlas.microsoft.com/geocode:autocomplete",
    "body": { "type": "FeatureCollection", "features": [] } }
]
```

`url` is the host and path with no query string; `query` matches when the
request's value and the entry's overlap, either containing the other, so `mic`
reaches an entry keyed on the full text; `method`, `status` and `delayMs` are
optional; **the first entry that matches answers**, so the fallback goes last.
Each answer is logged as *canned* — the author's sample, not the service's.
`pcf-address-autocomplete-azure` went from `limited` to `mocked` on it. Say in
`demo.limitations` which queries have an answer, and what the service costs,
because the demo is where somebody decides whether to install a premium
component. Without a `services` section the demo is the control with its
external feature off; say that instead.

### The device and navigation

**`context.device.*` is refused unless a preset says the demo is the mobile
app.** A model-driven form in a desktop browser has none of those calls, so by
default each rejects and the demo shows the control's own no-device state —
the truth about the host a desktop visitor is on. A preset's `state.device`
(below) answers them as the Power Apps mobile app would, and the event log
says *simulated*. `pcf-barcode-scanner` ships both: *On the mobile app* scans
a fixed code into the field, *In a desktop browser* shows the refusal.

**`context.navigation` is answered, by the page around the frame.** The sandbox
has no `allow-modals`, no `allow-popups` and no forms, so the harness does each
itself:

- **The three dialogs are drawn in the frame** and resolve as the visitor
  answers them (from 2026-09-26). Before that a confirm was answered
  "cancelled" unseen, and a button behind one was dead. Their default labels
  are English, and an error's `details` shows under a disclosure rather than
  as a download.
- **`openUrl` and `openFile` go to the parent page**, which names them in the
  event log and lets the visitor follow the link or save the file.
- **`openForm` for a new row** of a table the stand-in Dataverse has opens a
  stand-in quick create form that really creates the row (2026-09-30): the
  primary name, the view's columns and any others the fixture describes, form
  parameters prefilled, `createFromEntity` binding it to its parent. A real
  quick create form is whatever its maker laid out. For an existing record, or
  a table the fixture lacks, the event log names what would have opened.
- **On the canvas host each of these but `openUrl` throws**, as it does there.

`pcf-row-commands` withheld Delete while the dialogs were missing. It now shows
it on the model-driven host, asks through the drawn confirm and deletes from
the stand-in, and loses it on the canvas host; its Open still has no form to
arrive at, and says so. Where a press is reported through an output property,
say that too — the outputs are real.

### A dataset, and a lookup, in the harness

**A dataset control that pages, sorts, filters or selects is no longer
`limited` for that.** Until 2026-09-27 the harness rebuilt the view on every
render — one page whatever the page size, a sort that moved the arrow and not
the rows, a tick that could clear on the next pass — and every dataset control
on the hub published `limited` with a limitation for each. The view now keeps
its state (the hub's `docs/demo-harness-dataset-view.md`): the page, the page
size, the filter, the sort and the selection survive renders, and, as on a
form, a control *asks* (`setFilter`, `setPageSize`, a change to `sorting`) and
a fetch *applies* (`refresh()` or a paging call). `pcf-compact-list` pages
eight at a time over 24 rows at `mocked`; `pcf-row-commands` sorts, pages and
selects at `mocked`. What a limitation may still need to say:

- **Filtering** answers `Equal`, `NotEqual`, the four comparisons, `Like`,
  `Null` and `On`/`OnOrBefore`/`OnOrAfter`. **Any other operator lets every row
  through**, so a filter the demo cannot apply reads as nothing filtered.
- **Sorting** takes every entry, in order, and a choice by its label where the
  fixture describes its options — not by a lookup's name.
- **Paging** counts the filtered set. `loadNextPage` and `loadPreviousPage`
  accumulate and leave `hasPreviousPage` false, and `loadExactPage` returns
  exactly its page, the two quirks measured on a real form. The page is 25
  rows when a control never asks. A `totalResultCount` of -1 and a page
  shorter than the one asked for are not modelled.

**A preset whose `pageSize` is below the fixture's row count is how paging is
shown now**, not a mistake: `pcf-kanban-board`'s *Narrow lanes* asks for six of
nine and grows with Load more. The rule here said the opposite while the
harness served every row on one page.

**"Is there a server behind it" is not the question; "can the harness answer
truthfully" is.** What the stand-in still refuses outright — FetchXML, a Web
API function, `$expand`, a `$filter` operator outside its list — is where a
limitation still belongs. `pcf-data-table`'s group totals and
`pcf-kanban-board`'s lane totals take the browser route in the demo because
the aggregate query is refused, and each says so.

**A control bound to a `Lookup.Simple` column can be demoed whole, given a
`dataverse` fixture.** Until 2026-09-24 it was `limited` before it did
anything: a lookup property was a plain bag, so `getTargetEntityType()` was
absent and a search or a Browse had nothing behind it. The property now
carries `getTargetEntityType()` — its value's own `entityType`, else the table
`lookupTargets` names for it — `webAPI` answers the search from the fixture's
tables, and `utils.lookupObjects` opens the harness's own lookup dialog: a
searchable list, without the platform dialog's views and columns.
`pcf-lookup-search` is `mocked` on it. What still cannot be shown: an unmapped
lookup (below), and a refused read — the stand-in refuses writes, never reads.

Guessing `full` and being wrong is worse than declining to demo: a demo that
silently falls back to mocked data misrepresents the control.

`limitations` should read as sentences a user can act on, naming the API and
what happens instead:

```json
"limitations": [
  "The scan is simulated. The On the mobile app preset answers context.device.getBarcodeValue() with a fixed code, and the event log under the demo says the answer was simulated. What the control does with it is real: the code lands in the field and in the value output",
  "The In a desktop browser preset declares no scanner, so getBarcodeValue() is refused and Scan shows the control's own no-scanner state; typing the code in still fills the field, since that path never touches context.device"
]
```

`presets` give the demo named states — an empty one, a full one, one that hits
an overflow path. Each has a `slug`, `name`, `description`, and a `props` object
keyed by property name; optionally a `state`, the form around the control, and
a `datasetFixture` of its own (both below). Mark one `isDefault`.

`props` covers **bound properties as well as inputs** — the harness builds a
real `Property` for every declared property except outputs. For a field control
this is where its demo *state* lives. What it queries is a different matter:
a `datasetFixture` holding only a `dataverse` section (below) is the answer, and
**never** a demo-only input property carrying sample data — that is plumbing in
every maker's panel. Three controls tried it; `pcf-tag-list` 0.5.0 and
`pcf-hierarchy-view` 0.2.0 have removed it, and `pcf-audit-history` keeps it
only because the stand-in answers no Web API functions.

### Presets: set every input

**Set every input property in every preset.** A manifest `default-value` reaches
the harness as the raw XML *string*: the parser stores the attribute verbatim.
Until pcfhub#49, `Parameters.ts` built a `TwoOptions` as `raw: Boolean(raw)`, so
`default-value="false"` arrived as `Boolean("false")` — `true` — and a numeric
default as its text (`"25"`). `pcf-data-table` 0.7.0 paid for it on the live
demo: every switch its presets left unset was on, so `lockColumnWidths` hid the
resize handles and the Default preset drew New, Export CSV and edit pencils it
is not configured for (2026-09-27; fixed control-side in `ebdf6ac`).
pcfhub#49 reads the text as the value it names — `"true"`/`"1"` true, other
text false, numeric text a number — so a demo deployed after it no longer
flips an unset switch. **Set them anyway.** A preset that names every input
does not depend on which harness is serving it, and it states the demo's
configuration where a reader of `pcfhub.json` can see it. And still do not work
around the harness in the control by coercing strings; that pollutes
production code to suit a harness.

**Column metadata comes from the fixture, and only as far as the fixture states
it.** Without a `dataverse` section a bound property's `attributes` is names
and nothing else — `DisplayName`, `LogicalName`, `Description`, `IsSecured`,
`SourceType` and `RequiredLevel` (`baseAttributes()`) — so a control reading
`attributes.Options` for a Choice column draws an empty picker in its own demo.
From 2026-09-28 `dataverse.tables.<table>.columns.<column>` describes the
column a property is placed on, in the form record's table (`boundColumns`,
else the property's own name), and the property then also carries `Options`
(`{ Label, Value, Color }`, in the maker's order), a date's `Behavior`, and a
number's `MinValue` and `MaxValue`; a choice property's `formatted` is its
label. `pcf-choices-picker` is `full` on exactly that. Still no `MaxLength`,
no `Precision`, no `Type` — and an input property sits on no column, so it
gets none of it.

- **Describing a column makes the demo a model-driven host.** A `dataverse`
  section brings `page.getClientUrl()` and an organisation URL with it, so a
  control that tests for them starts offering what it offers on a form — a
  **+** that opens a quick create form, a Delete. Rewrite `demo.limitations`
  in the same change.
- **`EntityLogicalName` names the form record's table only where the fixture
  puts the property on a column** (from the hub's 2026-10-13 harness; absent everywhere before
  it): `boundColumns` names one, or the table describes one of the property's
  own name, and `record` says whose table that is. A control that asks whether
  a column is there before believing `attributes` — the template's `columnOf`
  — believes the demo's `Options` and ranges only then. `pcf-number-slider`
  0.1.2 ran to a maker's 5,000,000 over a fixture declaring 0 to 1,000,000
  until the hub named the table. A fixture with no `dataverse` section names
  none, so such a control takes its no-column path on the form host as well:
  say so in `demo.limitations`, and do not drop the guard to suit the demo.
- **Give that column a `displayName`** — `"cr123_status": { "displayName":
  "Status", … }` (from 2026-10-13). Without the key, `DisplayName` is the
  property's own name beside a real table's, and a control that announces it
  says "value: Draft" where a form says "Status: Draft". `pcf-choices-picker`'s
  fixture has it.
- **An input carrying the option list is still not a demo-only hack.** A canvas
  app has no column either, so a preset that fills it exercises the path a
  canvas maker uses in production, and that control is honestly `full` — a
  different *source* for the same data is not a stubbed interaction.

### The canvas host

**The demo's canvas host hands a bound property what a canvas app does**
(from 2026-10-13; `attributes: undefined` before it, when this said the host
was not a canvas app where `attributes` is concerned). Switch the toolbar to
*Canvas app*, or name it in a preset's `state.host`, and each bound property
carries the description a canvas app was read to hand over on 2026-10-06: an
empty `EntityLogicalName`, the property's own name as `LogicalName` and
`DisplayName`, `MaxLength: 100`, the type's default range and precision, and a
date `Behavior` (*`attributes` is where canvas and model-driven actually
diverge* in `pcf-controls/references/properties.md`). So the canvas host now catches a
control that believes it. The run that introduced it, over every published
preset, found two: `pcf-choices-picker` 0.1.1 announcing each pill as "value:
TypeScript" (fixed in 0.1.2), and `pcf-sla-timer` 0.3.0 taking its canvas
formatter for the first time there.

- **An input property keeps `attributes: undefined`.** What a canvas app hands
  an input was not read.
- **A choice's `Options` is the empty list**, the `<property>_Options` table
  nobody filled. A demo has no maker to fill it, so a control with an options
  input of its own takes that, as in a canvas app.
- **`mode.contextInfo` is still absent**, where a canvas app publishes one
  about a record that does not exist. A control that trusts it there is not
  shown doing so.

A control that treats missing metadata as *absence of a constraint* rather than
as data it needs has nothing to do here. `pcf-star-rating` reads
`attributes?.MaxValue` to cap its icon count and falls back to the maker's own
`max` when it is undefined — which is the canvas path, the demo path and the
"column has no ceiling" path all at once, with no demo-specific branch.

### A preset's state

**A preset's `state` is the form around the control** — what `props` cannot
say, since `props` builds properties and nothing else. This read "Presets
cannot express `context.mode`" until 2026-10-12; they have since 2026-09-27
(the hub's `docs/demo-harness-preset-state.md`):

```json
{ "slug": "no-access", "name": "Field security: no read",
  "props": { "placeholder": "Start typing an address" },
  "state": {
    "disabled": true,
    "hidden": false,
    "properties": { "value": { "readable": false, "editable": false,
                               "error": "Enter a postcode." } },
    "device": { "barcode": "9780201633610", "files": true,
                "position": { "latitude": 47.62, "longitude": -122.35, "accuracy": 8 } },
    "timeZone": "America/New_York",
    "host": "canvas"
  } }
```

| Key | Becomes |
| --- | --- |
| `disabled` | `mode.isControlDisabled`, through the toolbar's Read-only toggle, which the visitor can still flip |
| `hidden` | `mode.isVisible` false |
| `properties.<name>.readable` / `editable` | that property's `security`, `secured: true`. A column the user may not read arrives with `raw` null and `formatted` undefined, as field security delivers it; a lookup's `raw` is an empty list |
| `properties.<name>.error` | `error: true` and `errorMessage` on that property |
| `device` | `context.device` answered as the Power Apps mobile app: `barcode` for `getBarcodeValue`, `position` for `getCurrentPosition` (`latitude`, `longitude` and `accuracy` required), `files: true` for `pickFile` and the three captures, through the browser's own file picker. Only what is declared answers, and every answer is logged *simulated* |
| `timeZone` | the Dataverse user's zone, an IANA name, for `userSettings.getTimeZoneOffsetMinutes` — so a fixture's instants land on the same wall time for every visitor |
| `host` | the app the preset opens in, `canvas` or `model-driven`; it has to be one of the manifest's `hosts` |

Everything is optional, each preset replaces the last one's state whole, and a
preset without one is the plain form it always was.
`pcf-address-autocomplete-azure` has a preset for each of the form's: read-only,
no read access, a secured city, a business rule's error, hidden. What it still
does not model: a dataset column's field security per cell, a required level,
and a rule that changes state as the visitor edits. Screenshots are the answer
for those.

`datasetFixture` points at a JSON file of records for a dataset control. Each
column carries both names: `alias` is the property-set role from the manifest,
`name` is the real Dataverse column, and each record's `values` are keyed by
`name`.

```json
"columns": [
  { "name": "cr123_tagname", "alias": "labelField", "dataType": "SingleLine.Text" }
],
"records": [
  { "id": "1", "values": { "cr123_tagname": "Feature" } }
]
```

### A preset's own fixture, and the role aliases

**A preset can name a fixture of its own** — `datasetFixture` on the preset,
in place of the demo's (live from 2026-10-12; `pcf-kanban-board`
is the first):

```json
"datasetFixture": "demo/records.json",
"presets": [
  { "slug": "default", "name": "Sprint board", "props": {}, "isDefault": true },
  { "slug": "swimlanes", "name": "Swimlanes by area", "props": {},
    "datasetFixture": "demo/swimlanes.json" }
]
```

Reach for it when a preset has to show something that is not a property.
**Which column a `property-set` role is bound to is the column's `alias` in the
fixture, and the rows are the fixture** — so an optional role, an empty view or
a view of other rows cannot be a preset over the shared file. Kanban Board
0.5.0 shipped swimlanes, a sixth and optional role, with no preset for them:
binding the role in the file all five presets shared would have split every
board into rows. A preset that names none takes `demo.datasetFixture`, as
every preset did before the key existed.

- **It is a whole fixture, not a patch.** `columns`, `records` and a
  `dataverse` section of its own: the option labels, the faults and the tables
  a write needs are read from the file in front of the control, never from the
  demo's.
- **Keep the copy from drifting.** Two files holding the same rows part the
  first time a column is added to one, and every check still passes.
  `pcf-kanban-board`'s `demo/swimlanes.json` is `demo/records.json` with one
  alias changed, and its `dev/smoke.js` fails when anything else differs.
- **It never falls back to the demo's.** A file the hub cannot read leaves the
  preset with what it had — no rows, on its first sync — and the ingestion run
  names the path. The demo's rows under that preset's name and description
  would look fine and be wrong. A preset that stops naming one returns to the
  demo's on the next sweep.
- **The visitor gets a second view, and edits do not cross.** The harness keeps
  one stand-in Dataverse, and one page, sort and selection, keyed by the
  fixture in front of it. Presets that share a fixture share them, so a card
  moved under one is still moved under the next; picking a preset with another
  fixture puts the cards of both back where they started (measured with Kanban
  Board's 0.5.0 bundle, 2026-10-12). Say so in `demo.limitations`, above all
  where another entry promises that an edit survives.
- **Read like the demo's**: at the default branch, every sweep, once per path
  however many presets share it, under the same 256 KB cap and the same shape
  check. A `grid` host whose presets all bring their own is not warned about a
  missing `demo.datasetFixture`.
- **The rig has to know the key too.** From `_template` 76a83e7 (2026-10-12)
  `npm run check` opens each preset's file and `dev/hub-demo.html` hands each
  preset its own. With an older rig a typo in the path passes, and
  `demo-check` shows every preset over the demo's rows while the live page
  shows the right ones — so sync the rig first.

What the stand-in answered for one role bound four ways, with that bundle over
fixtures derived from its demo's: a Choice and a Yes/No drew their rows — a Choice's options with no card in them
included, read through `getEntityMetadata` — and wrote through the record's
`setValue` and `save`; Owner and a lookup drew a row per user, team or account
and wrote through `<navigation>@odata.bind` on `webAPI.updateRecord`, after
reading `ManyToOneRelationships` and the target's `EntitySetName`. A lookup
column among the dataset's own rows is a `Lookup.*` column whose value sits
under `_<column>_value`, with a `oneToMany` relationship per target table —
Owner takes two, user and team, on the one navigation property.

Do not set `name` and `alias` to the same string to save typing. A control that
has the column lookup backwards resolves fine against a fixture like that and
renders nothing at all against real data — which is the one bug the harness is
in a position to catch.

### A `dataverse` section: a small Dataverse behind the demo

Moved to [hub-demo-dataverse.md](hub-demo-dataverse.md) on 15 Oct 2026, with
the sections that followed it, so each file can be read whole:

- **A `dataverse` section: a small Dataverse behind the demo**
- **Refusing a write**
- **File and Image columns**
- **Running the real harness before the hub has it**
- **A choice: its number in the record, its label in the metadata**

### The demo bundle, and its path

The demo bundle is not something you build separately, but be precise about
which build produces it. `npm run build` writes a **development** bundle to
`out/controls/`. The release workflow then runs the msbuild solution pack, and
because the `.pcfproj` sets `<PcfBuildMode>production</PcfBuildMode>`, that pack
rebuilds into the same directory and **overwrites** it. The bundle attached to
the release is msbuild's minified one, not `npm run build`'s.

The difference is not academic: `pcf-choices-picker` is 23,543 bytes after
`npm run build` and 5,946 after the pack. Reading it the other way round implies
an unminified bundle is being shipped to the hub, which would be a bug rather
than the current behaviour.

Either bundle calls `window.ComponentFramework.registerControl` when the harness
has defined it — that is the hook the hub boots against, so there is nothing
hub-specific to build.

**The bundle path is `out/controls/<Constructor>/bundle.js` — the constructor
alone, with no namespace prefix.** `pcf-scripts` does not namespace the output
directory, so `out/controls/PCF.CodeEditor/bundle.js` is a path that never
exists. Nothing validates this: `npm run check` does not look at `demo.bundle`,
and the demo simply fails to load. One repo on the hub has it wrong today.
Confirm the path against a real `npm run build` rather than composing it from
the manifest.

`demo.styles` has the same shape: `out/controls/<Constructor>/css/<Control>.css`.
