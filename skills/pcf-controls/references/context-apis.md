# Context APIs and their limits

What `context` can reach beyond the bound value: many-to-many links, web
resources, Web API functions, the current record, `$filter` escaping, platform
rejections and privileges.

- [Context APIs and their limits](#context-apis-and-their-limits)
  - [Linking records over a many-to-many](#linking-records-over-a-many-to-many)
  - [Reading configuration from a web resource](#reading-configuration-from-a-web-resource)
  - [Calling a Web API function `context.webAPI` cannot](#calling-a-web-api-function-contextwebapi-cannot)
  - [Restoring an audited value — writing back what a function read](#restoring-an-audited-value--writing-back-what-a-function-read)
  - [The current record's identity, from a field control](#the-current-records-identity-from-a-field-control)
  - [Escaping a `$filter`, in the right order](#escaping-a-filter-in-the-right-order)
  - [A platform rejection is not an `Error`](#a-platform-rejection-is-not-an-error)
  - [A privilege before the button](#a-privilege-before-the-button)

## Context APIs and their limits

**`context.webAPI` has exactly five methods**: `createRecord`, `deleteRecord`,
`updateRecord`, `retrieveRecord`, `retrieveMultipleRecords`. There is no
`execute`. That means no custom **actions** (the POST messages — `UploadDocument`,
`PublishXml`, a custom API) and no **functions** through it — but both are one
same-origin `fetch` on the organisation's own URL away, each measured, which
is a different constraint from "cannot be done". See *Calling a Web API
function `context.webAPI` cannot* and *Calling a Web API action* in
[web-api-messages.md](web-api-messages.md) before recording either as a
limitation.

**A many-to-many link is not an action, and `context.webAPI` is not the only
way to make one.** Measured 2026-09-23, it is two same-origin requests — see
[Linking records over a many-to-many](#linking-records-over-a-many-to-many).
A junction table is a legitimate model, not a workaround.

**This is where the sharp edge is.** `deleteRecord(ds.getTargetEntityType(), id)`
looks identical in both bindings, but on a native N:N's virtual view
`getTargetEntityType()` returns the *related* entity — so the call deletes that
record outright, environment-wide, rather than detaching it from this one. It is
silent, destructive, and only correct under the junction binding.
`pcf-tag-list` shipped exactly this through 0.2.x; 0.3.0 unlinks with a `$ref`
DELETE and its suite asserts the *absence* of `deleteRecord`, not just the
presence of the right call.

### Linking records over a many-to-many

Measured 2026-09-23 on a model-driven Account form with a native N:N subgrid of
a custom table (`pcf-tag-list` SPEC.md, P1–P4), from a PCF control, through one
`fetch` helper with the OData headers and `credentials: 'same-origin'`:

```text
POST   <parentSet>(<id>)/<nav>/$ref          { "@odata.id": "<clientUrl>/api/data/v9.2/<targetSet>(<id>)" }   → 204
DELETE <parentSet>(<id>)/<nav>(<targetId>)/$ref                                                          → 204
```

Five things the measurement settled, and each changes the design:

- **Both are idempotent.** Linking a pair already linked answered 204; unlinking
  a pair not linked answered 204. A status tells a control nothing about
  whether anything changed, so never branch on it — refresh and read the rows.
- **The subgrid does not say which relationship it shows.** `getFilter()` was
  `null` and `contextInfo` named only the parent, as `pcf-chart-view` measured
  for a one-to-many. The relationship comes from
  `EntityDefinitions(LogicalName='<parent>')/ManyToManyRelationships`, matched on
  the pair of tables.
- **One pair of tables can have several.** The probe's had an N:N *and* a lookup
  from the related table to the parent. Nothing the host hands over tells the
  two subgrids apart, so with more than one candidate ask the maker (an input
  holding the SchemaName) and show the candidates; do not guess. A wrong guess is
  harmless to data (the unlink is a 204 no-op) and still wrong on screen.
- **`<nav>` is the collection on the *parent's* side**: `Entity1NavigationPropertyName`
  when the parent is `Entity1LogicalName`, else `Entity2…`. On the probe's
  relationship both were the SchemaName. A table related to itself has the same
  name on both sides and cannot be told apart by name — refuse it.
- **"What is already linked" is not the loaded page.** A type-ahead that excludes
  only `dataset.sortedRecordIds` offers tags linked on page two (found in the
  harness). A GET on the collection, `<parentSet>(<id>)/<nav>?$select=<primaryId>`,
  answers all of them — standard Web API, the same URL family, not yet measured
  from a control.

No `<uses-feature>` is needed for any of it: the requests are same-origin
`fetch`, not `context.webAPI`. The dataset rig models all of it —
`manyToMany`, `links`, `manyToManyFilter`, `refStatus` — idempotency included.

**`getEntityMetadata` resolves with a class instance, not a plain object**, and
that catches every first attempt to read it. Its own enumerable properties are
private fields; the public API is getters on the prototype. Observed on a real
form, `getEntityMetadata("cll_task", ["cll_status"])`:

```text
{ _entityDescriptor: { Initialized, Id, EntityLogicalName, EntitySetName,
                       PrimaryIdAttribute, ObjectTypeCode, …+50 },
  _entityType: string, _attributes: [string ×1], _activityTypeMask: number, …+38 }
```

`Attributes` does not appear in that listing at all, because **`Object.keys` and
`Object.values` do not enumerate prototype getters**. Code that walks the object
sees only the private fields and concludes the entity has no attributes — while
`metadata.Attributes` returns the collection perfectly well, since property
*access* traverses the prototype chain even though enumeration does not.

So read it by name, or walk prototype descriptors as well as own keys:

```ts
const attribute = metadata.Attributes?.get?.(columnName);
```

**And then read the option list from where it actually is, which is not
`OptionSet.Options`.** Measured 2026-09-11 on `cll_account` with
`getEntityMetadata(entity, [column])`, for a Choice, a multi-select, state and
status:

| Route on the node | Shape | Present |
| --- | --- | --- |
| `node.OptionSet` | **a map keyed by value** — `{ 1: { text: 'Retail', value: 1 }, 4: { text: 'Technology', value: 4 } }` | yes |
| `node.OptionSet.Options` | the array the reference page describes | **`undefined`** |
| `node.GlobalOptionSet` | — | **`undefined`** |
| `node.attributeDescriptor.OptionSet` | an array of `{ Label, Value, TransitionData, IsHidden }` in the maker's order — state adds `DefaultStatus`, `InvariantName`; status adds `State`; **a Choice with colours adds `Color`** | yes |

`Label` and `text` are plain strings on both routes — no
`UserLocalizedLabel` — `Value` is a number, and **`Color` is never on the
map**. It *is* on the descriptor array when the option has one: measured
2026-09-14 on `pcf-kanban-board`'s lane column, `attributeDescriptor.OptionSet:
[{ Color, Label, Value, TransitionData, IsHidden } ×6]`. `pcf-data-table`'s
column had none, which is where "absent on both" came from — absent on that
column, not on the shape. The node also carries `AttributeType` as a number (11 picklist, 17
multi-select, 6 lookup, 1 customer, 2 datetime, 12 state, 13 status) beside
`AttributeTypeName`, and a datetime node carries `Behavior` (2 DateOnly,
1 UserLocal) and `Format` (`'date'` / `'dateandtime'`). Read the descriptor
array first, because it knows the order and `IsHidden`; fall through to the
map, sorted by value; accept an `Options` array as a third route because it
costs a line, and drop any option whose value is not a finite number or whose
label is not a string rather than render `undefined` in a `<select>`.
`pcf-data-table`'s `parseOptions` is the reader, and its dev rig serves one
shape per fixture column so a parser reading only one route is caught by the
other.

Note also that `_attributes` holds the column names that were **passed in**, not
their metadata. The `attributes` argument is a request, not a result, and it
reads exactly like an answer.

It is **model-driven only**, so a control that depends on it should declare
`Utility` as `required="false"` and degrade rather than fail to load (see
[Feature usage](manifest.md#feature-usage)). `pcf-kanban-board` reads lane names this
way and expected `OptionSet.Options` with a `Color`; its `SPEC.md` records
two earlier failed attempts. The 0.2.2 probe finally printed the node
(2026-09-14): its walk had been finding the descriptor array all along, which
is where the lane colours came from. Read every route, and treat colour as
decoration that may not be there.

Other context surfaces worth knowing:

- `context.utils.getEntityMetadata()` — metadata, needs `Utility` feature,
  and **throws at the call** when it is not declared: *"Feature
  'Utility.getEntityMetadata' is required to be specified in the
  <uses-feature> section"* (`pcf-code-editor` 1.4.9 probe, a standard field
  control, 2026-10-01) — as `hasEntityPrivilege` does (*A privilege before the
  button*, below). The same-origin reads in *Reading the table definitions*
  need nothing declared.
- `context.navigation` — opening records, URLs and dialogs. Each method has its
  own availability and its own return shape, and two of them are not promises;
  read [Navigation and dialogs](navigation-and-events.md#navigation-and-dialogs) before calling any
- `context.device.getBarcodeValue()` / `captureImage()` / `pickFile()` — these
  reject outside a real device origin, which is why a control using them cannot
  be a `full`-fidelity demo
- `context.formatting` — number, date, and currency formatting in the user's
  locale. Prefer it over `Intl` so the control matches the rest of the form.
- `context.resources.getString(key)` — reads the `.resx`
- `context.userSettings` — locale, time zone, security roles

### Reading configuration from a web resource

A maker input is a poor place for anything longer than a name: **the modern
form designer refuses a static property value over 100 characters** (*"The
json schema property cannot be more than 100 characters"*, measured
2026-09-23), whatever the manifest's type allows. `pcf-code-editor` 1.3.0
needed a JSON Schema, so the input is the *name* of a web resource and the
control reads the file itself. Measured on a model-driven form (its SPEC.md
P1–P2b):

- **A same-origin `fetch` of `<clientUrl>/WebResources/<name>` answers 200
  from a standard field control with no `<uses-feature>` declared** — no
  import prompt, no premium. `context.page.getClientUrl()` exists there
  though a field control's typings omit `page`; a root-relative
  `/WebResources/<name>` works as well.
- **Dataverse has no JSON web resource type** (the twelve are HTML, CSS,
  Script, XML, the image formats, XSL and RESX), so a JSON file is a
  **Script (JScript)** resource — the designer accepts a `.json` name on it —
  and arrives as `content-type: text/jscript`. Read the body as what you
  expect and ignore the header.
- **A missing name is a 404 with an empty body**: the status is all there is.
  Name the state from it ("not found — check the name, and that it is
  published"), never from a body.
- **An edit reaches nobody until it is published** — the server serves the
  published copy, to a System Administrator too, checked with
  `cache: "no-store"`. A resource never published at all is served as saved.
- **The response says `cache-control: private`**, so the browser may keep an
  old copy after a publish. Fetch with `cache: "no-cache"`: revalidated each
  load, so a new publish reaches the next form load.

**A dataset control reads one the same way** — measured 2026-10-08 from
`pcf-row-commands` on a form's subgrid and on a main grid (its SPEC.md P3):
200 `text/jscript`, `cache-control: private`, and a missing name 404 with an
empty body, no feature declared. Its `configLoader.ts` is the dataset-shaped
loader; the template's dataset rig answers the route from
`fixture.webResources` like the field rig.

**XML has a type of its own.** A **Data (XML)** web resource (type 4) read
from a dataset control answers **200 `text/xml`**, `cache-control: private`,
the body exactly as uploaded, and a missing name 404 with an empty body
(`pcf-data-table` 0.7.3, its SPEC.md P10). So a FetchXML fragment goes in an
XML resource, not a Script one.

**The loader is shared now:** `_template/variants/lib/config-source/load.ts`,
adopted by making `<Control>/lib/config-source` and syncing. It was lifted
from Row Commands and generalised to any text, with the caller saying what
inline text starts with. `classifySource` answers inline text **at once**, with
no promise, because a dataset control that applies its configuration in
`init` draws no unfiltered rows, and one that waits a tick draws the whole view
first (P7 below, in *Rows related through another table*). `loadSource`
fetches a name and answers `ready`, `notFound`, `denied`, `failed`, `offline`
or `noHost`. `pcf-data-table` 0.8.0 is the first control on it; Row Commands
still has its own copy.

A canvas app runs off the environment's origin, so there the same input
carries the content itself (a formula has no 100-character ceiling) — the
control tells the two apart by the first character. The designer also offers
**Bind to table column** for an input, which would give per-record
configuration; unmeasured. The template's field rig answers the route from
`fixture.webResources`, with `webResourceStatus` for 404, 403 and offline.

### Calling a Web API function `context.webAPI` cannot

Moved to [web-api-messages.md](web-api-messages.md) on 15 Oct 2026, so each
file can be read whole:

- **Calling a Web API function `context.webAPI` cannot**

### Reading the table definitions

A control that completes, describes or checks Dataverse names — tables,
columns, relationships, a choice's options — reads them from
`EntityDefinitions` with the same same-origin `fetch` and the same headers
helper, and declares nothing. Measured on the Accounts form by
`pcf-code-editor`'s 1.4.9 probe (its `SPEC.md`, 2026-10-01), as System
Administrator, from a standard field control with no `<uses-feature>`:

| Read | Request | Measured |
|---|---|---|
| The table list | `EntityDefinitions?$select=LogicalName,DisplayName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,IsIntersect&$filter=IsPrivate eq false&LabelLanguages=<lcid>` | 200, **860 tables, 486,406 bytes, 232 ms cold**; no paging; 573,019 bytes without `LabelLanguages` on a two-language environment; `IsValidForAdvancedFind eq true` drops the 91 intersect tables (689 left) |
| A table's columns | `EntityDefinitions(LogicalName='x')/Attributes?$select=LogicalName,AttributeType,AttributeTypeName,DisplayName,Description,IsValidForRead,AttributeOf` | 239 on account, 201,648 bytes, 139 ms |
| Its relationships | `EntityDefinitions(LogicalName='x')?$select=LogicalName,PrimaryIdAttribute&$expand=ManyToOneRelationships($select=…),OneToManyRelationships($select=…),ManyToManyRelationships($select=…)` | **all three kinds in one request**, 22 KB, 102 ms |
| A choice's options | `…/Attributes(LogicalName='y')/Microsoft.Dynamics.CRM.<Picklist\|State\|Status\|Boolean\|MultiSelectPicklist>AttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options),GlobalOptionSet($select=Options)` | every cast took the nested `$select`, 78–103 ms; a Yes/No's are `TrueOption`/`FalseOption` |

What the answers carry, and what a control must not assume:

- **`cache-control: no-cache` on every one, and a repeat is fetched again**
  (214 ms for the warm table list). The browser keeps nothing, so the
  control's own cache is the only one: **one reader per page and
  organisation, shared by every instance**, each read made the first time
  something needs it — never at load — with in-flight requests de-duplicated.
- **A failure is a state, kept for the page's life.** 401/403 is *denied*, a
  rejected `fetch` *offline*, anything else *failed* — each named once, never
  retried per keystroke. A **404 is an answer**: the columns of a table that
  does not exist come back 404, which is how "no such table" is known without
  reading the half-megabyte list.
- **Labels**: `DisplayName.UserLocalizedLabel.Label`, in
  `userSettings.languageId` under `LabelLanguages`. **86 of 860 tables have no
  label** (intersect tables) and neither does any shadow column: fall back to
  the logical name.
- **Shadow columns**: 71 of account's 239 have `AttributeOf` set
  (`accountcategorycodename` of `accountcategorycode`), all `Virtual`, all
  `IsLogical`, none labelled — and **FetchXML takes them**, as an `<attribute>`
  and in a `<condition>`. A name to know, not one to offer.
- **`IsValidForRead: false`** (one column on account, `isprivate`) is refused
  by a query, both ways: `0x80041a08`, *"Retrieve can only return columns that
  are valid for read"*. Composite, `EntityName`, File and multi-select columns
  were all taken.
- **A multi-select is `Virtual` underneath**: read `AttributeTypeName.Value`
  (`MultiSelectPicklistType`) to tell it from the other `Virtual` columns.
- **An option** is `{ Value, Label, Color, Description, IsHidden,
  ExternalValue, ParentValues, Tag, IsManaged, MetadataId, HasChanged }`; a
  State option adds `DefaultStatus` and `InvariantName`, a Status option
  `State` and `TransitionData`. The collection cannot be narrowed further —
  read it per column, when that column's values are first wanted.
- **The many-to-many link needs the table's own key**, which the relationship
  row does not carry: ask for `PrimaryIdAttribute` beside the `$expand`.
- **Never from canvas.** A canvas app has no organisation address; make no
  reader where `page.getClientUrl()` is not there, rather than sending a
  root-relative request somewhere else. Not yet measured: what canvas's
  `context.page` is (the probe's console line appeared, but the control runs
  in a nested frame the console does not evaluate in until its context
  selector is pointed there), and what a user without customization rights is
  answered.

The template's field rig answers all four reads from `fixture.metadata` in
these shapes, with `metadataStatus` (200, 403, or 0 for offline) and
`languageId` — see *A field host* in `pcfhub-new-control/references/verification.md`. `pcf-code-editor`
1.5.0's `metadata.ts` is the reader.

### Restoring an audited value — writing back what a function read

`pcf-audit-history` 0.2.0 is the exemplar: a *Restore* on every line of an
Update's values, opt-in through `showRestore`. It is the first control that
turns a function's **read** into a **write** on the record, and the design
has six parts, each a decision worth copying rather than rediscovering.

- **Keep the raw beside the formatted.** A differ that reduces a detail to
  text has nothing to write back. Each side of a line keeps the wire's own
  value — a money stays a number, a choice its integer, a Two Options its
  boolean, a date the string the server sent — and `undefined` where the
  side had no key at all, which is how a restore tells *was empty* (absent,
  written back as `null` and still a change) from *was cleared* (present
  as `null`). Never normalise a date here: the platform gave the exact
  string it will take back.
- **A lookup's bind key is on the detail.** Under `Prefer`, a lookup's
  `_x_value` arrives with `associatednavigationproperty` and
  `lookuplogicalname` — the two things `updateRecord` needs for
  `<nav>@odata.bind: /<entitySet>(<guid>)` — so this is the one place in the
  catalogue a lookup is written **without a `ManyToOneRelationships`
  read** (compare *Writing a lookup through the Web API*). Two traps: a
  **cleared** lookup has the key on the new side with **no annotations**
  and the names on the old side, so take the annotations from whichever
  side has them, never "new first"; and a `_x_value` key without either
  annotation is still a lookup — refuse it by name rather than write a GUID
  string into a text column. The target's entity set is still
  `getEntityMetadata(target).EntitySetName`, never `${table}s`; a target
  the metadata cannot name refuses the line **before** any write.
- **Decide what can go back in a pure module, by rule.** An Update only (a
  Create has nothing to go back to; Assign and Set State are operations
  with cascades, not values); never `statecode`, `statuscode`, the owner
  columns, the platform's bookkeeping, a `_composite`, a `_base` shadow; a
  value the platform cut at 5 KB (writing it back writes the cut); a column
  the metadata marks `IsValidForUpdate: false` — and the metadata's
  **silence is not a refusal**: `null` refuses nothing, because a host
  without an organisation URL cannot say. `audit/restore.ts` there is the
  file: `refusal()`, `restorable()`, `plan()`.
- **`IsValidForUpdate` is on the attribute metadata and nowhere
  `getEntityMetadata` reaches — and the read is load-bearing.** Measured
  2026-09-18: `getEntityMetadata(table, columns)`'s items carry
  `AttributeType` (4 double, 6 lookup, 7 memo, 8 money, 14 string),
  `AttributeTypeName` (lower-case) and `Targets` on a lookup, and
  `IsValidForUpdate` is `undefined` on every one; a same-origin
  `EntityDefinitions(LogicalName='account')/Attributes?$select=LogicalName,AttributeType,IsValidForUpdate`
  answers all 238 in 87 ms (104 false — every `*name` virtual column,
  `*_base`, `*_composite`, `createdon`, `exchangerate`…). Read it once per
  table and cache it. **The server does not refuse a write to such a
  column** — `updateRecord({ address1_composite: 'x' })` and
  `({ createdon: '2020-…' })` both *resolved* and changed nothing — so
  without that read a Restore on the line succeeds, reloads, and shows
  nothing changed. What the server *does* refuse, as `errorCode`
  2147781913 with the sentence after `InnerException :`: an unknown column
  (*Invalid property 'x' was found in entity*) and an undeclared
  `@odata.bind` (*An undeclared property 'x' which only has property
  annotations*).
- **Offer it only where every half exists**, and read each half off the
  host separately: the input on; `mode.isControlDisabled` false (a
  read-only form — an inactive record — is where a write has no business);
  `utils.hasEntityPrivilege(table, Write, Basic)` not `false` (with **`Utility`
  declared**, or the call throws — see *A privilege before the button*) — **Write is
  `3`, Read is `2`, Basic is `0`**, from the typings, and the one thing
  people get wrong is guessing Write is 2; and on the live route
  `webAPI.updateRecord` present and `navigation.openConfirmDialog` present.
  No dialog, no Restore — the *Confirm, then destroy* rule; the demo route
  simulates both instead.
- **Single-flight it through the reducer, and let page 1 be the proof.** A
  double press before the dialog paints is two writes, so `restoreRequested`
  is ignored while one is busy. After the write, read page 1 again: the
  platform audits a restore like any other change, so the restore is the
  newest row — the *Updated* by the user, the sides swapped — and a list that
  shows it has proved the write without a second read-back. Keep the rows
  on screen until the page lands (`reload` drops the cursor, not the rows),
  or the restore blanks the list it is proving.
- **The form is behind, and the control has to say so.** The write went
  through the Web API, around the form: the field on the form still shows
  the earlier value, and an unsaved edit to the same column will overwrite
  the restore when the form saves. A notice above the list says it, and
  offers *Refresh* through `navigation.openForm` on the same record. (What
  `openForm` does with an unsaved form is SPEC.md R4 there.)

**The rig.** The field rig's `updateRecord` **applies and audits**: each
host works on its own copy of the fixture (rows one level deep, so a write
never leaks into a later host), the
payload lands on the row (a primitive under its key, a bind as
`_<column>_value` with its three annotations, `null` clearing either), and
where the fixture has an `audit` table the write becomes the newest row
by `userSettings.userId`/`userName` (two new switches) with an
`AttributeAuditDetail` whose old side is what the row held. An undeclared
bind is the measured undeclared-property fault; a bind to a missing record
is *Record Is Unavailable*; a key in `fixture.notUpdatable[table]` is
**dropped without a word**, as the server does, and
`EntityDefinitions(…)/Attributes` lists it as `IsValidForUpdate: false`.
`getEntityMetadata(target).EntitySetName` is the target's, from
`fixture.entitySets`. So a suite can restore through the control and assert
the restore on the next page.

### The current record's identity, from a field control

A control on a form frequently needs to know which record it is on — to attach a
note, to build an `@odata.bind`, to query something related. **The framework
does not give it to you, and that is deliberate.** From the FAQ: components "do
not provide this because they need to be supported on multiple surfaces where
this information may not be available."

There are two routes and neither is sufficient alone.

**The documented one.** Declare input properties and have the maker bind them on
the form — the id to the table's own id column, the name to a static value:

```xml
<property name="recordId" of-type="SingleLine.Text" usage="input" required="false" … />
<property name="recordEntity" of-type="SingleLine.Text" usage="input" required="false" … />
```

Supported, works on every host, and empty until somebody configures it — which
they will not, because nothing tells them to until the feature silently does
nothing.

**The one everybody actually writes.** `context.mode.contextInfo` carries
`entityId` and `entityTypeName` at runtime and is **absent from
`@types/powerapps-component-framework` altogether**, so reaching it costs a
cast:

```ts
const contextInfo = (
    context.mode as unknown as { contextInfo?: { entityId?: string; entityTypeName?: string } }
).contextInfo;
```

Undocumented, untyped, and **present but false in canvas**: a published canvas
app answered `{ entityTypeName: 'account', entityId: '4ff37e24-…',
entityRecordName: 'A. Datum Corporation (sample)' }` on every control, and no
such account was in the environment (probe, 2026-10-06). So its presence is not
proof of a record; in canvas the bound `entityId` / `entityName` inputs are the
only route. `pcf-tag-list` has used it since before this section existed.

`context.page` is the same kind of member — undocumented, untyped, present on a
model-driven form — and its `getClientUrl()` is the organisation URL a
same-origin metadata `fetch` starts from. `pcf-hierarchy-view` reads it from
a field control the way `pcf-data-table` does from a dataset one (`page`
first, the `Xrm` global second, and without either the control takes the route
that needs no metadata). The field rig has it behind `page: true`, absent on
canvas.

**Do both: prefer `contextInfo`, fall back to the bound inputs, and where
neither is configured, decline the feature with a sentence that says which
properties to bind.** Guessing is the one option that is wrong — an
`@odata.bind` built on a missing id attaches a record to nothing, or to the
wrong thing, without failing.

Validate both before they reach a URL. On the fallback path they are free text a
maker typed into a properties pane, and the entity name is interpolated into a
navigation property *and* a path. A logical name is `/^[a-z][a-z0-9_]*$/`;
anything else cannot name a table, so drop it rather than send it. `pcf-geo-stamp`
does this and asserts it.

One more cost: `@odata.bind` needs the parent's entity **set** name, the plural,
and only `context.utils.getEntityMetadata` knows it. That is `Utility`, and it
is model-driven only — so a control needing identity to *write* is a
model-driven control whatever else it supports.

### Escaping a `$filter`, in the right order

Any control that builds a query from something a user typed has two escaping
rules to apply, and each is silently wrong without the other:

1. **A single quote inside an OData literal is doubled**, not encoded. Without
   this, a search for `O'Brien` closes the literal early and the request is
   rejected.
2. **The query string is URL encoded.** Microsoft's `retrieveMultipleRecords`
   reference says an OData `options` string "should be encoded for special
   characters" — and unencoded `&`, `+`, `#` or `?` in a term change what the
   rest of the query *means* rather than what it matches.

The order is what makes them compose, and it is not obvious:

```ts
const literal = encodeURIComponent(term.replace(/'/g, "''"));
```

`encodeURIComponent` does not touch `'` — it is an unreserved mark — so doubling
first and encoding second leaves the `''` pair intact while still encoding
everything else. Encoding first produces `%27%27`, which matches nothing and
fails as an empty result rather than as an error.

The same boundary is where maker-supplied **column names** stop. A logical name
is `/^[a-z][a-z0-9_]*$/`; anything else cannot name a column, and interpolating
it into a URL is how free text becomes a different query. Drop what cannot be a
logical name and let a merely *wrong* one reach the server, where its error is
visible — that is the typo worth surfacing.

### A platform rejection is not an `Error`

A `webAPI` rejection is a plain object carrying `errorCode` and `message`,
exactly as the Client API's `errorCallback` documents. A **device** rejection is
a plain object carrying `code` and `message` — same idea, different name — and
`getCurrentPosition` can also reject with a bare `null`. So the reflex that
handles every other failure in a TypeScript codebase:

```ts
setFailure(error instanceof Error ? error.message : String(error));   // wrong
```

falls through to `String({ errorCode, message })` and renders the literal string
**`[object Object]`** where the platform's explanation should be. Read the
message off the object shape instead, and keep a localised sentence for the case
where there is nothing usable:

```ts
export function describeError(error: unknown): string {
    // First, and not defensive programming: getCurrentPosition is documented to
    // pass `null` to its error callback on an older mobile client. Without this
    // line the next one throws, so the failure handler fails.
    if (error === null || error === undefined) return '';

    if (error instanceof Error && error.message) return error.message;

    if (typeof error === 'object') {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message !== '') return message;
    }

    return typeof error === 'string' ? error : '';
}
```

Read the *number* separately where it means something, and know which name to
read: `errorCode` on a `webAPI` rejection, `code` on a device one — where `1`
is permission denied, `2` position unavailable, `3` timeout. Only `1` is worth
distinguishing to a user, because it is the only one they can do something
about.

This is worth more attention than a formatting slip, because of *which* messages
it eats. A control that queries Dataverse is configured with column names a
maker types by hand, and the server's rejection is the only thing that ever
names the wrong one. Swallowing it into `[object Object]` leaves a maker with a
control that does not work and no way to find out why — and it does so on every
webAPI failure, not an unusual one.

It also passes a review that only asks whether errors are surfaced: they are,
visibly, in the right place, saying nothing. Observed on `pcf-lookup-search`
against a real contact lookup, and reported as a bug by the person whose form it
was.

### A privilege before the button

`utils.hasEntityPrivilege(table, privilegeType, depth)` answers synchronously,
with a boolean, about the user's security roles. `PrivilegeType`: Create 1,
Read 2, **Write 3**, **Delete 4**, **Assign 5**, Share 6, Append 7, AppendTo 8.
Depth: Basic 0, Local 1, Deep 2, Global 3. Assign, Share and AppendTo were
asked by `pcf-kanban-board`'s 0.4.8 probe (2026-10-10) and answered booleans
like Write and Delete — `true` at every depth for a System Administrator; a
user without Assign was not to hand. **In canvas the call throws**
*hasEntityPrivilege: Method not implemented.*, with `Utility` declared — read
it as "cannot say".

**It throws unless the manifest declares `Utility`** — measured 2026-09-25
(`pcf-row-commands` P1): the method is published whether or not the feature is
declared, `typeof` answers `"function"`, and every call throws *Feature
'Utility.hasEntityPrivilege' is required to be specified in the <uses-feature>
section in ControlManifest.xml before use.* Presence is not permission. Declare
it `required="false"` — a new install-time prompt on upgrade, which the release
notes owe an explanation — and treat a throw as **"cannot say"**, not as "no".

Three answers, then, and they call for different things:

| Answer | Means | Do |
| --- | --- | --- |
| `true` at some depth | the roles allow it somewhere | offer the command; the server decides for this record |
| `false` at every depth | the roles allow it nowhere | hide it — the server can only refuse |
| a throw, no `utils`, a non-boolean | the host cannot say | behave as before the check existed |

It is **per table**, not per record: owner-only Delete answers `true` and the
command shows on other people's rows too. A per-record answer is a request per
row. Both rigs have `hasPrivilege` and `utilityDeclared: false`; the dataset
rig's also takes a function of `(type, depth, table)` or `'throws'`. A system
administrator answers `true` everywhere, so the `false` branch is the one only
a differently-privileged user reaches on a form.
