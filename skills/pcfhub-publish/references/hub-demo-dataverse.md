# The demo's Dataverse, and the real harness locally

The `dataverse` section that makes the hub's harness a small Dataverse behind a
demo — tables, refusals, File and Image columns, choices — and running the real
harness before the hub has the control.

Split out of `hub-demo.md` on 15 Oct 2026, so each file can be read whole.

- [A `dataverse` section: a small Dataverse behind the demo](#a-dataverse-section-a-small-dataverse-behind-the-demo)
- [Refusing a write](#refusing-a-write)
- [File and Image columns](#file-and-image-columns)
- [Running the real harness before the hub has it](#running-the-real-harness-before-the-hub-has-it)
- [A choice: its number in the record, its label in the metadata](#a-choice-its-number-in-the-record-its-label-in-the-metadata)

## A `dataverse` section: a small Dataverse behind the demo

**A `dataverse` section makes the harness a small Dataverse** (the hub's
`docs/demo-harness-dataverse.md`). Optional, beside `columns` and `records`,
and stored whole by ingestion, so it needs no other key.

**On a field control it is the whole fixture** (pcfhub `demo-dataverse-field`,
2026-09-24; `pcf-lookup-search` is the first). A control without a dataset property has no rows to be given, so
its `demo.datasetFixture` carries only `dataverse`, and the harness sends it
beside the props the way a grid host's rows travel. What the file must hold is
decided by who reads it — the hub's `DemoFixtureShape`, mirrored in
`check-template.mjs`: `columns` + `records` for a dataset control or a grid
host, a `dataverse` object or a `services` list (above) for anything else. A
field fixture with rows and neither is refused at ingestion. Two more keys
matter there:

- **`lookupTargets`** — `{ "value": "contact", "parentValue": "account" }`,
  the table each lookup property points at. On a form `getTargetEntityType()`
  answers whether or not the lookup holds a value; the harness otherwise knows
  the table only from a value's `entityType`, so an *empty* lookup — the one a
  search box shows in — points at no table.
- **`boundColumns`** — `{ "value": "parentaccountid" }`, the column each bound
  property is placed on, answered as its `attributes.LogicalName` (pcfhub
  #35, 2026-09-24). Without it the harness reports the property's own name,
  and a control that queries `_<column>_value` from it asks for `_value_value`.
- **One record for every preset that shares the fixture.** `record` is the
  form record for the fixture; presets over it change inputs around that
  record, never which record the form is on. A preset that names a fixture of
  its own (above) carries its own `record` — the fixture travels with the
  preset — though no published control has put a second record in front of a
  field control that way yet, so run it in `demo-check` before relying on it.
- **No unmapped state.** The harness builds every lookup property with a
  `type` and an array `raw`, so a control reading `type === null` as "nothing
  mapped" (an optional second bound column) always sees a mapped one. List it
  in `demo.limitations` if the control has a message for it.
- **A type group is demoed as its first member** (`DemoPropertyData::
  fromModel`, pcfhub main 57959f4): `type` is that member, and the property is
  built as one. List first the member the demo should be — `pcf-number-slider`
  listed `Whole.None` first and every preset was a whole number. A form
  ignores the order.
- **A number column gets only its range.** `tables.<t>.columns.<c>` with
  `minValue`/`maxValue` becomes `attributes.MinValue`/`MaxValue`; there is no
  `Precision` and no `Type`, and `formatted` is `String(value)` — no grouping,
  no currency symbol. A control that reads `Precision` falls back to `type`
  in the demo, which is the canvas path anyway; say what the demo cannot show
  in `demo.limitations`.
- **Run every preset in the real harness before publishing — `npm run
  demo-check`.** The template's `dev/hub-demo.html` (from 4 Oct 2026; it was
  `pcf-file-preview`'s and `pcf-number-slider`'s, hand-written per control)
  frames `npm run dev:demo-harness`, answers its handshake with the manifest
  **built from `ControlManifest.Input.xml` the way ingestion builds it** — a
  type group as its first member, an Enum's values, the dataset property
  carrying the fixture, the platform libraries, each preset's `state` — and
  logs `harness:outputChanged`; `window.__send('harness:updateProps', …)`
  changes an input on the mounted control. `dev/demo-check.js` picks every
  preset there and measures inside the frame; `--live` does the same on the
  published page, which is the only run that carries the live CSP (below).
  **It needs this repository's own harness on the port.** `dev/serve.js` takes
  the next free port when 8181 is taken, so a harness left running for another
  control keeps 8181 and `demo-check` reads *that* control's page — every preset
  name falls back to its default preset, and every one reports clean. On
  2026-10-16 four controls' runs were Code Editor's, all "ok", until a 336-pixel
  star rating gave it away. From that day `demo-check` reads `pcfhub.json` off
  the port and stops unless the slug is this repository's; a copy older than
  that does not, so check the slug — or the sizes — before trusting a clean run.
  A repository with no `dev/harness.html` (`serve.js` refuses to start) can be
  served by any static server from its root.
  Proven on the day it landed: Number Slider 9/9 live and through the stand-in,
  Calendar View 4/4 through it. Drive the sandboxed frame through headless
  Chrome's DevTools protocol — it is its own target — not the pane, and
  **photograph it with `captureBeyondViewport` off**: with it on, the frame's
  area comes back blank while the page around it paints.
  **Size the stand-in's frame from `harness:resize`, as the hub does.** The
  harness posts `{ type: 'harness:resize', height }` — the control's box —
  and the hub sets its frame to that height; a stand-in with a fixed-height
  frame cannot show a control whose drawing hangs below its own box, because
  the spare height hides it. `pcf-number-slider` 0.1.0's arc did exactly
  that — an SVG 10px taller than the box a negative margin left it — and
  passed a 360px stand-in, then scrolled on the live page (0.1.1). With the
  frame sized by `harness:resize` the same build overflowed by a pixel in the
  stand-in, measured 4 Oct. So per preset, inside the frame, compare
  `documentElement.scrollHeight` with `clientHeight` **exactly** — a one-pixel
  tolerance passed it — and the bottom of the control's box with the bottom of
  what it draws.

The full section, for a dataset control:

```json
"dataverse": {
  "record": { "entityType": "account", "id": "<guid>", "name": "Adventure Works" },
  "tables": {
    "account": { "entitySet": "accounts", "primaryId": "accountid", "primaryName": "name" },
    "cll_tag": { "entitySet": "cll_tags", "primaryId": "cll_tagid", "primaryName": "cll_tagname" }
  },
  "relationships": [
    { "kind": "manyToMany", "schemaName": "…", "entity1": "account", "entity2": "cll_tag",
      "entity1NavigationProperty": "…", "entity2NavigationProperty": "…", "links": [["<account>", "<tag>"]] },
    { "kind": "oneToMany", "schemaName": "…", "referencedEntity": "account", "referencingEntity": "cll_tag",
      "referencingAttribute": "cll_account", "referencingNavigationProperty": "cll_account" }
  ],
  "subgrid": "<the relationship the dataset shows, from record's side>"
}
```

`record` becomes `mode.contextInfo` and adds `page.getClientUrl()`
(`https://org.pcfhub.invalid`, answered by a fetch shim); `tables` answer
`getEntityMetadata`; `relationships` answer `EntityDefinitions` and `$ref`;
`subgrid` narrows the dataset to the linked rows, re-read on every refresh.
`webAPI` answers `$select`, `$filter` (`contains`/`startswith`/`endswith`/`eq`/
`ne`, joined by `and` and — from 2026-09-24 — `or`, with parentheses),
`$orderby` and `$top`; `lookupObjects` opens a simple dialog. Before `or`, a
type-ahead matching one term across several columns was refused outright. A
lookup selected by its logical name comes back as `_<column>_value`, as the Web
API does it — until #35 it came back as `<column>: null`, which cost
`pcf-hierarchy-view`'s demo the top of its tree.
Make the label column the table's `primaryName`, or a search finds nothing.

**A lookup role on the dataset reads from the same pair.** Bind the role to a
`Lookup.Simple` column in the fixture's `columns`, keep each row's value as
`_<column>_value` with the target's id, and declare a `oneToMany` whose
`referencingAttribute` is that column: the record's `getValue` then answers the
reference a form hands over, named from the target row's `primaryName`, and
`getFormattedValue` the name. A lookup from a table **to itself** works the
same way — `referencedEntity` and `referencingEntity` both the dataset's table
— and the name comes from the target row even when the window or the page has
not loaded it, as on a form (`pcf-calendar-view` 0.4.0's Parent and Depends on,
checked in the hub's harness and on pcfhub.dev, 2026-10-27). An empty lookup
reads as `''` here and `null` on a form, so treat both as unset. The template's
stub preview hands values over as stored and does none of this.

## Refusing a write

**It refuses a write when the fixture says so** (from 2026-09-28; this said
"it does not model privileges" until 2026-10-12). Two keys:

```json
"tables": { "cr123_workitem": { "entitySet": "cr123_workitems", "primaryId": "cr123_workitemid",
  "primaryName": "cr123_subject", "privileges": { "delete": false } } },
"faults": [
  { "operation": "update", "table": "cr123_workitem", "column": "cr123_status",
    "value": 3, "message": "Only a team lead can resolve a work item." }
]
```

- **`tables.<table>.privileges`** — `create`, `read`, `write`, `delete`,
  `assign`, `share`, `append`, `appendto`, absent meaning yes. They answer
  `utils.hasEntityPrivilege`, synchronously, and `create`, `write` or `delete`
  set to `false` refuses that write in the platform's own sentence.
- **`faults`** — a write refused as a plugin or a business rule would, with
  the author's `message`. `operation` is `create`, `update`, `delete`,
  `associate` or `disassociate`; `id`, `column` and `value` narrow it to one
  record, a write that sets that column, and the value it is set to. A lookup
  bound through `@odata.bind` counts as its column.

A refused `record.save()` discards what was staged and the record reads as it
was, so a rollback has something true to roll back to: `pcf-kanban-board`'s
move into Resolved and `pcf-data-table`'s City edit both show it. The event
log calls it *rejected*, apart from *refused*, which still means a request the
demo cannot answer. Reads are never refused, and `record.isEditable()` still
answers from the fixture column's `isReadOnly`, not from privileges.

Still not answered, and still for `limitations`: FetchXML, a Web API function,
`$expand`, and a next page of `retrieveMultipleRecords` — there is no
`nextLink`.

## File and Image columns

**File and Image columns** (on the hub from 2026-10-02): a column in `tables.<t>.columns`
with `type` `File` or `Image` carries `maxSizeInKB` (and `canStoreFullImage`),
and `dataverse.files` holds the bytes:

```json
"tables": { "account": { "entitySet": "accounts", "primaryId": "accountid", "primaryName": "name",
  "columns": {
    "cr123_contract": { "type": "File", "maxSizeInKB": 1024 },
    "cr123_photo": { "type": "Image", "canStoreFullImage": true, "maxSizeInKB": 1024 } } } },
"files": [
  { "table": "account", "id": "<guid>", "column": "cr123_contract",
    "name": "contract.pdf", "mimeType": "application/pdf", "content": "<base64>" },
  { "table": "account", "id": "<guid>", "column": "cr123_photo",
    "name": "storefront.png", "mimeType": "image/png",
    "content": "<full-size base64>", "thumbnail": "<144px base64>" }
],
"blockedAttachments": "ade;exe;js"
```

`content` is base64 unless `"encoding": "text"`; an Image file without a
`thumbnail` answers its `content` to both requests.

The harness then answers `GET …/$value` (`?size=full` for an Image column),
`PATCH` and `DELETE` for the session, the two metadata casts, and
`organizations?$select=blockedattachments` — with the service's own
refusals: over the limit, a blocked type, a non-image into an Image column.
`pcf-file-preview` is the first. Two things this costs the demo, both for
`demo.limitations`: a write lasts until the page is reloaded, and **a PDF
cannot draw** — the demo frame is sandboxed without `allow-same-origin`, and
Chrome will not run its PDF viewer in a sandboxed document. A control that
draws PDFs reads `globalThis.origin === 'null'` and offers Open and Download
instead.

## Running the real harness before the hub has it

**To run a control inside the real harness before the hub has it**, give the
harness a stand-in parent: a page on another port that frames the hub's
`demo-harness` with the fixture and props in the `postMessage` it expects —
the template's `dev/hub-demo.html`, which needs no editing per control. On
the live page the frame mounts only once the *Demo* section has scrolled into
view; `demo-check --live` scrolls to it first. The in-app browser refuses the
cross-port frame (`ERR_BLOCKED_BY_CLIENT`); headless Chrome over the DevTools
protocol does not, and the sandboxed frame is its own `iframe` target —
attach to it before its URL is set, or its first requests are missed.
**A stand-in run is not the live demo's security policy.** The dev server
sends no CSP; `demos.pcfhub.dev` sends `default-src 'none'` with `img-src
'self' https://cdn.pcfhub.dev data:` — no `blob:` — so an image drawn from
an object URL passed the stand-in run and was broken live (`pcf-file-preview`
0.1.0). Read the policy with `curl -sI https://demos.pcfhub.dev/` before
trusting a run, or put it in a `<meta http-equiv>` on the page you test.

## A choice: its number in the record, its label in the metadata

**A choice is its number in the record and its label in the column's
metadata.** A record carries one value per column, so the fixture keeps a
choice as the integer Dataverse keeps, and `dataverse.tables.<table>.columns`
says what each one is called (from 2026-09-28):

```json
"columns": { "cr123_status": { "options": [
  { "value": 1, "label": "New", "color": "#6b7280" },
  { "value": 2, "label": "Active", "color": "#e8d33a" },
  { "value": 3, "label": "Blocked", "hidden": true } ] } }
```

`getFormattedValue` is then the label and the column sorts by it, while
`getValue` is **the string `"2"`**, as a model-driven subgrid hands a choice
over, with or without options described. `utils.getEntityMetadata(table,
[column])` answers them in the shape measured on forms —
`attributeDescriptor.OptionSet` an array of `{ Label, Value, Color, IsHidden }`
in the maker's order, `OptionSet` a map by value — and only for the columns
the caller named. A yes/no column's options are 0 and 1. `color` is `#rrggbb`,
and `hidden` marks an option rows may hold and nobody may pick. A date's
`behavior` and a number's `minValue`/`maxValue` are described in the same
place; a range reaches a bound property's `attributes` and `EntityDefinitions`
but not `getEntityMetadata`, which carries none on a real form either.

Without the section a choice cell prints its number. This paragraph used to
say that was all a fixture could do: `pcf-kanban-board` set its `lanes` input
in every preset to get labels, and the board's default behaviour — reading
the lanes from the column — was the one thing its demo could not show. It
now leaves `lanes` empty in every preset but the one that shows the override.
