# Dataset controls: writing

Writing a record from a dataset control — through the record itself, through
the Web API, a Status Reason, and a lookup. Reading the view is in
`dataset.md`; fitting a table to its host, and any layout in a measured width,
is in `layout.md`.

- [Writing from a dataset control](#writing-from-a-dataset-control)
  - [The dataset record can write, and the typings do not say so](#the-dataset-record-can-write-and-the-typings-do-not-say-so)
  - [Two routes, chosen per record](#two-routes-chosen-per-record)
  - [Writing a Status Reason](#writing-a-status-reason)
  - [Writing through the Web API instead](#writing-through-the-web-api-instead)
  - [Writing a lookup through the Web API](#writing-a-lookup-through-the-web-api)
  - [A second column beside the lane, and Owner](#a-second-column-beside-the-lane-and-owner)

## Writing from a dataset control

Reading a view is most of what dataset controls do, so the ones that write are
where the untested paths are. `pcf-kanban-board` writes a choice column when a
card is dragged between lanes; `pcf-tag-list` links and unlinks over a
many-to-many with `$ref`, or binds and clears a lookup.

### The dataset record can write, and the typings do not say so

⚠️ Measured on a real model-driven subgrid, 2026-09-09, `cll_account` on
Dataverse online. Not yet measured in canvas.

`EntityRecord` in `@types/powerapps-component-framework@1.3.18`
(`componentframework.d.ts:2675`) declares **four** methods: `getFormattedValue`,
`getRecordId`, `getValue`, `getNamedReference`. A live record on a subgrid
carries **twenty-three**. The four documented ones, plus:

| Method | Shape | Measured |
| --- | --- | --- |
| `setValue(name, value)` | **sync — returns `undefined`** | Stages the value. See the trap below: the reference page types it `Promise` and it is not one. |
| `save()` | async | Commits. The value renders in the grid afterwards. |
| `isDirty()` | async | See the caveat below. |
| `isEditable(name)` | **async** → boolean | Real per-column answers — `true` for two text/decimal columns, `false` for `statuscode` on the same record. |
| `isSecured(name)` | **async** → boolean | Column-level security. |
| `isReadable(name)` | **async** → boolean | |
| `getFieldRequiredLevel(name)` | **async** → number | `0` for optional. |
| `isValid(name)` | **sync** → boolean | |
| `getValidationError(name)` | sync | |
| `getCurrencyDecimalPrecision(name)` | sync | `null` on a non-currency column. |
| `reformatValue`, `getFileObject`, `getPersonaInfo`, `usePresenceStatus`, `useProfilePhoto`, `isRecordValid` | — | Present, unmeasured. |

`getColumnInfo` and `DataSet.newRecord` are **absent** on model-driven, which
matches Microsoft's own "canvas apps" annotation on both. So a dataset control
can write to existing rows on either host and can only *create* rows in canvas.

**Why this is worth the trouble of reaching past the typings.** The alternative
write path is `webAPI.updateRecord`, which needs
`<uses-feature name="WebAPI" />` — an install-time permission prompt in every
environment — and does nothing at all in a canvas app, because WebAPI is not
available there. `record.setValue()` needs no feature-usage entry, so an
editable dataset control can install with no prompt and work on both hosts.
`pcf-kanban-board` predated this finding and paid the prompt through 0.2.x;
0.3.0 routes per record — see *Two routes, chosen per record* below — and
keeps the prompt for the column that needs it.

Reaching them needs a local interface and a cast, plus a runtime feature detect
— the same treatment `paging.loadExactPage` gets, and for the same reason: a
member the typings mark required is a claim about the type definitions, not
about the host.

```ts
interface EditableRecord {
    // NOT a promise. Typed `unknown` so a host that returns one is not an error.
    setValue(columnName: string, value: unknown): unknown;
    save(): Promise<unknown>;
    isEditable(columnName: string): Promise<boolean>;
}

const editable = (record: unknown): EditableRecord | null =>
    typeof (record as EditableRecord)?.setValue === 'function'
    && typeof (record as EditableRecord)?.save === 'function'
        ? (record as EditableRecord)
        : null;
```

**`isEditable` is the one to build around.** Column-level editability is not on
`Column` — the whole interface is `name`, `displayName`, `dataType`, `alias`,
`order`, `visualSizeFactor`, `isHidden`, `isPrimary`, `disableSorting` — so
every editable-grid design without it ends up offering an editor on any column
of a writable *type* and discovering the truth when the save is refused. With
it, a cell the user cannot write can be rendered as read-only before they touch
it. Grid *disabling* is one of the most requested grid extensibility features;
this is the dataset control's version of it, and it has been reachable all along.

The shape that works, and the one that cannot:

```ts
// Right. Set synchronously, await only save, then re-read.
record.setValue(column, value);
await record.save();
dataset.refresh();

// Wrong, and it fails in the worst possible way.
record.setValue(column, value).then(() => record.save());
```

Verified end to end on a real model-driven subgrid, 2026-09-09: the edit saved
and survived a reload. Verified again 2026-09-11 for a **Choice** column:
`setValue(column, 4)` then `save()` read back `4` from the Web API, and
`setValue(column, null)` cleared it. `isEditable` answered `true` for the
choice and `false` for `statecode` and `statuscode` — all three report
`dataType: 'OptionSet'`, so the platform's answer, not the type string, is
what keeps state and status read-only. `getValue` on a choice returns the
**string** `"3"` while `setValue` wants the integer, so compare through a
coercion rather than `===`.

🔴 **`setValue` does not stage a Lookup, on the one host it has been tried
on.** Same probe, a `Lookup.Simple` column, five value shapes — the
`LookupValue` `{ id, name, entityType }`, the same in an array, the
`EntityReference` `{ id: { guid }, etn, name }` the column reads back as, the
braced upper-case shape `lookupObjects` resolves with, and `null` — every one
accepted by `setValue` and every `save()` refused with `Invalid snapshot with
id undefined`, the stored value untouched. One call resolved once and a Web
API read-back showed it had saved nothing. `pcf-data-table` 0.4.0 specified a
lookup editor on this path and cut it on that measurement; 0.5.0 built it on
`webAPI.updateRecord` instead — see *Writing a lookup through the Web API*
below, which is the measured route and the only one. The template rig accepts
a lookup write like any other and its comment says why — refusing it there
would model one host's failure as a contract.

Four traps, all measured:

- **`setValue` returns `undefined`, and chaining off it throws
  *synchronously*.** `record.setValue(...).then(...)` is `.then` on nothing —
  a `TypeError` raised outside every `.catch` in the chain, and outside any
  timeout wrapper, because it is thrown before either is reached. A control that
  had already marked the cell as saving then shows Saving… for ever, with no
  rollback, no message and no write. `pcf-data-table` shipped that through three
  releases. Microsoft's reference page types the method `Promise`, which is
  where it comes from; the samples that work call it synchronously. Wrap the
  call — `Promise.resolve().then(() => record.setValue(...))` — so a synchronous
  throw becomes a rejection the caller can handle.
- **`refresh()` is part of the write — on a paged control.** `save()` commits
  and nothing re-reads until something asks. Without it an optimistic override
  is the only thing holding the new value on screen, so the cell shows the edit
  until the next platform-driven fetch and then appears to lose it. A control
  that accumulates pages with `loadNextPage()` is the exception: a refresh
  drops every page but the first — see *Writing through the Web API instead*.
- **The per-column methods are `async`.** `isEditable`, `isSecured`, `isReadable`
  and `getFieldRequiredLevel` return Promises; `isValid` and
  `getCurrencyDecimalPrecision` return values. Nothing distinguishes them by
  name. Calling the async ones without `await` yields a Promise, which is
  **truthy** — so `if (record.isEditable(name))` is true for every column,
  including the ones that are not editable. That is a bug that looks like
  working code.
- **A wrong column name throws `UciError: Invalid snapshot with id undefined`.**
  Microsoft documents exactly this string on the `save` reference page as the
  symptom of a bad `setValue` column name, and it is worth recognising because
  the message names neither the column nor the record. Use the logical name —
  `column.name`, not `alias`, not the display name.
- **`isDirty()` returned `false` immediately after a resolved `setValue`.**
  Unexplained as of this writing; the write still committed. Do not gate a
  commit on `isDirty()` until somebody has established what it actually tracks.

Because these are async, resolving editability is a **fetch**, not a read: it
cannot happen during render. Resolve it in `updateView` for the columns on the
current page, cache it by record and column, and render read-only until the
answer arrives — declining to offer an editor is always safe, and offering one
that the platform then refuses is not.

### Two routes, chosen per record

"Prefer `record.setValue()`" is not "delete `webAPI.updateRecord`", and the
column that proves it is the one a board is most often grouped by.
`isEditable` answers `false` for `statuscode` while the column reports
`OptionSet` — measured above — and a plain Web API update writes
`statuscode` perfectly well. So a control that writes a column it did not
choose (a `property-set` role the maker bound) has to be able to take either
route, and the record is what decides, per record:

```ts
private write(record: unknown, column: string, id: string, value: number): Promise<unknown> {
    const editable = editableRecord(record);
    const viaApi = (): Promise<unknown> =>
        typeof api?.updateRecord === 'function'
            ? api.updateRecord(entity, id, { [column]: value })
            : Promise.reject(new Error(readOnlyMessage));

    if (!editable) {
        return viaApi();                       // the host the typings describe
    }

    return Promise.resolve()
        .then(() => editable.isEditable(column))
        .then((allowed) => {
            if (allowed !== true) {            // `=== true`: a Promise would be truthy
                return viaApi();               // statuscode, statecode, a secured column
            }

            editable.setValue(column, value);  // sync; the wrapper turns a throw into a rejection

            return editable.save();
        });
}
```

Three consequences, each of which `pcf-kanban-board` 0.3.0 carries:

- **`WebAPI` stays declared, `required="false"`.** It is the second route,
  not a legacy one. The prompt it costs buys the `statuscode` boards; a host
  without it (canvas) loads the control and takes the record route or none.
- **"Can this host write?" is either route.** Check the first loaded record
  for the write half *or* `webAPI.updateRecord` — a canvas host with writable
  records is writable even with no Web API. Which route a *particular* card
  takes cannot be answered there, because `isEditable` is per record.
- **The rollback does not know which route failed, and must not care.** Same
  override, same message, same `refresh()` from `finally` — the rig's
  `saveRejects` and `webApi: 'rejects'` switches both have to land on the
  same assertion. A refused `save()` rejects with the platform's own shape,
  not an `Error`, exactly as `updateRecord` does.

Measured on the property-set shape 2026-09-14 (`pcf-kanban-board` 0.2.2
probe, `cll_task.cll_status`): `isEditable` answered `true`, `setValue`
returned `undefined` at +4 ms, `save()` resolved **`{ etn, id: { guid } }`**
at +438 ms, and the Web API held the new integer at +513 ms. Then the part
that decides how an optimistic control is written: **one `updateView`
arrived unasked in the next fifteen seconds, and its dataset still carried
the old value** — the platform repaints after a save without re-reading. An
override retired on "a pass came after the save" snaps the card back for the
length of a fetch; retire it when the *record's value agrees*, and keep the
`refresh()` in `finally`, because that is the pass that agrees.

Whether a **canvas** dataset record carries the write half at all is still
unmeasured — the rig hands canvas the same records as model-driven, and
`pcf-kanban-board` says "read-only, in practice" for that reason. Do not
promise canvas moves in `docs/` until somebody has bound a board there and
looked.

**And retire the override against a value read the way the record hands it
over.** A Choice's `getValue()` is the numeric *string* `"3"` on a form
(measured on three subgrids); `pcf-kanban-board` compared it with the number
it had written, so through 0.3.5 no override ever retired against data — only
when the record left the view — and a card dropped back in its own lane was
written again. Its own rig answered a number and hid both; the template's
answers the string. Read a lane or a choice through one normaliser everywhere
it is compared.

### Writing a Status Reason

A board grouped by **Status Reason** (`statuscode`) — the column a board is
most often grouped by — writes a reason, and a reason belongs to a state.
Measured 2026-09-29 on `cll_task` (`pcf-kanban-board` 0.3.6 probe, SPEC.md
T1–T7):

- **The role binds it.** A `property-set` of `of-type="OptionSet"` offered
  Status Reason in the designer; the column arrives `dataType: "OptionSet"`,
  `name: "statuscode"`. `isEditable` answers `false` for both `statuscode`
  and `statecode`, so the write is the Web API route above.
- **The state is already in hand.** `getEntityMetadata(table, ['statuscode'])`
  puts, on each `attributeDescriptor.OptionSet` entry, `{ Label, Value, State,
  TransitionData, IsHidden }` — **`State` a number, and no `Color`**, so a
  Status Reason board has no option colours to show. `statecode`'s entries
  carry `DefaultStatus` and `InvariantName`. No new call, no new feature.
- **A bare reason into the other state is refused, not repaired.**
  `updateRecord({ statuscode })` from `{ statecode: 1 }` to a reason of state
  0 rejected `2147779592`, title *"State code or status code is invalid."*, a
  message naming neither — only the platform's own console line said which
  reason and which state. **`{ statecode, statuscode }` together is
  accepted**, and a reason within the record's own state is accepted alone.

So: send the state **only when it changes**, which keeps every payload one of
the two watched accepted; a Status (`statecode`) board sends the lane's
`DefaultStatus` beside it; and where the option set could not be read the
move goes bare, as before, and the refusal rolls it back. A pair is one Web
API update, never the record route, which stages one column.
`pcf-kanban-board`'s `movePayload` in `lanes.ts` is the whole rule. The
dataset rig models it: reasons with `state` in the fixture, and
`updateRecord` refusing the bare cross-state reason the same way.

**Status reason transitions, measured the same day** (0.3.7, T6):

- **`TransitionData` on the descriptor is a list of the allowed next reasons**
  — `[858010001, 858010002]` — not the XML string Learn documents; that
  string is what `EntityDefinitions(…)/Attributes(…)/…StatusAttributeMetadata`
  carries. Read both.
- **Defined is not applied.** Every reason carried its list while
  `EntityDefinitions(…)?$select=EnforceStateTransitions` answered `false`,
  and nothing was refused. It turned `true` only once *Enable Status Reason
  Transitions* was ticked and published. Read the flag; do not infer it from
  the data. It was not seen on anything `getEntityMetadata` returned, so it is
  one same-origin read, cached per table.
- **With it on, the server refuses a disallowed move only where the state
  changes**: Active → Inactive rejected `2147807246`, title `""`, *"Action
  could not be taken for few records before of status reason transition
  restrictions."* (verbatim), while a disallowed reason **within** one state —
  Cancelled → Inactive — went through. So a control that honours transitions
  as the form's dropdown does has to be the guard for the same-state ones:
  `pcf-kanban-board` closes the disallowed lanes while a card is dragged,
  leaves them out of the Move menu, and checks the rule again before it
  writes. The dataset rig answers the flag (`enforceStateTransitions`) and
  refuses as the server does.

Closing a case or winning an opportunity takes its own message
(`CloseIncident`, `WinOpportunity`) and an update is refused for those states;
a board over them gets the refusal and the rollback. And a Status Reason
option *can* carry `Color` — `#0000ff` on all four after the column was edited,
none before — so draw it where it is and assume nothing.

**Activate and Deactivate are the same rule, measured on `account` 2026-10-08**
(`pcf-row-commands` 0.2.5 probe, P4/P5): `getEntityMetadata(table,
['statecode'])` gives each state its `DefaultStatus` (0 → 1, 1 → 2);
`updateRecord({ statecode: 1, statuscode: 2 })` deactivated; a bare `{
statuscode: 1 }` back into Active was refused `2147779592` with *"State code is
invalid or state code is valid but status code is invalid for a specified state
code."* — the `cll_task` finding, on a system table. Two more things a row
command needs: **a view without Status can still be read** — `addColumn
('statecode')` and one `refresh()` bring it, `getValue` → `"0"` (a string, as
every choice); keep the column you asked for out of the drawn table — and
**offer the pair only where Status is exactly Active (0) and Inactive (1)**: a
case's Resolved and Cancelled are not a "deactivate", and resolving is its own
message. `pcf-row-commands` 0.3.0's `state.ts` is the whole rule.

### Writing through the Web API instead

The older path, and still the right one for anything that is not a column on a
row the dataset already carries: creating junction rows, deleting, writing to a
record the view does not hold. It costs `<uses-feature name="WebAPI" />`, which
is an install-time prompt in every environment, and it does nothing in canvas —
so prefer `record.setValue()` above wherever it fits.

The write itself is unremarkable — `updateRecord` against
`dataset.getTargetEntityType()` and the record id, with the column's **`name`**
as the attribute key (found by `alias`, read by `name`, as everywhere else).
What takes the thought is that the user has already seen the result.

**An optimistic write costs three things, not one.** Showing the change
immediately is right — nobody waits a round trip to see a drag land — but it
means the control is asserting something about the data that is not true yet:

1. **An override map**, record id to the value this control asserted, consulted
   in preference to the data when rendering.
2. **A reconcile step in `updateView`** that retires an override once the
   refreshed record reports the asserted value — **not** when the promise
   resolves. A resolved `updateRecord` means Dataverse accepted the write, not
   that the dataset has re-read it; clearing on resolve drops the override while
   the old value is still on screen, and the item visibly jumps back and then
   forward. Retire it too when the record has left the view entirely, which is
   what a filtered view does when the record no longer matches — without that
   the map grows for the lifetime of the control, and every entry is something
   being rendered from memory rather than data.
3. **A rollback in `.catch()`** that removes the override and says what failed.

That third one is the one that goes missing: `pcf-tag-list`
through 0.2.x had no `.catch()` anywhere, and a failed create or delete
surfaced only as the dataset not changing. 0.3.0 turns each failure into the
server's sentence under the control. Survivable for a chip that vanishes and
reappears; not survivable for anything whose position on screen now
misreports the record — which is why the sentence matters more than the chip.

Read anything the failure message needs **before** sending the write. By the
time a rejection arrives the record may be gone from a refreshed dataset, and a
message that cannot name what failed is most of the way to useless.

```ts
const label = title ? record.getFormattedValue(title.name) : recordId;

this.pending.set(recordId, toValue);
this.notifyOutputChanged();

void context.webAPI
    .updateRecord(dataset.getTargetEntityType(), recordId, { [status.name]: toValue })
    .catch((error: unknown) => {
        this.pending.delete(recordId);
        this.moveError = `${failed.replace('{0}', label)} ${describe(error)}`;
        this.notifyOutputChanged();
    })
    .finally(() => {
        dataset.refresh();
    });
```

`refresh()` from `finally` rather than from `then`: on success it is what
eventually retires the override, and on failure it repaints from data that never
changed, which costs a fetch and removes any doubt about what is on screen.
Calling it from a promise callback is safe — the loop to avoid is a mutator
called unguarded from `updateView` itself.

**Except where the control loads more rather than paging: a refresh starts the
view again at its first page.** Observed on a form 2026-09-29
(`pcf-kanban-board` 0.4.0): after **Load more** two or three times, the
`refresh()` a move ended with brought back page one alone, and every card past
it vanished — the write had landed and nobody could see it. The dataset rig
now resets on a refresh the same way. So a control that accumulates with
`loadNextPage()` does **not** refresh after a write (`pcf-kanban-board` 0.4.1):

- the override already shows the landed value and retires at the next fetch
  that agrees — `reconcile()` is unchanged;
- a failure has no render to repaint from, because a notify with unchanged
  outputs brings none — so the write resolves an outcome (`{ ok, message }`,
  never a rejection) to the React component, which puts the item back, shows
  the sentence and clears its busy state from its own state;
- anything keyed on the rows (an aggregate's route key) counts landings in the
  component too, since a second write to the same record changes no output
  and brings no render either.

A create still needs a fetch to show the new row, and so still starts at page
one — say so in `docs/limitations.md`. **Or show it from what the write
returns**: `pcf-tag-list` 0.5.2 draws an attached or created tag from its id
and name until a fetch holds it, and hides a removed one until a fetch drops
it — no refresh after any write.

**Put that held state in a pure module the suite loads, not in the
component.** A static render holds no React state, so the one piece of logic
this pattern adds is the one a bundle-driven suite cannot see. 0.5.1's first
build passed 88 assertions and then, on the form, removed a just-created tag
through the API and kept drawing it: the removal hid *rows*, and a tag the list
has just added is in no row yet — only in its "added" list. Now `chips.ts`
(`afterAdd`, `afterRemove` clearing **both** lists, `reconcile`,
`visibleChips`) is loaded from source through `dev/modules.js`, and leaving
"added" untouched fails the create-then-remove check. Check that sequence —
add, then undo it before any fetch — for every held-state pair a control keeps.

A rejected call is typed `unknown` and is not reliably an `Error`; take
`.message` where there is one rather than printing `[object Object]`.

**The demo can show this, from 2026-09-28.** A `faults` entry or a withheld
privilege in the fixture's `dataverse` section makes the hub's stand-in refuse
a write, so the rollback runs in front of a visitor: `pcf-kanban-board`'s move
into Resolved, `pcf-data-table`'s City edit. See *It refuses a write when the
fixture says so* in `pcfhub-publish/references/hub-demo-dataverse.md`. Before that every write resolved
there, and the one path the whole design exists for was the one a visitor
could not see.

### Writing a lookup through the Web API

The one column type the record cannot write (🔴 above), so the one place the
Web API path is not a choice. Measured on a real model-driven subgrid on
2026-09-13 by a probe build of `pcf-data-table` — nine questions, every
answer written into its `SPEC.md` 0.5.0 before the feature existed — and
walked through the shipped editor the same day. The write is:

```ts
webAPI.updateRecord(entity, id, {
    [`${navigationProperty}@odata.bind`]: `/${entitySet}(${guid})`,   // or null
});
```

and every one of its three parts is something to **read, not derive**:

- **The navigation property is not the column's logical name by rule, and
  not its schema name by rule.** On the probe table the key for
  `cll_primarycontact` was `cll_primarycontact` — the logical name — and the
  schema-cased `cll_PrimaryContact` that the first design assumed was rejected
  as *"An undeclared property … which only has property annotations in the
  payload but no property value"*. A `Lookup.Customer` has **two**, one per
  target: `cll_customer_account` and `cll_customer_contact`. The
  `getEntityMetadata` node carries **no `SchemaName`** at either level to
  derive one from. The answer is `ReferencingEntityNavigationPropertyName` on
  `EntityDefinitions(LogicalName='<table>')/ManyToOneRelationships` —
  a same-origin `fetch` of the organisation URL (`page.getClientUrl()` first,
  the `Xrm` global as fallback; `context.webAPI` cannot address metadata
  entities), 200 in 84 ms, one row per column per target, read once per table
  and cached. A read-back annotation,
  `_x_value@Microsoft.Dynamics.CRM.associatednavigationproperty`, names it too,
  but only for a populated cell and only for its *current* target.
- **The entity set name is the target table's, plural, from
  `getEntityMetadata(target).EntitySetName`** — `contacts`, `accounts` —
  exactly as `pcf-tag-list` reads it. Refuse rather than guess `${table}s`
  when the node has none.
- **The GUID from `lookupObjects` is braced and upper-case** and the Web API
  wants it bare; the write with the bare lower-case form persisted.

Four more things the same probe settled:

- **`null` clears.** `{ 'x@odata.bind': null }` resolved and the read-back
  was `_x_value: null`. The Web API's `DELETE …/$ref` also works (204) and is
  **not needed** — so the clear stays inside `context.webAPI` and the control
  makes no write the feature declaration does not cover. A clear on a Customer
  lookup names the navigation property of the value being cleared; clearing an
  empty cell writes nothing.
- **`updateRecord` resolves `{ id, entityType }` with no `name`**, so the
  optimistic cell's label comes from the dialog's pick, not the write.
- **A rejection is `{ errorCode, message, code, title, raw }`**, a plain
  object, and `message` comes in two shapes. A server fault puts the sentence
  first with a `title` beside it: `2147746327`, *"The requested record was
  not found."*, *"Record Is Unavailable"*. A payload fault opens with the
  generic *"Error identified in Payload provided by the user for Entity :''"*
  and buries the sentence after `InnerException :` — sometimes twice, with
  `--->` between — followed by a stack trace. Show the last segment's first
  sentence, never `raw`; `pcf-data-table`'s `faultMessage` is the reader.
- **`context.parameters.records` is a new object on every `updateView`.**
  A dataset kept from an earlier pass is a dead snapshot: its `records[id]`
  never changes, however many refreshes land. The probe's first version read
  off one and could not tell "the subgrid did not re-read" from "I am holding
  a stale object". Read the dataset off the context you were just handed. On
  that host `refresh()` after the write produced one new pass with the new
  reference on it about **a second** later — against the 3–14 s a filter
  refresh took on the same subgrid.

What it costs and where it works: `<uses-feature name="WebAPI" required="false">`
beside `Utility`, and four host surfaces — `utils.lookupObjects`,
`utils.getEntityMetadata`, `webAPI.updateRecord` and an organisation URL —
each of which a host can withhold on its own, so detect all four and withhold
the editor when any is missing. Canvas has none. `pcf-data-table` 0.5.0 is the
exemplar: `lookupHost()` in `index.ts`, `writeLookup` beside `writeCell`, and
a rig that removes the four one at a time.

### A second column beside the lane, and Owner

A board with swimlanes writes two columns in one gesture — the lane and the
row — and the row can be Owner. Measured 2026-10-10 by `pcf-kanban-board`'s
0.4.8 probe on a model-driven subgrid, then in a canvas app; 0.5.0 is the
exemplar (`write` and `bindFor` in `index.ts`, `rowPayload` in
`components/swimlanes.ts`).

**On a form, the record route:**

- **Two dataset columns stage together and save once** — a Choice and a
  boolean Yes/No, one `save()`, 584 ms, both persisted. `getValue` keeps the
  old values until the refresh, as one column does.
- **A column outside the dataset answers `isEditable` `false`, and its
  `setValue` is dropped without a word** — the `save()` still resolves and
  writes the rest. Write only what `isEditable` said `true` to.
- **Owner answers `isEditable` `true`, and it is not.** `setValue` with the
  record's own reference — `{ etn, id: { guid }, name }` — stages `null`, and
  the save is refused: `2147746307`, *"Attribute: ownerid cannot be set to
  NULL"*. `pcf-data-table` found the same for a `Lookup.Simple` ("Invalid
  snapshot", five shapes). **No lookup goes through the record**: send any
  payload carrying an `@odata.bind` key through the Web API whole.

**The Web API:**

- **`ownerid@odata.bind` reassigns**, to `/teams(<id>)` as to
  `/systemusers(<id>)`: accepted in 386 ms and read back with
  `lookuplogicalname: "team"`. Owner has **one** navigation property,
  `ownerid`, for both targets — unlike a Customer lookup's two — and the
  target's entity set comes from `EntityDefinitions(LogicalName='team')
  ?$select=EntitySetName` like any other.
- **The state pair and the bind go in one update**: `{ statecode: 0,
  statuscode: 1, "ownerid@odata.bind": "/teams(…)" }` from Inactive was
  accepted and both read back, in 1,081 ms.
- **An assignment the server refuses can carry an unfilled template.** To a
  user without read on the table: `errorCode` `2147746457`, `message`
  *"Assignee {2}(Id = {3}) is missing {0} privilege on {1} entity(OTC={4})…"*
  — the placeholders verbatim — beside a readable `title`, *"Assignee does
  not hold the required read privilege or access."* Show the `title` when the
  `message` holds `{n}`; `faultText` in `pcf-kanban-board`'s
  `swimlanes.ts` is the reader.
- **Ask Assign before offering Owner as a target** — `hasEntityPrivilege
  (table, 5, depth)`, *A privilege before the button* in `context-apis.md`.

**In canvas, neither.** `webAPI` is published and every method throws
`PCFNonImplementedError: updateRecord: Method not implemented.`; the record
has **no `isEditable`**, its `setValue` returns a WinJS promise-like and
shows the staged value at once, a **text** column writes through `save()` —
but a **choice stages `null`** in every shape tried (number, string,
`{ Value }`, label), and the save bumps `modifiedon` and writes nothing for
it. A control whose writes are choices or lookups is read-only in canvas.
