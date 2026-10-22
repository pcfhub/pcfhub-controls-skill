# Verification: the dev rig, `npm run check`, and a clean pack

What a control repository can prove about itself locally, and what each green
result does and does not mean. `SKILL.md` has the commands; this is the detail
behind them.

- [Prove it with the dev rig](#prove-it-with-the-dev-rig)
  - [A field host](#a-field-host)
  - [A dataset host](#a-dataset-host)
  - [A grid customizer](#a-grid-customizer)
- [When the bundle cannot load in Node](#when-the-bundle-cannot-load-in-node)
- [Keeping the rig current: `sync-rig.mjs`](#keeping-the-rig-current-sync-rigmjs)

## Prove it with the dev rig

**Every shape ships a `dev/` directory, not just grid customizers**, and it
is the only thing in a control repository that asserts anything:

```bash
npm run lint           # run it separately — see below
npm run build
npm run smoke          # assertions, with an exit code
npm run harness        # serves dev/harness.html and opens it
```

**Where the platform and the documentation disagree, the rig follows the
platform.** A dev rig is written from the same understanding as the control, so
it encodes the same mistakes and then certifies them — and it is the only place
that disagreement can be written down as something a test can fail against.

`pcf-data-table` 0.3.x hit this five times in one release. The rig answered
`allocatedWidth` whether or not the control had subscribed; applied a write
inside `save()` instead of leaving it for the next read; let `settle()` stand in
for a repaint the platform never performs; and returned a `Promise` from
`record.setValue`, which returns `undefined`. Each one passed a control that
could not work on a form. The last shipped through three releases.

When a measurement contradicts the reference documentation, the rig is where the
measurement goes — with the date and the environment — and the mutation that
proves the assertion bites goes in beside it.

**`pcf-scripts build` exits 0 when ESLint fails.** It prints
`[pcf-1065] [Error] ESLint validation error`, emits **no bundle**, and returns
a success code anyway — verified on `pcf-scripts` 1.x, 2026-09-09, against
`pcf-data-table`. So `npm run build && npm run smoke` runs the smoke suite
against **the bundle from the last successful build**, and every assertion
passes because it is testing yesterday's code. Nothing anywhere says so.

**A TypeScript error exits 0 too, and does write a bundle** — one that
registers no control (measured, `pcf-kanban-board` 0.5.1, 2026-10-14: a
`ref` typed `HTMLButtonElement` on a Fluent `Button`, `TS2322`, `[pcf-1033]
[Error] An error occurred compiling or bundling the control`, exit 0, a
fresh 202 KiB `bundle.js`). The suite then fails its first check, *bundle
registered a control*, and nothing else, which reads like a broken rig. A
loop over several repositories should grep the build's output for `ERROR` or
`[Error]` rather than trust `&&`.

Two consequences worth carrying:

- **Run `npm run lint` as its own step**, before the build, and let *it* be the
  thing that fails. The shared `build-reusable.yml` already does — lint at one
  step, build at the next — which is why CI has never hit this. A local
  `build && smoke` chain has no such protection.
- **When mutation-testing an assertion, confirm the bundle actually changed**
  before believing the result. A mutation that trips a lint rule — `if (false)`
  hits `no-constant-condition`, which is in `eslint:recommended` — produces a
  suite that passes, which reads exactly like "the assertion proves nothing" and
  is really "the assertion never saw the mutation". Compare an `md5sum` of
  `out/controls/<Control>/bundle.js` across the rebuild, or check its mtime.
  **The exit code will not tell you: `npm run build` exits 0 when ESLint
  fails it** (measured, `pcf-number-slider`, 3 Oct 2026) — only `[build]
  Failed` in its output says so, and the previous bundle stays on disk. A
  mutation runner deletes the bundle before each build and treats that line
  as a failure; a mutation that leaves a variable unused, a block empty or
  a value self-assigned trips lint the same way, so reword it to stay valid
  (`if (Math.random() > 2)` rather than `if (false)`). Eight of 29 mutations
  there "killed" the suite on a stale bundle before the runner checked.

That second one is the same class of error as `dev/dom.js`'s historic `img.src`
bug below: **a check that silently reads the wrong thing reports its own
blindness as proof.**

**The suite's Fluent stub is a stand-in component per name, not the name as
the element type.** Handed `'MenuItem'` as a type, React lower-cases the
unknown element, and `<menuitem>` is a void element in HTML — so
`renderToStaticMarkup` throws on the first suite that renders a menu
(`pcf-calendar-view` met it, 2026-09-14). Each capitalised export is a
function component rendering `<div data-fluent="Name">` with
the string, number and boolean props the control passed; assert against those
attributes, not against a tag name.

**React 16's server renderer hyphenates the capitals in a custom property
name.** `style={{ '--TagList-chip-accent': c }}` renders as
`---tag-list-chip-accent` through `renderToStaticMarkup` (React 16.8.6,
measured 2026-09-23), so the stylesheet's `var()` matches nothing in the suite
while the browser — which uses `setProperty` — works. Name a custom property
set from a style prop in lower case, and assert against the rendered string.

`npm run harness` is `dev/serve.js` — `node:http` serving the repository, no
dependency — and it exists because `file://` is not good enough: a dataset
fixture cannot be fetched from it and a module script is refused, both arriving
as an empty control with a CORS error rather than as a missing server. It takes
`--port` and `--no-open`. Every shape has a page, including React (virtual)
controls; a missing one means somebody removed it, and the script says so rather
than serving a 404.

No test framework, no dependencies, no bundler. `dev/smoke.js` loads the
**built bundle** — webpack, the externals and the manifest all sit between the
source and what a host loads — drives the control through states a host can
produce, and prints a pass or a fail per decision. CI runs it after the msbuild
pack, so there it drives the production bundle.

It also ships `dev/dom.js` — a hand-written DOM, not jsdom, with `classList`,
`dataset`, `createElementNS`, a short list of reflected attributes, and a
`querySelector` that supports `tag`, `.class` and `tag.class` and **throws by
name** for anything else. Throwing is the design: a missing piece should read as
"add it to `dev/dom.js`", not as a mysterious `undefined`. One historic bug is
worth knowing as a class — `img.src = url` used to set a plain property that
`getAttribute('src')` could not see, so an assertion that "no tile was
requested" passed whether or not one had been. **An assertion that reads a slot
nothing ever writes to reports the absence as proof**, which is worse than
having no assertion.

**And it is never thicker than a browser**, the same error from the other
side. `querySelectorAll` returns a `NodeList` and `children` an
`HTMLCollection` — indexable, iterable, `item()`, and no `map`, `filter` or
`find` — so a control calling `.find` on either fails in the suite as it does
on a form. A suite that wants an array writes `Array.from` in its own helper;
the control never gets one. Both template suites assert the shape as a rig
self-check, and returning an array fails it by name.

**Nor thinner where a browser is not.** A control with one delegated listener
narrows the target with `target instanceof Element` and walks up with
`closest()`; until 2026-10-08 the template's shim had no `Element` global and
no `closest` or `matches`, so both threw from inside the bundle. One
repository's early fork had all three, and only forcing the template's copy over
it showed the gap (template 502f5e2). When a sync breaks a suite, read the old
copy's diff for something the template should have had before reverting.

And `dev/clock.js` — a fake `Date`, `setInterval` and `setTimeout` installed on
the global before the bundle is evaluated — with a teardown assertion written
against it: **every timer and `document` listener taken in `init` is released in
`destroy()`**. A control with no timers passes it
trivially, which is the point; it starts meaning something the moment somebody
adds one. Read *Timers and teardown* in `pcf-controls/references/rendering-and-hosts.md` before writing a
control that repaints on its own.

**Know what `npm start` actually is before recommending against it.** Read off
the running harness (`pcf-start` 1.51.1), its entire surface is: *Context
Inputs* — form factor, container width, container height — and *Data Inputs* —
one text box per property, plus a CSV upload with a per-column type picker for a
dataset. Recommend it for the happy path and for responsive work; it is the
better tool for "does this look right".

Its dataset mock is thinner than it looks, which is the part worth knowing.
From the harness source, confirmed by running a control against it:
`hasNextPage` and `hasPreviousPage` are **hardcoded `false`** so a CSV is always
one page, `sortedRecordIds` is every row, `sorting` is `undefined` (not an empty
array), `loading`/`error` are hardcoded, and `loadNextPage`, `loadPreviousPage`,
`reset` and `setPageSize` are `console.log` calls — `setPageSize(25)` logs as
`Invoked method loadNextPage on Paging interface. Parameters: 25.` and moves no
data.

**`sorting: undefined` is the one that bites.** The type definitions declare it
a required array, so `dataset.sorting.find(...)` in a sortable header throws a
TypeError against `npm start` — **and the harness swallows it silently**: no
console error, and the control renders as an empty box. The pcfhub template's
own dataset variants shipped this, verified against `pcf-start` 1.51.1 by
instrumenting the control. Read through `(dataset.sorting ?? [])`, and decline a
sort rather than throwing when there is no array to mutate. When a dataset
control "renders nothing in `npm start`", check this before anything else.

So recommend the rig for the states that break controls, which are the ones
nobody looks at:

### A field host

`security.readable === false` (which arrives as `raw === null` and is *not* an
empty column), the platform's own `error`/`errorMessage`, a host publishing no
theme, a canvas host whose `attributes` describe no column (`MaxLength: 100`, a
date `Behavior`, the property's own name — the rig handed `undefined` there
until 2026-10-06, so re-run any suite written before it), whether a cleared
value comes back
as `null` rather than `undefined`, and a `device`/`getResource` that **reject by
default** — which is what every host without a native bridge does. It also
reaches the four separate ways a device API is unavailable (`no-bridge`,
`denied`, `unavailable` — which rejects with `null` — and `absent`, where the
method is not there at all), `webAPI` / `navigation` / `utils` that can each be
missing independently, and `mode.contextInfo`, which defaults to absent because
it is undocumented. The `dialogs` switch reaches the four states
`openConfirmDialog` has — confirmed, **cancelled (a resolve)**, refused, and
absent, which is canvas — and `utils.hasEntityPrivilege` answers yes or no with
both enum arguments logged. `events` takes an array of names *or* an object of
handlers, so a suite can call a payload's callbacks back into the control;
`events: null` is the host that publishes no bag at all. See [Device
APIs](../../pcf-controls/references/files-and-device.md#device-apis) and
[Events](../../pcf-controls/references/navigation-and-events.md#events).

- **The Web API from a fixture**: `retrieveRecord` and `retrieveMultipleRecords`
  answered from `fixture.tables` — an OData subset and a **FetchXML** subset
  with the five hierarchical operators and `rowaggregate='CountChildren'` over
  `fixture.hierarchy`, a FetchXML result omitting nulls, `maxPageSize`
  truncating with a `nextLink` — each refusal a switch (`webApiFails`,
  `hierarchical: false`), `page.getClientUrl()` behind `page`, a same-origin
  metadata `fetch` of `ManyToOne`/`OneToManyRelationships` answered **per host
  by origin** with `relationshipsStatus` (0 is offline: a `TypeError`), a web
  resource at `<clientUrl>/WebResources/<name>` answered from
  `fixture.webResources` as a form did — 200 `text/jscript`, or a 404 with an
  empty body — with `webResourceStatus` for 403 and offline,
  `navigation.openForm` behind `openForm`, `PrimaryNameAttribute`, and a
  `Lookup.Simple` binding (`valueType`, `column`, `target`, `targetMethod:
  present | absent | throws`), **further bound properties** through `bound` — a
  mapped lookup with its two methods, or `'unmapped'`, the measured eight-key
  `type: null` shape — and `utils.lookupObjects` behind
  `lookupObjects`/`lookupPick`, answering braced and upper-case as the platform
  does. Its OData subset reads `startswith`, `contains`, `or`, `and` and
  parentheses, and **refuses** a clause it cannot read. Two rules ride with it:
  **one `fetch` stub routed by origin**, and **one `clientUrl` per mount** —
  `smoke.js`'s `mount()` takes it from `host.nextClientUrl()` and hands the same
  string to every context that instance sees, `update()` included
- **Two Web API functions** on the same stub — `RetrieveAuditDetails` bound on
  `audits(<id>)`, `RetrieveRecordChangeHistory` /
  `RetrieveAttributeChangeHistory` unbound with their `@`-aliases parsed off the
  query string — answered from `fixture.audits`, the `audit` table queryable and
  paged by a `nextLink` that carries the query, `IsAuditEnabled` on the table
  definition and `isauditenabled` on the organisation; switches `auditStatus`
  (403, or 0 for the offline `TypeError`), `auditSummary: false` (the *other*
  privilege) and `auditEnabled: { org, table }`
- **The table definitions** (`_template` `e6dc631`, `78ae113`): the table
  list, a table's columns, its three relationship kinds in one `$expand`, and
  a choice's options through its cast segment, answered from
  `fixture.metadata` in the shapes a form returned (`pcf-code-editor` 1.4.9) —
  only what `$select` names, Labels narrowed by `LabelLanguages`,
  `UserLocalizedLabel` in the `languageId` switch or `null`, a shadow column,
  one not valid for read, an unlabelled intersect table, a private table the
  list leaves out — with `metadataStatus` (403, or 0 for the offline
  `TypeError`). A suite whose bundle cannot load can still require `host.js`
  for this stub alone, as `pcf-code-editor`'s does
- **A write that lands**: `webAPI.updateRecord` applies to this host's own copy
  of the fixture (never the shared one) and, where the fixture has an `audit`
  table, audits it as the newest row by `userSettings.userId`/`userName` — so a
  control that writes can be shown its write on the next read; an undeclared
  bind and a bind to a missing record refuse the way the server does.

#### The cursor, and typing as a person does

`dev/dom.js` (since `_template` 87173d2) gives a text input and a `<textarea>`
a cursor: `selectionStart`/`End`/`Direction`, `setSelectionRange` clamped as a
browser clamps it, and a `value` setter that moves the cursor to the end **only
when the value changes** — both halves of the browser's rule, because without
the first every caret assertion passes and without the second an identical echo
reads as a jump. An `email` or `number` input has no cursor: `selectionStart` is
`null` and `setSelectionRange` throws `InvalidStateError`. `focus()` and
`blur()` fire their events.

`dom.user` types: `type`, `paste`, `backspace`, `del`, `compose`, `autofill`,
and `undo`/`redo` in the shape a form showed (cancelable; uncancelled, nothing
changes and the cursor goes to 0), each editing at the cursor and firing `beforeinput` (cancelable),
the edit, then `input` with Chromium's `inputType` and `data` — a composition's
last `input` before `compositionend`, autofill with no `beforeinput` and no
`inputType`, `maxLength` limiting what is typed and never what is assigned. A
suite that set `input.value` and dispatched a bare `input` was testing a
sequence no browser produces. **An assertion about the caret types in the
middle of the value**: at the end, a jump to the end is invisible.

The late echo is staged by hand: type with `dom.user`, then `update()` with
the echoes newest first (`'abc'`, `'ab'`, `'a'`) and read `value` and
`selectionStart` — the scaffold suite's own assertion. The shapes are
Chromium's, and a form confirmed typing, paste, Backspace, autofill, undo and the identical-assignment rule (`pcf-input-mask` `SPEC.md` P3/P6, 2026-09-28); composition is still documented, not measured.

### A dataset host

**More than one page.** Server-side sorting, server-side *filtering*, a
non-sortable column, a hidden column, columns out of order, and the three ways
real paging misbehaves — as switches. And the whole lookup write:
`webAPI.updateRecord` applying an `@odata.bind` the way the server did and
refusing the way it did (undeclared property, record not found — the measured `{
errorCode, message, title, code, raw }` shape), `utils.lookupObjects` resolving
braced upper-case or `[]`, `page.getClientUrl`, and a same-origin `fetch` of
`ManyToOneRelationships` answered from `fixture.relationships` — each with its
absence as a switch (`page: false`, `lookupObjects: false`, `webAPI: false`,
`relationshipsStatus`, `entitySetAbsent`), because on a real host they go
missing one at a time.

- **The view behind the dataset**: `getViewId()` (or `null`), its FetchXML from
  `savedquery` / `userquery` on `retrieveRecord`, and `retrieveMultipleRecords`
  answering a `?fetchXml=` query over the rows — plain, or an `aggregate='true'`
  one row per `groupby` combination (with `dategrouping` in the user's zone)
  carrying each aggregate under its alias, nulls omitted, labels under the
  annotation — plus a `relationshipFilter` — the measured subgrid: it narrows
  the rows and `getFilter()` never reports it, paired with `contextInfo` — a
  `hostFilter` that `getFilter()` does report (a quick-find, unmeasured), and
  the refusals as switches (`viewId: null`, `viewsReadable: false`,
  `aggregateLimit`, `aggregateRefused`)
- **An input changed after `init`** — `handle.setInput(name, value)`, the next
  context carrying the new `raw` and naming it in `updatedProperties` — which is
  the hub's demo switching presets on a mounted control, a host no form is. And
  the create half: `webAPI.createRecord` holding the row until the next fetch,
  `retrieveMultipleRecords` from `fixture.tables`, `EntitySetName` from
  `fixture.entitySets` — with **one `fetch` stub routing by origin**, because
  one installed per host belonged to the last host a suite created. A canvas
  host **publishes** `utils`, `webAPI`, `openForm` and `openFile` and each
  throws `Method not implemented.` from the call, as a canvas app measured
  2026-09-22 — the dataset rig withheld them until 2026-09-29, and a template
  assertion certified the withholding, which made "detect the method" look
  like a rule. `getViewId()` answers `undefined` there. And the
  date half: `userSettings.getTimeZoneOffsetMinutes(date)` with a
  **`userTimeZoneOffset`** switch, so the Dataverse user's zone can differ from
  the machine's — the state a control reading the browser's zone passes on the
  machine it was written on and fails for the first user east of it — with the
  bare call answering an hour off the dated one so a dropped argument cannot
  pass by season; the three date operators comparing by *that* user's calendar
  day; `dateFormattingInfo` as an en-US tenant publishes it, overridable per key
  or withheld with `false` (the demo harness); a datetime metadata node carrying
  `Behavior` and `Format`, and `Color` on the descriptor array only; and
  `fluentDesignLanguage.tokenTheme` as a switch
- **The many-to-many half** (2026-09-23): `ManyToManyRelationships` from
  `fixture.manyToMany`, `$ref` POST and DELETE applied to a **per-host** link
  table, a `manyToManyFilter` making the dataset a subgrid over one relationship
  with the rows following the links on the next fetch rather than the request,
  `refStatus` for the privilege refusal (403) and the offline host (0), and a
  GET on `<set>(<id>)/<nav>` answering every linked id
- **A query the rig understands, or refuses**: `retrieveMultipleRecords` honours
  `contains()` (case-insensitive, as measured), `eq`/`ne` with `null`, `and` and
  `$orderby`, and rejects any other `$filter` clause — a rig that ignored
  `$filter` would hand every query every row, and pass a control whose filter
  the server would refuse. `datasetName` names the parameter the dataset arrives
  under, for a manifest that does not call it `records`
- **A privilege, a preference and a selection** (2026-09-25, for
  `pcf-row-commands` 0.2.0): `utils.hasEntityPrivilege` behind `hasPrivilege` —
  a boolean, a function of `(type, depth, table)`, or `'throws'` for the host
  that cannot say; `localStorage` per host behind `storage` (`'working'`,
  `'throws'` on reading the global, `'full'`, `'absent'`), with `storageData`
  handed to a second host to model a reload; and `quirks.selectionDropsOnFetch`,
  unmeasured and on. **Canvas publishes `page` and its `getClientUrl` throws** —
  measured on a canvas app 2026-09-22; leaving `page` out would pass a `typeof`
  test the real host fails.
- **Status Reasons, refusals, and what the server holds** (2026-09-29, for
  `pcf-kanban-board` 0.4.0): descriptor options carry `TransitionData` on
  every option, `State` on a reason (`state` in the fixture) and
  `DefaultStatus` on a state (`defaultStatus`), and `updateRecord` refuses a
  bare cross-state `statuscode` with the measured `2147779592`; **`rejection`**
  names what a refused `save()`, `createRecord`, `updateRecord` or
  `deleteRecord` rejects with — a plugin's sentence, or a bare string — and a
  refused save is the platform's plain object by default, never an `Error`; an
  aggregate reads **committed** values, since the server holds a write the
  moment it resolves, and names and formats every alias (`AttributeName`,
  `"$25.00"`, `"10"`) so `describesPlan` has something to check; and
  `?$select=PrimaryIdAttribute` is answered (`fixture.primaryIds`) instead of
  falling through to the relationships reply.

### A grid customizer

The whole shape; see *There is a local harness, and it is the only way to see
this shape work* in `pcf-controls/references/grid-customizers.md`.

The dataset rig is the one that changes what is *possible* rather than what is
convenient, and it is worth saying why out loud: the hub's demo harness seeds a
single page and reports no next or previous page, which is why every dataset
control in the catalogue sits at `demo.fidelity: "limited"`. Nothing else exercises
the paging and sorting code, which is most of the hard code in the shape.
`dev/host.js` ships twelve records at a page
size of five, because three pages is the smallest number that distinguishes
"page two came from the platform" from "page two came from a slice".

**Filtering is thinner still everywhere else, and the rig is the only place it
works.** `npm start` logs `setFilter` and moves nothing, the same treatment it
gives every other mutator, and the hub's demo harness is documented as
discarding a *sort* request on each render — so expect no better of a filter
there. The rig applies the expression for real, honours `Or`/`And` and the
`LIKE` wildcards including `[%]` escaping, makes `totalResultCount` follow the
filter, and **models the request/apply split**: `setFilter` records, `refresh()`
fetches, so a control that forgets the refresh shows up as rows that did not
move rather than as a passing test. `filteringAbsent` sits beside
`sortingAbsent` for the host that supplies no `filtering` object at all.

On the field side, `context.device` and `context.resources.getResource` both
**fail by default**, which is the honest default rather than a grudging one:
every device method rejects outside a real device origin, and an `<img>`
resource is not something to count on off a model-driven form. Pass
`pickFile: [ … ]` or `resource: '…'` to see the success path.

The rig carries the two switches `npm start` has as well — form factor and
allocated width — so responsive work does not need both tools open. Two facts
about that pair, because both are got wrong silently:

- **`getFormFactor()` is 0 unknown, 1 desktop, 2 tablet, 3 phone.** Web is `1`,
  and `3` — the value that looks like it should mean "the big one" — is a phone.
  A control comparing against the wrong number reflows backwards, on the client
  least likely to be tested.
- **`mode.allocatedWidth` is `-1` until the control calls
  `mode.trackContainerResize(true)`.** A control that reflows on width without
  asking lays out against `-1` on every host and picks its narrowest branch
  forever. The pair is what to check, not either half.

Six things to know before touching any of it:

- **An input can change after `init`, and the hub's demo is the host that
  changes it.** On a form an input is set at design time and never moves;
  the demo switches presets on a *mounted* control, and `pcf-calendar-view`
  0.1.3 read `defaultView` into React state once at mount and sat on the
  old preset while the property panel said otherwise. The dataset rig's
  `handle.setInput` is that host (2026-09-17), and its harness page drives
  the live control through it rather than remounting — which matters,
  because `ReactDOM.render` into the same container keeps component
  state, so the page is where a component's re-apply effect is actually
  exercised. The static suite proves the control's half only: that inputs
  are read on every pass, never copied in `init`. The field rig builds a
  fresh context per call and reaches the same state by handing the same
  instance a context with different `inputs`. Read every input in
  `updateView`, and re-apply anything held in React state from an effect
  keyed on the prop.

- **A host's rows are its own, and a rig that shares them certifies the
  wrong control.** The dataset rig's `record.save()` commits into the row and
  the next fetch applies it; when the rows were the fixture's own objects,
  every host a suite created *after* a write started from the written value.
  `pcf-kanban-board` 0.3.0 saw seven assertions fail in a pattern that
  pointed at the control — "move w1 to lane 3" had become a no-op, because an
  earlier test had already moved it. `createHost` copies rows one level deep,
  in the template and there, and the template suite asserts a fresh host
  does not see an earlier host's write. **Any rig state a stub mutates has to
  be created per host** — the fetch stub had the same bug a week earlier.

- **`dev/host.js` withholds what the platform withholds.** `security` is
  `undefined` on a column with no field-level security, `attributes` is
  `undefined` on canvas, `fluentDesignLanguage` is `undefined` on a host that
  publishes no theme. Filling one in "so the control has something to read"
  produces a green suite for a control with no working path — it has happened in
  the grid rig twice. **When stubbing a platform call, stub its refusals first.**
- **The dataset `quirks` default to the platform's observed misbehaviour, not
  its documentation.** `loadNextPage(true)` accumulating, `hasPreviousPage`
  never unlocking, `firstPageNumber` disagreeing with the ids. A harness
  modelling the platform as written down passes a control that cannot page on a
  real form.
- **`--framework react` keeps `dev/harness.html` and `dev/harness.js`**, and
  adds `dev/fluent-stub.js` and `dev/virtual-bundle.js` beside them.
  `@fluentui/react-components` ships no UMD build, so there is no file to put
  in a `<script src>`, and a bundler to produce one would make the harness the
  thing that needs building — but **the page never needed the real Fluent**: it
  needs something under that global, and a stand-in is a file rather than a
  build step.

  The stand-in is in the scaffold. `fluent-stub.js` covers `FluentProvider`, `Button`, the `Popover`
  trio and the `Menu` family, and is meant to be added to; `virtual-bundle.js` fetches the
  bundle, reads the version-encoded globals out of it and defines them before
  evaluating. `add-control.mjs` applies the same patch, so a react sibling gets
  the same page.

  **Say in the stub's header how it is *less* capable than the real thing** —
  the shipped one renders surfaces inline rather than through a portal, traps no
  focus and handles no Escape, and publishes design tokens only when the theme
  carries them. A stub that quietly did *more* would certify a control that does
  not work. The portal difference is the dangerous one: a stylesheet rule scoped
  through the control's own root works on that page and matches nothing on a
  form. **`npm start` stays the authority for anything that depends on real
  Fluent**, and the page is the authority for everything that depends on a host
  *state* — denied read, a platform error, no theme, dark, RTL, each shipped
  language — because those are switches and `npm start` has none.
- **The external globals are named after the platform build, not the declared
  version.** `pcf-scripts` maps a `<platform-library>` version onto the build it
  supports, so Fluent `9.46.2` arrives as `FluentUIReactv940`. `smoke.js` reads
  the names out of the bundle rather than hardcoding them; anything that
  hardcodes one breaks on the next version bump with a `ReferenceError` naming a
  global that appears nowhere in the repository.

## When the bundle cannot load in Node

The suite loads the built bundle because webpack, the externals and the
manifest sit between the source and what a host runs. A bundle that carries a
browser application does not get that far: Monaco reads `document` at module
scope, so under `dev/dom.js` it fails to *load*, before any control code runs
(`pcf-code-editor`, measured 2026-08-28), and growing the shim to meet it means
writing a browser — the thing `dom.js` says in its header it will not do. For a
year that repository's answer was `smoke: false` with a comment saying "not
going away".

The answer that works is a boundary, not a bigger shim. **Keep the control's
decisions in modules that import nothing of the library** — there, the language
resolver, the validator, the height rule and the theme rule are four files with
no Monaco in them — and let `index.ts` be the thin part that turns a decision
into a library call. The suite then loads those modules through
**`dev/modules.js`**, which every non-customizer scaffold carries:

```js
const { createLoader } = require('./modules');
const load = createLoader({ root: path.join(root, '<Control>'), forbid: [[/monaco-editor/, 'Monaco'], [/components\//, 'the component tree']] });
const { validateJson } = load('validate');
```

It transpiles one file at a time with the TypeScript already in
`devDependencies` (`ts.transpileModule`, one `Module` per file, relative
imports routed back through it), and **throws if a decision module's import
matches `forbid`** — tested against every request, relative ones included — so
the boundary is enforced rather than remembered. `pcf-code-editor` wrote it
first for a bundle that cannot load; `pcf-data-table` 0.6 wrote the same file
independently for decisions too fine to reach through the control (grouping's
exact FetchXML text), which is when it moved to the template. **Mutation-test
the guard with an import the module uses**: TypeScript elides an unused import,
so `import * as React from 'react'` alone transpiles to no `require` and loads
cleanly — a guard that looks broken and is not. `export const leak = React;`
throws. The template's suites assert both halves on throwaway modules.

What passing proves is the decision; what it cannot prove is that
`index.ts` asked the right question, and that half stays with
`dev/harness.html` and `SPEC.md`'s *Not verified* — said in the suite's
header, because a green run reads as more than it is.

Two things this is not. It is not jsdom: a devDependency, a config and a second
way to load the bundle, to reach a Monaco that would then need a layout engine
to paint. And it is not a reason to skip the harness — a control of this shape
leans on `npm run harness` harder than its siblings do, and the page's
switches should reach every state the pure modules branch on.

**Nothing here proves the control works.** Every value the rig supplies comes
from the rig: it cannot tell you a real form hands down what the fixtures hand
down, that a save persists, that the stylesheet applies, or that focus order is
sane. Those belong in `SPEC.md` under *Not verified*, and saying so is part of
reporting a green run.

## Keeping the rig current: `sync-rig.mjs`

Moved to [rig-maintenance-and-checks.md](rig-maintenance-and-checks.md) on 15
Oct 2026, with the sections that followed it, so each file can be read whole:

- **Keeping the rig current: `sync-rig.mjs`**
- **What `npm run check` covers**
- **A local pack, and a clean one**
