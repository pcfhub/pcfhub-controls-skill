# Exemplars: the repository to read first

Every shape, and most patterns that cut across the shapes, has a control in the
catalogue that has already met the traps. Read the nearest one before writing a
new control of that shape or pattern.

- [Where they are](#where-they-are)
- [By shape](#by-shape)
- [By pattern](#by-pattern)
  - [Raising an event](#raising-an-event)
  - [`property-set` roles](#property-set-roles)
  - [Writing to Dataverse](#writing-to-dataverse)
  - [Linking records over a many-to-many — a multi-select lookup](#linking-records-over-a-many-to-many--a-multi-select-lookup)
  - [Reading from Dataverse](#reading-from-dataverse)
  - [A lookup filtered by another lookup on the form — a cascading lookup](#a-lookup-filtered-by-another-lookup-on-the-form--a-cascading-lookup)
  - [A keyboard of your own — a tree, with arrows inside one tab stop](#a-keyboard-of-your-own--a-tree-with-arrows-inside-one-tab-stop)
  - [Reading a hierarchy — a self-referential lookup as a tree](#reading-a-hierarchy--a-self-referential-lookup-as-a-tree)
  - [Filtering a dataset](#filtering-a-dataset)
  - [Files and binary content](#files-and-binary-content)
  - [Several bound columns on one field control](#several-bound-columns-on-one-field-control)
  - [Calling a third-party service from the browser](#calling-a-third-party-service-from-the-browser)
  - [Navigation and platform dialogs](#navigation-and-platform-dialogs)
  - [Selection, and a command over it](#selection-and-a-command-over-it)
  - [Resizing a column](#resizing-a-column)
  - [Gating a command on the user's roles](#gating-a-command-on-the-users-roles)
  - [More than one control in a repo](#more-than-one-control-in-a-repo)
  - [A third-party library that is most of the bundle](#a-third-party-library-that-is-most-of-the-bundle)
  - [Configuration from a web resource, and an output that reports a verdict](#configuration-from-a-web-resource-and-an-output-that-reports-a-verdict)
  - [Completion and hover from configuration](#completion-and-hover-from-configuration)
  - [Reformatting as you type — an input mask](#reformatting-as-you-type--an-input-mask)
  - [Keeping state across a remount](#keeping-state-across-a-remount)
  - [Dates, and whole days](#dates-and-whole-days)
  - [Dates over a dataset](#dates-over-a-dataset)
  - [A Web API function](#a-web-api-function)
  - [Aggregating a view](#aggregating-a-view)

## Where they are

Every repository named here is public at `https://github.com/pcfhub/<name>`,
with one exception: `Code-Editor-PCF`, published on the hub as
`pcf-code-editor`, is `https://github.com/Charlesllamas/Code-Editor-PCF` —
the two names mean the same control throughout these skills. `pcf-grid-chrome`,
the withdrawn customizer below, no longer exists.

Read an exemplar from a clone beside the repository being worked on, where
there is one; otherwise clone it, or read it on GitHub. For a control on the
hub, `get_component` returns its `repositoryUrl`.

## By shape

Each combination has a repository behind it: `pcf-star-rating` (field, standard),
`pcf-choices-picker`, `pcf-hierarchy-view` and `pcf-audit-history` (field,
react), `pcf-data-table` and `pcf-chart-view` (dataset, react),
`pcf-compact-list` (dataset, standard), and two grid customizers —
`pcf-grid-cell-styler` (cells) and `pcf-grid-data-bars` (cells, driven by
attribute metadata). Read the nearest one before writing a new control of that
shape. There was a third, `pcf-grid-chrome`, built on the `gridCustomizer`
members; it was withdrawn when those turned out never to be called — the grid
does not read that key. Do not use it as a model.

## By pattern

These patterns cut across the shapes and have fewer exemplars than they look
like they have. Read the named repo before writing any of them:

### Raising an event

`pcf-action-button` (canvas, `<common-event name="OnSelect">`) and
`pcf-form-action-button` (model-driven, a custom `<event>` a form script binds
with `addEventHandler`). Read *Events* in `navigation-and-events.md` **first**:
events are **not** canvas-only whatever the manifest-schema index says,
`<event>` and `<common-event>` are enforced as two elements with different
attribute bags, `refreshTypes` emits nothing for either, `context.events` is
typed non-optional and is therefore evidence of nothing, and a model-driven
payload can carry callbacks the handler calls straight back into the control.

### `property-set` roles

`pcf-tag-list`, `pcf-kanban-board`. Only these two — `pcf-data-table` and
`pcf-compact-list` declare **none**, deliberately, and say why at length in
their manifests.

`pcf-kanban-board` is also the one whose demo binds a role in one preset and
not in the others: its Swimlanes preset is shown over a fixture of its own,
with a guard in `dev/smoke.js` against the two files drifting. See *A preset
can name a fixture of its own* in `pcfhub-publish/references/hub-demo.md`.

### Writing to Dataverse

**From a field control that has read a value through the Web API and wants to
put it back**, `pcf-audit-history` 0.2.0 — `webAPI.updateRecord` with the wire's
own raw, a lookup bound from the detail's `associatednavigationproperty`
annotation, behind `openConfirmDialog`, then page 1 again as the proof; see
*Restoring an audited value* in `context-apis.md`. **From a dataset control, try
`record.setValue()` + `record.save()` first** — measured working on a real
subgrid for text, number, date and **Choice** cells (`pcf-data-table` 0.4.0: the
integer in, the integer read back), needs no `<uses-feature>` and no
install-time prompt, and works in canvas where WebAPI does not. The record also
answers `isEditable(column)` per column, which is what keeps
`statecode`/`statuscode` read-only despite reporting `OptionSet`. **It does not
stage a Lookup** — five shapes refused on the one host tried — so a lookup is
the one column written with `webAPI.updateRecord`, and `pcf-data-table` 0.5.0 is
the exemplar: the `@odata.bind` key's navigation property is **read** from
`ManyToOneRelationships` (on the probe table it was the logical name, not the
schema-cased one, and a Customer lookup has two), the value is
`/<EntitySetName>(<bare guid>)`, `null` clears, and `context.parameters.records`
is a new object every pass, so never write against a dataset you kept. Neither
record method is in the typings; see *Writing from a dataset control* and
*Writing a lookup through the Web API* in `dataset-writing.md`. **And
it does not write `statuscode`** — `isEditable` answers `false` there while the
column reports `OptionSet` — so a control writing a column the *maker* bound
takes **two routes chosen per record**: `pcf-kanban-board` 0.3.0 is the exemplar
(`isEditable` true → `setValue`+`save`; otherwise `webAPI.updateRecord`, kept
declared `required="false"` for exactly that column), with the optimistic
override and rollback shared by both routes. **A Status Reason across states
needs its state beside it** — `pcf-kanban-board` 0.4.0: the server refuses a
bare `statuscode` from the other state rather than inferring it, and the
reason's `State` is already on the descriptor option `getEntityMetadata`
returns; see *Writing a Status Reason* in `dataset-writing.md`.
**A second column in the same gesture — a swimlane, and Owner — is
`pcf-kanban-board` 0.5.0**: lane and row in one write, the record route only
when every column answers `isEditable` `true` and none is a bind, Owner and
lookups through the Web API, Assign asked first; see *A second column beside
the lane, and Owner* in `dataset-writing.md`. It is also the exemplar for **a
sort menu** (in-place `dataset.sorting` + `refresh()`, offering only the
dataset's own columns, kept per table and view in `localStorage`) — *Sorting*
in `dataset.md`.
Linking two records over a relationship is its own row, below.

### Linking records over a many-to-many — a multi-select lookup

`pcf-tag-list` 0.3.0 — the community's most repeated model-driven request, and
the first control to link through **`$ref`**: POST and DELETE on
`<parentSet>(<id>)/<nav>/$ref`, same-origin `fetch`, no `<uses-feature>`, **both
idempotent** (measured 2026-09-23). The relationship is read from
`ManyToManyRelationships` and `ManyToOneRelationships` in a pure `binding.ts`,
because the subgrid does not report it — and **one pair of tables can have both
kinds**, so more than one candidate is `ambiguous` and the maker names one
rather than the control guessing. Attach is a debounced type-ahead that excludes
every linked id (read through the parent's navigation property, not the loaded
page — the harness caught that), `lookupObjects` for Browse, create only when
nothing matches; remove unlinks and never deletes, and the suite asserts the
absence of `deleteRecord`. A one-to-many binds and clears the lookup instead.
Read *Linking records over a many-to-many* in `context-apis.md` **first**.
Through 0.2.x it called `deleteRecord` on the target and deleted shared tags —
the trap under *Context APIs and their limits* in `context-apis.md`.

### Reading from Dataverse

`pcf-lookup-search` — the only one that queries rather than writes: a debounced
`retrieveMultipleRecords` type-ahead, `getEntityMetadata` for the target table's
name column, and a named degraded state for hosts with neither. For a lookup
*picker* prefer the platform's own `utils.lookupObjects` over a type-ahead — one
feature already paid for, the views and security for free, and a cancel that
resolves `[]`. For a Choice's option list read `pcf-data-table`'s
`parseOptions`: the node is **a value-keyed map plus a descriptor array**, not
the `Options[]` the reference page describes — and the colour is on the
descriptor array only (`attributeDescriptor.OptionSet[].Color`, measured on
`pcf-kanban-board`'s lane column 2026-09-14), never on the map. See *Lookup
columns* in `lookups-and-fetchxml.md` and *Context APIs and their limits* in
`context-apis.md`.

### A lookup filtered by another lookup on the form — a cascading lookup

`pcf-lookup-search` 0.2.0: a second, optional bound `Lookup.Simple`
(`parentValue`) whose column picker *is* the feature — so the "one bound lookup
per control" rule gives way here, on purpose. Unmapped is `type === null` and
sends the 0.1.x query byte for byte. The linking column is read from the
searched table's `ManyToOneRelationships` by `ReferencedEntity`, in a pure
`parent.ts`: one candidate filters (`_<column>_value eq <guid>`, outside the
match group), two or more is **ambiguous** and a maker input must name one of
them, none or unreadable **turns the search off** — never widens it. **Browse is
hidden while filtered**, because PCF's `lookupObjects` takes no `filters`. A
`clear`-on-parent-change mode asks with one `maxPageSize: 1` query before
emptying anything. Its *Not verified* list is the probe to run before the tag.

### A lookup as a dropdown — a view's rows, listed on open

`pcf-lookup-search` 0.3.0 (`displayMode = dropdown`): the pure
`components/list.ts` rewrites a view's FetchXML — attributes out at every
depth, `<order>` kept, `count` = limit + 1, a parent as a sibling filter —
and the component filters the loaded rows without re-sorting. The view is
one the maker **names** (`dropdownView`, name or GUID) or the table's default
lookup view; the column's own view does not reach a field control. Read
*Listing a view's rows in a field control* in `lookups-and-fetchxml.md`
before listing any view on a field; the suite's 14 mutations are the
decisions worth keeping.

### A keyboard of your own — a tree, with arrows inside one tab stop

`pcf-code-editor` 1.7.0's JSON tree is the exemplar for a composite widget
on a form: the WAI-ARIA tree's whole key map as a pure function
(`treeKeys.ts`), `aria-activedescendant` on a scroller over windowed rows
(`treeWindow.ts` — 10,000 rows drawn took 170 ms on the form), per-instance
row ids, `aria-level`/`aria-setsize`/`aria-posinset` on flat rows, a strip
that shows the focused path `aria-hidden` inside its status region, and
`dev/keys-walk.js` pressing it all for real. Its 1.6.9 probe measured that a
form takes none of the pattern's keys from a control, and which clipboard
path writes there. Read *A tree or a list of your own* in
`accessibility.md` first. The map is shared now — the template's
`lib/tree-keys` — and `pcf-hierarchy-view` 0.3 is the React exemplar: no
windowing, one key map over two layouts (an indented tree and an org chart
built from the same rows), the press that must not take focus, and the ring
drawn with `:focus-visible`. Until 0.3 it was the counter-example — a tab stop
per chevron, no arrows.

### A drawing wider than its column — an org chart

`pcf-hierarchy-view` 0.3's chart: a pure `chart/layout.ts` (a tidy tree, a
team of leaves hanging in one column) placed absolutely in a `width: 100%`
scroller, `scrollLeft` to centre the record until the person moves, and a
narrow fallback off the control's own width — because on a field
`allocatedWidth` is the cell, label and all. See *A drawing wider than a
field's column* in `layout.md`, and *The record's picture* in
`lookups-and-fetchxml.md` for the pictures on its cards.

### Reading a hierarchy — a self-referential lookup as a tree

`pcf-hierarchy-view` — the first control to send **FetchXML** through
`retrieveMultipleRecords`: `eq-or-above` on the primary key for the whole
ancestor chain in one call, `rowaggregate='CountChildren'` for a chevron only
where there are children, and a same-origin fetch of `OneToManyRelationships`
for `IsHierarchical` **before** any of it — because the operators are refused on
a relationship nobody flagged, and a refused query is an error the user sees
where a failed metadata read is not. The fallback route (`retrieveRecord` per
level, an OData `$filter` for children) works on every self-referential lookup
and simply has no counts. Read *Reading a hierarchy through FetchXML* in
`lookups-and-fetchxml.md` **first**: the platform takes the FetchXML encoded or
raw (measured), refuses a hierarchical operator on an unflagged relationship
with a bare `Invalid Argument` (measured — so ask the metadata, never the
query), signals a cut page with `fetchXmlPagingCookie` rather than `nextLink`,
omits nulls from a FetchXML result where OData carries them, and the load effect
needs an in-flight set or a dispatch from inside it asks for the same children
twice. **Its demo (0.2.0) runs the fallback route on the hub's stand-in
Dataverse** — `demo/accounts.json`, `boundColumns` naming `parentaccountid` —
after 0.1.x ran a demo-only `sampleData` tree; see *Demo presets* in `dates.md`
for what the move found.

### Filtering a dataset

`pcf-view-filter` (one search box across columns, `Or`) and `pcf-data-table` (a
filter row, `And`, with per-column date and choice boxes —
`On`/`OnOrAfter`/`OnOrBefore` by the user's calendar day and `Equal` on a
choice's integer as a string, both measured on a model-driven subgrid).
`setFilter` → `paging.reset()` → `refresh()`, applied from a debounce and
guarded on the last expression, because `refresh()` fires `updateView` — and
never two refreshes in a row, because the second is dropped. See *Filtering* in
`dataset.md`.

**Rows related to the record by another path:** `pcf-data-table` 0.8.0
(*Related through*) links them through `dataset.linking.addLinkedEntity`. The
input is a FetchXML `<link-entity>` with `{id}`, inline or as a *Data (XML)*
web resource (`lib/config-source`), parsed by `lib/related-rows`. It is linked,
filtered and refreshed in `init` so no unfiltered rows are drawn, and the
related conditions go into every expression the filter row sends. The rows are
hidden until the first load after the link, and a refusal is explained by
naming the missing column. The aggregate carries the same link with the parent
resolver stood aside. See *Rows related through another table* in
`dataset-filtering.md`, all eleven of whose facts were probed first.

### Files and binary content

`pcf-file-drop` for a file **into a column**, `pcf-attachment-list` 0.2.0 for a
file **into a Note** — `webAPI.createRecord` on `annotation` with bare base64,
the bind names read from `EntityDefinitions` (no `Utility` prompt), the ceiling
read from `organization.maxuploadfilesize` (no `default-value`), a file input
rather than `device.pickFile`, and a drop target that prevents the default
whether or not the host can upload. `pcf-file-preview` for a file **in a
File or Image column** — placed on any column, reaching the file by a
same-origin `fetch` of `<set>(<id>)/<column>/$value`, the blob re-typed from
`mimetype`, the name read from `Content-Disposition`, refusals made before the
upload, and a card instead of a PDF frame where none can draw. Read *Files and
binary content* in `files-and-device.md` **first**, because the design starts
from a hard limit — PCF cannot *bind* a File or an Image column — and from the
three routes around it.

### Several bound columns on one field control

`pcf-address-autocomplete-azure` — seven, the catalogue's most, measured on a
real form: a bound column need not be on the form to persist, an unmapped picker
arrives with `type: null` and `security: {}` (so it *is* detectable, and
`security` is compared against `false`, never read as a boolean), an optional
column is emitted only once the control has written or cleared it, and **the
platform echoes writes back out of order** — remember every recent write, not
the last one, or a fast typist loses characters. `pcf-date-range-picker` (two,
both required) and `pcf-geo-stamp` (three) are the smaller cases. See *Property
types* in `properties.md`.

### Calling a third-party service from the browser

`pcf-address-autocomplete-azure` — the only `fetch` to a vendor in the
catalogue, and premium because of it: the key as a maker input sent in a
**header** (asserted, and mutation-tested), the endpoint as an enum over the
declared `<domain>`s, the CORS preflight measured passing on a
`*.crm.dynamics.com` origin, an `AbortSignal` on superseded requests, and a
second transaction behind a `TwoOptions` switch. Read *External service usage*
in `manifest.md` **first** — premium is a cost the installer pays.

### Navigation and platform dialogs

`pcf-row-commands` — opens a form, follows a URL from a record, and confirms
before deleting — and `pcf-data-table` 0.4.0 for **creating** a row through the
quick create form (`openForm` with `useQuickCreateForm` and `createFromEntity`
from `mode.contextInfo`; a dismissed form resolves `{ savedEntityReference: null
}`), and `pcf-kanban-board` 0.3.0 for creating it **with a column already set**
— `openForm`'s second argument, a `{ [column]: string }` the typings carry and
most controls never pass. Read *Navigation and dialogs* in
`navigation-and-events.md` **first**: the bag is typed non-optional, its members
go missing one at a time, `openUrl` returns `void`, and a cancelled
`openConfirmDialog` arrives as a **resolve**.

### Selection, and a command over it

`pcf-row-commands` 0.2.0 — a checkbox column kept to **the page on screen** (a
page turn, sort or page size clears it; each render prunes it to the rows
drawn), `setSelectedRecordIds` on every change because the subgrid command bar
acts on it (measured, P3: Assign acted on exactly the ids set, and the platform
*kept* them through the refresh), and **Delete selected**: one confirmation
naming the count, records deleted one at a time with a Stop, one refresh, every
failure named and left selected. `pcf-data-table` is the React shape, and
persists a selection across pages instead. Read *Selection* in `dataset.md` and
*A destructive command over a selection* in `navigation-and-events.md`.
**`cds-data-set-options` is read from the installed control** — an upgrade that
adds the command bar adds it to every existing subgrid (P2), which is a
`docs/migration.md` page.

### Commands a maker defines

`pcf-row-commands` 0.3.0 — buttons described in JSON, from the property or a
web resource it names (the designer's 100-character ceiling), each either
**setting columns** in one `updateRecord` (offered only on rows not already
holding them; reported *after* the write) or **reporting a press** on the
outputs, plus Activate/Deactivate. `config.ts` refuses mistakes by name,
`configLoader.ts` names every load failure, `state.ts` is the Status rule. The
columns it reads are asked for with `addColumn` and never drawn; the command
column stops at 60% of the control and drops its labels past that. Read
*Two channels, and the double fire* in `navigation-and-events.md` first — the
event was not delivered on a subgrid, and the outputs were.

### A command that calls a Web API action — a Custom API on the row

`pcf-row-commands` 0.4.0 — a maker's command with `action` and `bound` posts
the action on the row (`<set>(<id>)/Microsoft.Dynamics.CRM.<name>`) or unbound
with the row in its parameters (`{id}`, and `{record}` built as a typed entity
reference — never spelled by the maker, since the wrong table is accepted).
`action.ts` is the decision module: the path, the body, `readRefusal` /
`readableReason` (the server's sentence without its stack), `readResult` (a 204
says nothing). The set and id column come from `getEntityMetadata`, the
`EntityDefinitions` fetch where it cannot say. A selection runs the calls one
by one through `bulk.ts`. Measured first from the control on a subgrid and a
main grid (its SPEC.md P1–P6, W1–W7), and the walkthrough found the platform's
error dialog never shows `details` — every reason now rides on its `message`.
Read *Calling a Web API action* and *From a row* in `web-api-messages.md`.

### Resizing a column

`pcf-row-commands` 0.2.3 for plain DOM, `pcf-data-table` 0.7.0 for React.
`visualSizeFactor` is pixels (P5); a `width: 100%` table shares a wide host's
surplus into a dragged column, so the table is sized outright; the columns
nobody resized **keep the width they drew before the drag**, and its slack goes
to the column that is always last (row-commands' command column, data-table's
last loose column) — 0.2.0 shared it out and the dragged edge drifted off the
pointer. A `separator` per header edge, pointer capture on the handle alone
(P6), arrows and Home; **no render during a drag** in plain DOM; widths in
`localStorage` by table and view (`getViewId`, P4), every access — the getter
included — in a try. The arithmetic is a decision module in both (`widths.ts`,
`layout/widths.ts`), asserted from source. `pcf-data-table` is also the one
that met **the measurement loop** on a shrink-to-fit section, and its
`dev/preview.html?fit=1` reproduces that host. Read *Resizing a column* and
*A width measured from your own box is a loop* in
`layout.md`.

### Gating a command on the user's roles

`pcf-row-commands` 0.2.0 and `pcf-audit-history` 0.2.0.
`utils.hasEntityPrivilege` **throws unless `Utility` is declared** — published
either way, measured (P1) — so declare it `required="false"`, treat a throw as
"cannot say", and hide only on `false` at every depth. Delete is 4, Write 3.
Read *A privilege before the button* in `context-apis.md`.

### More than one control in a repo

`pcf-toolkit` — `LinkField` and `LinkColumn` in one solution, sharing the
`openUrl` allow-list through a `shared/` module both import. The only repository
of this shape. Read *More than one control in a repository* in
`multiple-controls.md`, and note the hub still publishes one of the two.

### A third-party library that is most of the bundle

`pcf-code-editor` 1.2.0 — Monaco, chosen feature by feature from the bare API
rather than the "everything" entry, its worker declared impossible up front so
the fallback is one warning rather than four errors, and a smoke suite that
drives the control's decisions because the bundle cannot load outside a browser.
Read *A library that is most of the bundle* under *Bundle size* in
`rendering-and-hosts.md`, and [When the bundle cannot load in
Node](../../pcfhub-new-control/references/verification.md#when-the-bundle-cannot-load-in-node) below.

### Configuration from a web resource, and an output that reports a verdict

`pcf-code-editor` 1.3.0 — a JSON Schema read from a Script web resource with a
same-origin `fetch` and no `<uses-feature>` (a static input value is capped at
100 characters by the modern designer; there is no JSON web resource type; a
missing name is a 404 with an empty body; only the published copy is served, so
revalidate), and `isValid`/`problemCount` for a canvas app to gate its Save on:
notified when the verdict changes, failing closed while the schema is not in
force, and documented as canvas-only because binding an output in the classic
designer breaks the form's save. All measured on its 1.2.9 probe. Read *Reading
configuration from a web resource* in `context-apis.md` and *An output that
reports a verdict* in `properties.md`.

### Completion and hover from configuration

`pcf-code-editor` 1.4.0 — property names and allowed values from the JSON
Schema already in force, and a hover with the schema's description: one
provider per language for the page, each editor's schema in a registry keyed
by model URI; the list and hovers in a node under `<body>` that follows the
form's scroll and closes once the caret's line leaves the visible form; Enter,
not Tab, to take a suggestion. Measured on three probe builds before a line of
it was written, and walked through on the form. Read *Language features
without a worker* in `rendering-and-hosts.md` and *A model-driven form keeps
Tab* in `styling-and-accessibility.md`.

### Completion from Dataverse's own metadata

`pcf-code-editor` 1.5.0 — FetchXML completed from the grammar and from the
environment's table definitions: tables, the columns of the table in scope,
the joins a link-entity can make (filling `from` and `to`), a choice's
options by label; hovers for each; and checks whose errors are what the
server refuses and whose warnings are everything else. One reader per page,
each read made when first needed and kept, failures as states; pure modules
that report the metadata they lacked, and async providers that wait for it
within a measured budget. Probed first (1.4.9: the four reads, which column
kinds FetchXML takes, five server refusals). Read *Reading the table
definitions* in `context-apis.md`, *What the server refuses in FetchXML* in
`lookups-and-fetchxml.md` and *Language features without a worker* in
`rendering-and-hosts.md`.

### Rendering Markdown a user wrote, and showing what changed since the save

`pcf-code-editor` 1.6.0 — a Markdown preview through the sanitiser Monaco
already carried, with every image decided while still a token so nothing
outside the environment is fetched, and a *Changes* view: Monaco's diff
editor over a baseline that moves when the form's passes say the record was
saved. Probed first (1.5.9: the diff without a worker, what a save looks like
to a field control, what the renderer fetched and left, `openUrl` from a
press), then walked on the form with a second Code Editor to show another
control's writes are not a save. Read *Markdown or HTML a user wrote* in
`rendering-and-hosts.md`, and *What a field control sees when the record is
saved* in `properties.md`.

### Reformatting as you type — an input mask

`pcf-input-mask` — a Text or Phone column (a type group) typed into a fixed
pattern. The value is held as its **characters**, and the display, the stored
string (formatted or raw, the maker's choice), the cursor and the verdict are
all derived from them in three pure modules the suite loads from source. The
edit path lets the browser edit and reads the field back against the display it
drew, anchored on the cursor — one path for typing, paste, delete, autofill,
undo and a finished composition — and Backspace after a literal removes the
character before it. A partial value is **written** and flagged, with an
`isValid` output for a canvas Save, because a form's save cannot be blocked.
Read *A value the control reformats as you type* in `rendering-and-hosts.md`
and *The cursor, and typing as a person does* in `pcfhub-new-control/references/verification.md` first. 0.0.1
is a probe; its `SPEC.md` P1–P6 are the open questions.

### A number column — a slider, a two-column range, a gauge

`pcf-number-slider` — a standard field control on the four-type number group
(Decimal first, for the hub's demo), with five styles: a slider with a typed
box, a range across two bound columns, a stepper, and read-only bar and arc
gauges coloured by threshold. The column's kind and range come from
`attributes` in the measured evidence order; a value is snapped and rounded to
the column's `Precision` before it is written, so the echo matches; a drag is
one write. The decisions are three pure modules (`number.ts`, `bands.ts`,
`echo.ts`) the suite loads from source, and every guard is mutation-tested.
Read *A bound number column* in `properties.md`, *A drag is one write* in
`rendering-and-hosts.md` and *A native range, styled as Fluent's Slider* in
`styling-and-accessibility.md` first. Its `SPEC.md` maps each probe answer
(P1–P11) to the rule it decided.

### Keeping state across a remount

`pcf-toolkit`'s `LinkField` — the only user of `mode.setControlState`, which is
how an unsaved edit survives a form tab switch. It returns a boolean that
matters, and the field rig's `stateWritable: false` reproduces a host that
refuses.

### Full screen

`pcf-sparkline` — the only caller of `mode.setFullScreen`. Since 0.2.0 it
follows `fullscreen_close` and `fullscreen_open` from `updatedProperties`
rather than trusting its own request, keeps the focus through the render the
host makes, and fits the whole control in the height the host allocates; its
`dev/smoke.js` has the seven checks, which fail against 0.1.0. Read *Full
screen* in `hosts.md`.

### Dates, and whole days

`pcf-date-range-picker` — the only one binding date columns, and it shipped the
same bug three times in different clothes before the shape was clear. Read
*Dates, and the day that moves* in `dates.md` **first**: three timezones are in
play (the browser's, the Dataverse user's, and whatever the column's behaviour
stores in), a column can be *formatted* Date Only while *behaving* as UserLocal,
`context.parameters.x.raw` and `getAttribute().getValue()` disagree on where the
day lives, and `context.formatting` renders in the user's timezone rather than
the browser's. Branch on `Behavior`, convert once at each boundary, and anchor
every whole day at midday.

### Dates over a dataset

A calendar, a timeline, anything that puts a record on a day.

`pcf-calendar-view` — the only one reading date columns through `property-set`
roles. It is the field control's problem with the metadata taken away:
`record.getValue` hands over an ISO string with no `attributes` on the column to
say what it means, so the behaviour comes from `getEntityMetadata` (late,
through React state, as Kanban's lanes do) and the day from
`userSettings.getTimeZoneOffsetMinutes(date)` — **the user's zone, not the
browser's**, which is the one bug a calendar makes visible and a suite on the
author's machine cannot catch without the rig's `userTimeZoneOffset`. The
visible range is a server-side window (`OnOrBefore`/`OnOrAfter`, an `Or` nested
for a missing end) sent from an effect and guarded on the key; a move is
Kanban's two routes writing two columns in one call. Read *A date read through a
dataset* in `dates.md` — all of it measured on the test form 2026-09-16,
including a **+** that sends the user's short date because the quick create
reads an ISO day as UTC midnight, and a date-*formatted* column that is User
Local underneath and takes a bare day a day early. **0.2.0 adds a timeline** —
one row per event, a bar from start to end, an edge dragged to move one end and
write *one* column — and it is the exemplar for a **pointer-capture drag** (a
bar has no cell to drop on; a handle takes only the press, or the release
commits twice) and for an override that retires only when **both** days agree.
Measured on the test form 2026-09-17 (W1–W6 in its `SPEC.md`, all six the right
way) and tagged v0.2.0. See *The timeline, and a drag with nothing to drop on*
there — including the two things the form found that the harness could not: a
bar's text is decided by the measured day width, not its day count, and a
pressed day has to *look* pressed.

### A Web API function

Anything `context.webAPI` cannot address by entity name: a record's audit
history, a message with `Retrieve…` in its name.

`pcf-audit-history` — the only one reading its subject through functions.
`context.webAPI` has no `execute`, but a function is a GET on the organisation
URL, one same-origin `fetch` away: bound
(`audits(<id>)/Microsoft.Dynamics.CRM.RetrieveAuditDetails`) or unbound with
`@`-aliases in the query string
(`RetrieveRecordChangeHistory(Target=@t,PagingInfo=@p)?@t=…&@p=…`). Read
*Calling a Web API function `context.webAPI` cannot* in `context-apis.md`
**first**, for the three things that decided the design: **Learn says the Web
API's `AuditDetail` omits `AuditRecord`, and measured on the form it does not**
— so the history is one `RetrieveRecordChangeHistory` call per page with who,
when and the values together, and the first build (rows from the `audit` table,
a request per row) survives only as the fallback for a user with
`prvReadAuditSummary` and not `prvReadRecordAuditHistory`; the `audit` table
**ignores `maxPageSize`**; and `Prefer: odata.include-annotations="*"` is what
puts formatted values on a function's answer, while the query annotates unasked.
Every fetch through **one helper** with the three OData headers and
`credentials: 'same-origin'`; a non-2xx is a named state. The empty state names
*which* switch is off — organisation, table, or none. It is the **last control
on the sample-data route** (a demo-only `sampleData` input), kept because the
hub's stand-in Dataverse answers no Web API functions; see *Demo presets* in
`dates.md`. **0.2.0 adds Restore** — the first control that writes back what a
function read: the raw kept beside the formatted, a lookup's bind key read off
the detail's own annotations (no `ManyToOneRelationships`), what can go back
decided by rule in a pure module, offered only where every half exists
(`isControlDisabled`, `hasEntityPrivilege(table, 3, 0)` — **Write is 3**, not 2
— the dialog, a writing Web API), single-flighted, and proved by reading page 1
again because the platform audits the restore. Read *Restoring an audited value*
in `context-apis.md`.

### Aggregating a view

A chart, a count, a total over every record the view matches rather than the
page the dataset holds.

`pcf-chart-view` — the first control to send a FetchXML `aggregate='true'`
query. The design that survived: **rewrite the view's own FetchXML** (read from
`savedquery` / `userquery` by `getViewId()`) rather than compose one — every
`<attribute>` and `<order>` out at every depth, `<filter>` and `<link-entity>`
kept, the `groupby` and the aggregate put in, the dataset's runtime filter
appended as FetchXML, `aggregate='true'` on the root — so a linked-table filter
rides along unparsed. A view whose definition cannot be read sends **nothing**;
a runtime filter with an operator the control cannot spell withholds the route;
and **the caption says which route the numbers came from**, because a page-sized
number shown as the whole is the bug this shape exists to avoid. Two routes
behind one interface, the same grouping pipeline over both; a date category
paired with a year group and bucketed by the *user's* zone on both routes. Read
*Aggregating a view through FetchXML* in `lookups-and-fetchxml.md` **first**.
**Measured 2026-09-19: a subgrid's relationship to its parent is invisible**
(`getFilter()` null, `getLinkedEntities()` empty; the first aggregate counted
the whole organisation under one account's subgrid), and `mode.contextInfo`
carries the parent — so `data/parent.ts` finds the lookup column from the
maker's input, the table's `ManyToOneRelationships`, or the loaded rows, and
withholds the route otherwise. Read *A subgrid's relationship is not on the
dataset* there. Also measured: a property-set column is fetched whether or not
the view selects it, and a Choice's `getValue` on a dataset record can be the
string `"1"`. 0.0.3 is on the form for the walkthrough. **`pcf-data-table` 0.6.0
is the second control to send an aggregate**, and what it added is in the same
section: an **alias plan generated from the spec** (`g0`, `m0`, `n`) rather than
a frozen alias map, because N group columns and M measures have no home in a
constant — and **expand-as-filter**, which is how a whole-view aggregate
coexists with a server-paged grid without the two ever being reconciled. Its
parent resolver is chart-view's, near-verbatim, with a worse symptom: a grouped
subgrid puts a wrong total directly above the rows that contradict it.

**`pcf-kanban-board` 0.4.0 is the third, and the first not to carry its own
copy.** The query, the parent resolver, the row reader and the two Web API
reads live in `_template/variants/lib/view-aggregate/` since 2026-09-29, and a
control adopts them by making `<Control>/lib/view-aggregate/` and running
`sync-rig.mjs --into . --add-missing`; what a control adds is a small module
of its own (`data/totals.ts` there) that builds the spec and maps the rows.
Its lane totals re-ask whenever the board's content changes — the route's key
carries it — so a move that lands is counted where it went.
