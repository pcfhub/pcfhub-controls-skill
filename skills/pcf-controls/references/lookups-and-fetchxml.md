# Lookups, hierarchies and aggregates

Lookup columns, and the FetchXML shapes the catalogue sends: a hierarchy
read through the hierarchical operators, an aggregate over the view a dataset
shows, and a view's rows listed by a field control.

- [Lookup columns](#lookup-columns)
- [Reading a hierarchy through FetchXML](#reading-a-hierarchy-through-fetchxml)
  - [The Web API takes FetchXML, and in one place](#the-web-api-takes-fetchxml-and-in-one-place)
  - [Ask whether the relationship is hierarchical before querying](#ask-whether-the-relationship-is-hierarchical-before-querying)
  - [Two routes, one interface](#two-routes-one-interface)
  - [Load what is looked at](#load-what-is-looked-at)
  - [The record's picture](#the-records-picture)
  - [The rig](#the-rig)
- [Aggregating a view through FetchXML](#aggregating-a-view-through-fetchxml)
  - [The view already knows which records it means](#the-view-already-knows-which-records-it-means)
  - [A subgrid's relationship is not on the dataset](#a-subgrids-relationship-is-not-on-the-dataset)
  - [The runtime filter speaks in numbers](#the-runtime-filter-speaks-in-numbers)
  - [Two routes, one interface, and a caption](#two-routes-one-interface-and-a-caption)
  - [Generate the aliases; do not freeze them](#generate-the-aliases-do-not-freeze-them)
  - [Expanding a group is a filter, not a scroll](#expanding-a-group-is-a-filter-not-a-scroll)
  - [A date bucketed by the user's calendar](#a-date-bucketed-by-the-users-calendar)
  - [What the rows look like](#what-the-rows-look-like)
  - [The primary key](#the-primary-key)
- [Listing a view's rows in a field control](#listing-a-views-rows-in-a-field-control)
- [What the server refuses in FetchXML, and what it runs](#what-the-server-refuses-in-fetchxml-and-what-it-runs)

## Lookup columns

`Lookup.Simple` is model-driven only, and so is everything a control does with
one. There is no canvas story to degrade to — a canvas app cannot bind the
property at all — so say so in `docs/overview.md` and delete `docs/canvas.md`
rather than shipping a page that explains an absence.

**The value is an array in both directions.** Read from
`@types/powerapps-component-framework@1.3.18` and from what `refreshTypes`
generates for a `Lookup.Simple` property:

```ts
interface LookupProperty extends Property {
    raw: LookupValue[];             // [] when empty — never null
    getTargetEntityType(): string;
    getViewId(): string;
}

interface LookupValue { id: string; name?: string; entityType?: string; }
// IOutputs
value?: ComponentFramework.LookupValue[];
```

Three consequences, each of which looks like a bug in the control:

- **Clear by writing `[]`.** Returning `null` or `undefined` from `getOutputs`
  leaves the column at whatever it held, so a Clear button written the obvious
  way is accepted and does nothing.
- **`name` and `entityType` are optional**, so both need a fallback wherever
  they are rendered or compared.
- **Resync on `raw[0]?.id`.** The array and the object in it are new on every
  pass, so the `lastIncoming` guard a string binding writes as a string
  comparison has to compare the id instead. This is the rule already stated
  under *React (virtual) controls* in `rendering-and-hosts.md` — resync on content — and a lookup is where
  "content" stops being the value itself.

**One bound lookup per control — unless the second picker is the
feature.** A cascading lookup is that exception: the maker has to name the
parent column, and a second bound `Lookup.Simple` is how the configuration
pane asks. `pcf-lookup-search` 0.2.0 declares one, optional, and reads it only
when `type !== null` — see *Property types* in `properties.md` for the unmapped shape, and the
cascading-lookup entry in `exemplars.md` for the rest of the design. The rest of this
paragraph is about the ordinary case. Microsoft's `LookupSimpleControl` sample
declares two `Lookup.Simple` properties and can read as the pattern; it is a
demonstration of the binding. The second renders as its own column picker in the
configuration pane, which is the cost already described under *Property types* in `properties.md` —
a control that attaches to exactly one column asking the maker to pick a second.

**`getTargetEntityType()` is the only way to know what to search.** No manifest
attribute carries the target and nothing else on the property says. Call it
guarded even though it is typed — `typeof p.getTargetEntityType === 'function'` —
because the type is a claim about the type definitions and not about the host.
Fall back to `raw[0]?.entityType`, which is present whenever the column has a
value. `getViewId()` has the same caveat, and more: **on a field control it
names no view at all, set or not** (`pcf-lookup-search` 0.2.10, 2026-10-13 —
with *Inactive Contacts* patched in as the column's `DefaultViewId` and the
Client API's `getDefaultView()` answering it, the control was handed no id).
Pass it to `lookupObjects` as `defaultViewId` when it answers, but never build
on it: a control that needs a view on a field asks the maker to name one —
see [Listing a view's rows in a field control](#listing-a-views-rows-in-a-field-control).

**PCF's `lookupObjects` is narrower than the Client API's.** `LookupOptions`
carries `entityTypes` (required), `allowMultiSelect`, `defaultEntityType`,
`defaultViewId`, `searchText` and `viewIds` — and **no `filters`, no
`disableMru`**, both of which the Client API has and Microsoft's own reference
calls out as unavailable to components. So a code component cannot filter the
panel it opens; the view on the column is the only lever. A cancelled panel
resolves empty rather than rejecting, which is the same shape as "picked
nothing".

**From a dataset control the target is on the attribute's metadata node, and
where on the node depends on the lookup's kind.** A `Column` carries no
target. Measured 2026-09-11: `Attributes.get('cll_primarycontact')` — a
`Lookup.Simple` — has `Targets: ['contact']` at the top of the node and again
at `attributeDescriptor.Targets`; `Attributes.get('cll_customer')` — a
`Lookup.Customer` — has the top-level `Targets` **`undefined`** and only
`attributeDescriptor.Targets: ['account', 'contact']`. Read the top-level key
and fall through to the descriptor, and never call `lookupObjects` with
`entityTypes: []`.

The dialog itself, measured on the same day: `utils.lookupObjects({
entityTypes: ['contact'], allowMultiSelect: false })` opens; a pick resolves
`[{ id: "{8FE84297-9486-EC11-93B0-000D3A5C8441}", entityType: "contact", name:
"…" }]` — an array, the GUID **braced and upper-case**, the opposite of the
unbraced lower-case `{ etn, id: { guid }, name }` that `record.getValue` on the
same column returns — and cancel resolves `[]`, not `undefined`, and does
not reject. Normalise the GUID before comparing it with anything. Offered
both targets for a Customer lookup, the resolved `entityType` names the table
picked — which is what a dataset control then chooses the navigation property
by: see *Writing a lookup through the Web API* under *Writing from a dataset
control*, since `setValue` does not stage a lookup on the host this was
measured on.

**Neither harness can test any of this**, which puts a lookup control where
paging and sorting already are. `pcf-start` renders a plain text box for a
`Lookup.Simple` property and never turns what is typed there into a
`LookupValue[]` — `raw` stays empty however the field is filled or blurred — so
the selected state, Clear, and everything downstream of having a value cannot be
driven locally. PCFHub's demo harness builds a property bag with no methods on
it, so `getTargetEntityType()` is absent there too and the target can only come
from the preset's own value. Both observed on `pcf-lookup-search`.

**A lookup that points at its own table is a hierarchy**, and reading it is a
different job from picking a value — see *Reading a hierarchy through FetchXML*
below. The field rig now models the binding itself: `valueType: 'Lookup.Simple'`
hands the control a `raw` array, `attributes.LogicalName` from `column`, and
the two methods behind `targetMethod`, so all three states above are switches.

## Reading a hierarchy through FetchXML

A self-referential lookup — `Account.parentaccountid`, a custom table's
*Parent* — is a tree, and a control that draws a record's place in it needs
two things a plain `$filter` cannot give: **every ancestor at once**, and
**whether a node has children before it is opened**. Both exist in Dataverse,
both only in FetchXML, and both only when the relationship is flagged
hierarchical. `pcf-hierarchy-view` is the exemplar and the first control in the
catalogue to send FetchXML through `context.webAPI` at all.

### The Web API takes FetchXML, and in one place

`retrieveMultipleRecords(entity, options)` documents its `options` as "OData
system query options **or FetchXML query**", spelled `?fetchXml=<query>`
(Microsoft Learn, the PCF reference and the Client API reference agree). The
Client API page adds that an OData query "should be encoded" and a FetchXML one
"should not be" — and the PCF page says nothing about encoding. Keep the
spelling in **one function** (`queryString()` in `pcf-hierarchy-view`'s
`query/fetchXml.ts`, behind a `FETCHXML_ENCODED` constant). **Measured on the
Accounts form, 2026-09-17: the platform accepts both**, encoded and raw, and
returned the same rows for each; the control sends raw, as documented. The
rig's `retrieveMultipleRecords` accepts both too — it decodes when the text
after `=` does not start with `<`.

**A FetchXML result omits null-valued properties.** The Web API documents this
and the rig reproduces it; an OData result carries them as `null`. A control
reading `row.address1_city === null` for "blank" is right on one route and
wrong on the other — read `=== undefined || === null`, or go through a
formatter that treats both as empty.

### Ask whether the relationship is hierarchical before querying

The operators `above`, `eq-or-above`, `under`, `eq-or-under` and `not-under`
"only apply for the table relationship specifically defined as a hierarchical
relationship" — `IsHierarchical` on the self-referential `OneToManyRelationship`
(Microsoft Learn, *Query hierarchical data*). Account's `parentaccountid` ships
flagged; a custom table's parent lookup almost never is. A hierarchical operator
on an unflagged relationship is a **refused query**, and a refused query is an
error the user sees — measured: a plain object with `errorCode` and `code`
both `2147746307`, `title` "Invalid Argument", `message` "Invalid Argument.",
which says nothing about hierarchy and could not be told from a typo in the
XML. The rig refuses in that shape.

So ask first, and ask something that can fail quietly: a same-origin `fetch` of
`EntityDefinitions(LogicalName='<table>')/OneToManyRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntity,IsHierarchical`,
from `page.getClientUrl()` with the `Xrm` global as fallback (see *Writing a
lookup through the Web API* for why it is a `fetch` and not `context.webAPI`,
and *The current record's identity* for `page`). Match the row whose
`ReferencingAttribute` is the bound column and whose `ReferencingEntity` and
`ReferencedEntity` are both the table. **Any failure answers `false`** — a 403,
an offline client rejecting with a `TypeError`, no client URL at all — because
`false` means the route that works everywhere, and an error state here would
be an error about metadata the user never asked for. Cache the answer per
organisation and table for the life of the page; it does not change under a
form.

### Two routes, one interface

Hide the choice behind one source object — `loadChain()`, `loadChildren(id)` —
so the rendering never branches on it and a suite can swap routes freely. The
hub's demo runs the fallback route on its stand-in Dataverse — see *Demo
presets*.

**Hierarchical.** Ancestors in one call:

```xml
<fetch><entity name='account'>
  <attribute name='accountid'/><attribute name='name'/><attribute name='parentaccountid'/>
  <attribute name='accountid' rowaggregate='CountChildren' alias='children'/>
  <filter><condition attribute='accountid' operator='eq-or-above' value='{id}'/></filter>
</entity></fetch>
```

The condition goes on the **primary key**, not the lookup; `eq-or-above`
returns the record and every ancestor as a set with no depth to sort by, so the
chain is ordered client-side by following `_parentaccountid_value` upward with
a cycle guard — a parent missing from the set (the user may not read it) is
where the chain honestly starts. `rowaggregate='CountChildren'` puts each
row's number of direct children under the alias, **as a number**, in the same
query as the plain attributes and without `aggregate='true'` — measured, and
Microsoft Learn's example is exactly this shape; the alias also arrives with
its own `@…FormattedValue` and `@…AttributeName` annotations. It is what lets
a chevron be drawn only where there is something under it. Children of one node are the same query with
`<condition attribute='parentaccountid' operator='eq' value='{id}'/>` and an
`<order attribute='name'/>`, `maxChildren` passed as `maxPageSize`.

**Fallback.** `retrieveRecord` for the record, then its parent, then the
parent's parent — one call per level, a `Set` of ids against a loop, a ceiling
(20) against a runaway — with a parent that refuses ending the walk rather than
failing it. Children by `?$select=…&$filter=_parentaccountid_value eq {id}&$orderby=name asc`.
No counts exist on this route, so every node shows a chevron until a load
returns empty, and the count becomes known the moment a node is opened.

Both routes read formatted values from the `@OData.Community.Display.V1.FormattedValue`
annotation beside each column and fall back to the raw value.

### Load what is looked at

An ancestor knows one child — the next node down the chain — and the tree
renders exactly that, with a *show all* affordance that loads the rest. A node
expands one level per click. `initialDepth` opens the record's own children
(and, above 1, theirs, one query per node) and nothing else. `maxChildren` is
the page size of every children query, and a result with a `nextLink` or a
`fetchXmlPagingCookie` — or more rows than asked — is *truncated*, said in the
UI rather than paged. **On a FetchXML query the signal is the cookie**: measured
with `maxPageSize = 1` on a node with three children, `fetchXmlPagingCookie`
was set and `nextLink` stayed `undefined` (the key is always on the result,
set or not), so a control reading only `nextLink` never learns it was cut. A
record with hundreds of direct children is a view's job. The recursion limit on hierarchical operators is 100 (Microsoft Learn).

**And show all keeps what is on show until the rest arrives.** Forgetting the
path child the moment *show all* is pressed empties the whole branch beneath
the ancestor — the record the form is open on included — until the query
answers: the tree flickers, a chart's layout jumps, the keyboard's row is
gone, and a second press in that moment lands on a detached button
(`pcf-hierarchy-view` 0.3.3; it had been there since 0.1.0, short enough in
the tree that nobody saw it). Mark the node *showing all*, keep drawing the
path child, load, and let the loaded children replace it.

Three things the effect that loads them has to carry, each a bug first: a set
of **in-flight ids** owned by the effect, because a dispatch from inside an
effect re-runs it before the loop that dispatched has finished and the second
run would ask for the same children again; an **`alive` flag** per source key,
because the hub's demo switches presets faster than a query resolves and a
slow answer for the old key lands in the new tree; and a **check that the
source is still current** before dispatching a late result.

### The record's picture

A card that shows each record's picture reads it from the table's
**`PrimaryImageAttribute`** — never `entityimage` by name. Measured on the
account form (`pcf-hierarchy-view` 0.2.10 and its C3b, 2026-10-15):

- **It may not be `entityimage`.** On the test environment account's primary
  image was a custom Image column (`cll_photo`) while the samples' pictures
  sat in the non-primary `entityimage`. Contact's was `entityimage`; a custom
  table had none (`null`). `getEntityMetadata(table).PrimaryImageAttribute`
  and `EntityDefinitions(LogicalName='…')?$select=PrimaryImageAttribute`
  both answer it.
- **Select `<column>_url`**, on either route: OData `$select` and a FetchXML
  `<attribute>` both take it. The value is **relative** —
  `/Image/download.aspx?Entity=account&Attribute=…&Id=…&Timestamp=…` — so join
  it to `page.getClientUrl()`. OData answers `null` for a record without a
  picture; **FetchXML omits the key**.
- **A table without the column refuses the whole query**: OData 400
  `0x80060888` *Could not find a property named 'entityimage_url'*, FetchXML
  400 `0x80041103` *…doesn't contain attribute with Name = …*. No primary
  image, no select — initials only.
- **It loads as an `<img>` on the form**, with the user's session and under
  the form's CSP: the 144×144 thumbnail (`&Full=true` is the full image — not
  asked). A same-origin `fetch` of it answered 200 `image/jpeg`.
- Accept only a relative, `https:` or `data:image/` address before it reaches
  an `<img src>`; the last is for a demo fixture, which the hub's demo policy
  allows where it allows no other host. Fluent's `Avatar` with
  `image={{ src }}` and `name` draws the initials when there is no picture or
  it fails to load.

### The rig

The field rig answers all of this from `dev/fixture.js` — `tables`, a
`hierarchy` entry naming the parent column, `relationships` with a
`hierarchical` flag — and models the refusals as switches: `hierarchical:
false` (the operators are refused in the fault shape), `relationshipsStatus`
(200 lists the relationships, 403 refuses, **0 rejects with a `TypeError`**,
the offline shape), `webApiFails`, `page: false`, `openForm: 'absent'`, and
`valueType: 'Lookup.Simple'` with `targetMethod: 'present' | 'absent' |
'throws'` for the lookup's own methods. It reproduces the null-omission of a
FetchXML result and truncates on `maxPageSize` with a `nextLink`. All three
of the things it could not prove — the encoding the platform wants, the shape
of the refusal, whether `CountChildren` is a number — were the questions
`pcf-hierarchy-view`'s probe put to the form (its `SPEC.md`, P1, P4, P3), and
the rig now models the answers.

Two more things the same form said, both about the binding rather than the
query: **a bound `Lookup.Simple` is a one-row dataset underneath** — its
property bag carries `records`, `paging`, `sorting`, `filtering`, `columns`
and the rest of a dataset's surface beside `raw`, `type` and `attributes` —
and **`raw` was `[]` on the first pass** for a record whose parent is set,
while the row read back through FetchXML carried the parent. A hierarchy
control never needs `raw[0]`; a control that does should not count on it on
the first pass. `getViewId()` returned `null` there against typings that say
`string`.

## Aggregating a view through FetchXML

A chart, a count, a total — anything that wants a number over **every record
the view matches** rather than over the page the dataset holds. The page is
the wrong answer twice: a subgrid hands over one page of the form designer's
size, and a grid hands over whatever the user's *Rows per page* is, and a
chart of either is a confident number about the wrong thing. `pcf-chart-view`
is the exemplar and the first control in the catalogue to send an aggregate;
`pcf-data-table` 0.6.0 is the second, and everything in this section that is
stated as a rule rather than as chart-view's history is true of **both**, which
is this skill's bar for writing it down. `pcf-kanban-board` 0.4.0 is the third
(lane totals), and measured it all again on its own subgrid: the view read
from `savedquery`, the lane group back as the **number** `1` where the record
said `"1"`, a Money sum as the number `25` beside `"$25.00"`, and **10 without
the parent condition against 3 with it**.

**Do not write it a fourth time: adopt the template's copy.** The query
builder, the runtime-filter translation, the parent resolver, the row reader
and the two Web API reads are `_template/variants/lib/view-aggregate/`
(lifted from `pcf-data-table` 0.7.1 on 2026-09-29), synced like the rig:

```bash
mkdir <Control>/lib/view-aggregate
node ../_template/scripts/sync-rig.mjs --into . --add-missing
```

The control keeps only the glue: the `GroupSpec` it asks for, the parent
reading (`contextInfo`, its candidates from a same-origin
`ManyToOneRelationships` fetch, `rowsConfirm` over the loaded rows), the
primary key read, and what it does with the rows — `pcf-kanban-board`'s
`data/totals.ts` is about a hundred lines of it.

### The view already knows which records it means

The temptation is to compose a query: the entity from `getTargetEntityType()`,
a filter from `filtering.getFilter()`, done. That query aggregates the
**table**, not the view — an *Active Accounts* subgrid would count every
account — and a view's own filter often lives in a `<link-entity>` this
control has no business parsing.

So read the view's own definition and rewrite it. `getViewId()` names the
saved query; `retrieveRecord('savedquery', id, '?$select=fetchxml')` reads it,
and `userquery` is the same read for a personal view (try the first, fall to
the second on a rejection, cache per id for the life of the page). Then, on
the text:

1. **Remove every `<attribute>` and `<order>` at every depth** — a
   link-entity's attributes included, because an aggregate query refuses any
   attribute that is neither `groupby` nor aggregated, and `<order>` in an
   aggregate may only name aliases.
2. **Keep `<filter>` and `<link-entity>`** exactly as they are. That is the
   whole point: the view's filter, and a linked-table condition, ride along
   without the control understanding them.
3. **Put the two attributes first inside the root entity**: the group-by
   column as `groupby='true'` with an alias, and the measure as
   `aggregate='sum' | 'avg' | 'min' | 'max'` with an alias — plus
   `aggregate='count'` on the primary key under its own alias, always, so the
   caption and the tooltips have a record count whatever the measure is.
   `count` counts rows; `countcolumn` counts non-null values.
4. **Append the dataset's runtime filter** — `filtering.getFilter()` spelled
   as a `<filter>` — inside the root entity, so the chart agrees with the
   rows the user has narrowed the grid to.
5. **Replace the `<fetch>` tag with `<fetch aggregate='true'>`**; a view's
   carries `version`, `output-format`, `mapping` and `distinct`, none of
   which an aggregate wants.

A view whose root entity is not the bound table is ignored; a view whose
definition cannot be read — no id (measured `null` on a bound lookup's
dataset), a personal view the user does not own — **sends nothing**. The bare
table would be a confident wrong number; the loaded rows are an honest
smaller one, and the caption says so. Send through
`retrieveMultipleRecords(entity, '?fetchXml=' + xml)`, raw, as the hierarchy
section measured.

### A subgrid's relationship is not on the dataset

**Measured 2026-09-19 (`pcf-chart-view` P2), and it decides the shape.** Under
a contacts subgrid on the Accounts form, `filtering.getFilter()` answered
`null` and `linking.getLinkedEntities()` `[]` — and the aggregate built from
the view alone counted **31 contacts, the whole organisation**, under a
subgrid showing one account's. The platform applies the relationship itself
and keeps it there: `filtering.canDisableRelationshipFilter` sits beside
`getFilter` naming it. What *is* visible is the parent record:
`mode.contextInfo` carries `entityId` and `entityTypeName` on a form, and on
a main grid `entityTypeName` with `entityRecordName: null` and **no
`entityId`** — so `entityId` is the test for "under a record".

So a control re-deriving the view's rows under a record has to find the
lookup column itself, and `data/parent.ts` does it in order: **the maker's
input** (`parentLookup`, a logical name); else the table's
`ManyToOneRelationships` whose `ReferencedEntity` is the form's table
(the same-origin `EntityDefinitions` fetch `pcf-data-table` measured),
**when there is exactly one**; else, when there are several — a contact has
`parentcustomerid` and the read-only `accountid`, both to account — **the
one every loaded row points at the record through**, read off
`record.getValue()` for a column the dataset carries; else **withhold the
server route**, caption *loaded so far*, console naming the candidates and
the input that settles it. The condition is
`<condition attribute='<column>' operator='eq' value='<id>'/>` beside the
runtime filter. And a server answer of **no groups under a page that has
rows** is a wrong query, not an empty view — the page is always a subset —
so the loaded rows stand and the console says to check the input. The
dataset rig models the measured host as `relationshipFilter` (narrows the
rows, never in `getFilter()`) beside `contextInfo`, with two lookups to the
bound table in the fixture and one of them in the view.

**Under a dataset link the resolver stands aside.** When the control narrows
the rows itself through `linking` (*Rows related through another table* in
`dataset-filtering.md`), the aggregate appends the same `<link-entity>`
inside `<entity>` and adds no parent condition. On both kinds of subgrid,
every loaded row pointed at the form's record, so the rows cannot tell a
related subgrid from an unrelated one. On the unrelated one a parent condition
counted 31 under a grid of 32. What catches a related subgrid (which ANDs its
hidden relationship with the link) is the groups' summed count against
`totalResultCount`: a mismatch withholds the route (`pcf-data-table` SPEC.md
0.8.0, P9 and W5).

**`filtering.aliasMap` maps every role to its column** (`categoryField:
cll_pricecondition`) beside every view column — measured, and a shorter
road to a role's column than `columns.find(alias)`, though not in the
typings. And the `ManyToOneRelationships` to account from contact listed
`parentcustomerid` and `msa_managingpartnerid`, not the read-only
`accountid` — so the candidate list is the real relationships, and the
rows chose `parentcustomerid`. A subgrid the rows cannot settle — one
candidate denied, one the view does not carry — needs the maker's word:
`pcf-chart-view` takes `none` on its `parentLookup` input for "not
related, chart the whole view".

**The grid's quick-find is invisible the same way** (W6): typing in the
grid's box narrowed the rows and left `getFilter()` unchanged, so a control
that re-derives the view cannot follow it. What it can do is compare:
`paging.totalResultCount` is the grid's count after everything the host
applied, and a caption that says *All 60 records in the view · the grid
shows 12* when the two differ keeps one number from standing for the other.
And a form is not proof of a relationship: a subgrid configured without
*Show related records* lists the whole table under a record (W3), so the
loaded rows are allowed to **deny** a candidate — every candidate denied is
an unrelated subgrid and the view is the answer, with no condition.

Two more things the same form said: **a property-set column is fetched
whether or not the view selects it** — the subgrid's category column was
absent from *All Contacts*, arrived with `order: -1`, and `getValue`
answered — and a Choice's `getValue` on a dataset record was the **string**
`"1"` there. Read a Choice as a number *or* a numeric string.

**A grouped table needs this at least as badly as a chart does, and shows the
error more plainly.** A chart with a wrong total is a wrong number on its own;
a grouped subgrid puts *3,400 contacts* in a header directly above the six rows
that contradict it. Same measurement, same resolver, worse symptom — so a
control that renders both a count and the rows it counts should withhold the
whole-view route rather than guess, and say in its caption that it did.

### The runtime filter speaks in numbers

`getFilter()` returns `ConditionExpression`s whose `conditionOperator` is a
number: the PCF typings list the 36 values a dataset can carry and point at
`Microsoft.Xrm.Sdk.Query.ConditionOperator` for their names — `0` eq, `1`
ne, `6` like, `8` in, `12` null, `25` on, `27` on-or-after, `49` contains
(a `like` over `%value%`), `70`–`79` the fiscal and hierarchical ones, `87`
contain-values. Keep the map in the pure query module, translate nested
`filters` recursively with `filterOperator` 0 = `and` / 1 = `or`, and make
**any operator outside the map untranslatable** — the whole filter, not the
one condition. A condition quietly dropped is a query that answers a
different question; withholding the server route sends the control to the
loaded rows with a caption that says so.

### Two routes, one interface, and a caption

Behind one `ChartData` the component cannot tell apart: **the server route**
(one reading per group, `value` the aggregate and `count` the group's rows)
and **the browser route** (one reading per loaded record, `count: 1`) — the
same `groupReadings` / `finishGroups` pipeline over both, which is what lets
a fixture-driven suite exercise the server path's arithmetic. The routes
differ in one place: an average from the server is passed through, not
re-averaged from the group's count.

The caption is not decoration. It is the only thing that keeps a page-sized
number from reading as the whole: *All 4,120 records* on the server route,
*The 50 records loaded so far* on the browser route when `paging.hasNextPage`
or `totalResultCount` says the view has more, *The server could not
aggregate this view* on a refusal — the 50,000-record
`AggregateQueryRecordLimit` (`0x8004E023`, refusal shape unmeasured), a
column FetchXML cannot group. The rig's `aggregateLimit` and
`aggregateRefused` reach both.

**A count beside loaded rows has to say which it is.** Where the server's
count for a group is larger than the rows loaded into it, print both — "1 of
3" — or a heading reading "1" sits above a total over three records. And a
group the server counted that no loaded row falls in (the blank group, on a
paged view) still needs somewhere to show its total, or the groups stop adding
up to the caption. Both found in `pcf-kanban-board`'s preview on a paged main
grid (2026-09-29); a suite that asserts the props never renders either.

**Re-ask when the rows change.** A total asked once goes stale at the first
write. Put the loaded rows' content in the route's key (Kanban's `boardKey`),
so a write that lands, a refresh or a Load more asks again; the server holds a
write the moment it resolves, and the rig's aggregate reads committed values
for that reason.

### Generate the aliases; do not freeze them

An aggregate's answer comes back keyed by the aliases the query asked for, so
the query builder and the row reader have to agree on them. The obvious move is
a constant — chart-view has `{group: 'g', year: 'y', month: 'mo', value: 'v',
count: 'n'}` — and it works exactly as long as the control aggregates **one**
group column with **one** measure.

The moment a second of either is possible, that map is the thing in the way:
the reader stops being a lookup and becomes a switch with a case per name, and
there is no name for the second measure. A table grouping by two columns with a
sum and an average over a third has no home in it at all.

Build the plan instead, once, from the spec, and hand the same object to the
builder and the reader:

```ts
interface AliasPlan {
    groups:   { alias: string; column: string; kind: GroupKind }[];      // g0, g1, …
    count:    string;                                                    // 'n', always asked
    measures: { alias: string; column: string; aggregate: Aggregate }[]; // m0, m1, …
}
```

Positional aliases turn the reader from a switch into a loop, and two things
that were special cases stop existing: `count` is always its own alias rather
than a measure that might also be the value, and *two aggregates over the same
column* — `sum:revenue, avg:revenue` — is just two entries. Join a multi-column
group key with a NUL (`\0`) rather than `|`, because a text group can contain
anything a user typed.

**Rendering M measures is a separate problem from computing them.** `pcf-data-table`
shipped an alias plan that handled two aggregates over one column from its first
commit and a group row that picked its measure with `findIndex` — so the sum
drew and the average vanished silently, through the whole of 0.6.0's
development. Found by looking at a screenshot. If measures are placed *by
column*, two on one column collide, and the collision is invisible.

### Expanding a group is a filter, not a scroll

This is the design that lets an aggregate over the whole view coexist with a
server-paged grid without the two ever having to be reconciled.

The reconciliation problem is real and has no good answer: the group list is
whole-view and unpaged, the rows are paged, and a group's members routinely
span a page boundary — so "show me the rows of group X within page N" is a
question with no useful answer.

So do not ask it. **Expanding a group ANDs a condition onto the same
`FilterExpression` the control already builds, resets paging and refreshes.**
The members then arrive as ordinary paged rows with the pager scoped to that
group, and every existing piece of paging machinery keeps working unchanged
inside it.

Three consequences to design for rather than discover:

- **Expanding costs a round trip.** The header needs a pending state.
- **One group open at a time.** Two means ORed conditions and interleaved rows.
- **A group whose key cannot be expressed as a `ConditionOperator` gets no
  chevron**, rather than one that does nothing. A date *bucket* is the common
  case — it needs a `between` pair most filter builders do not emit — which is
  a reason to ship grouping by a date's stored value before shipping buckets.

### A date bucketed by the user's calendar

`dategrouping='month'` returns the bucket number alone — `3`, not *March
2026* — so two Marches merge unless the year is asked as a second `groupby`
(`dategrouping='year'`), and a `day` grouping needs the month as a third. The
browser route buckets the same instant by
`userSettings.getTimeZoneOffsetMinutes(date)` — the Dataverse user's zone,
which is the calendar the grid's own dates are shown in and the one the server
groups by — and the two build the **same key** (`2026-03`, `2026-Q1`,
`2026-W12`, `2026-03-14`) from either input, so the label is made once. Week
numbering follows SQL Server's `DATEPART(week)` (Sunday start, week 1 holds
1 January) on the belief that `dategrouping` does; unmeasured, and both routes
agree with each other whichever way it goes. A date category is always
chronological and never folded into *Other*.

### What the rows look like

Read leniently until the probe says otherwise: each alias as a property; a
Choice group as its integer with the label under
`<alias>@OData.Community.Display.V1.FormattedValue`; a lookup group as the
GUID with the name under the same annotation; **the blank group as a row with
no group property at all**, because a FetchXML result omits nulls; a
`sum`/`avg`/`min`/`max` over nothing but blanks omitted the same way while
the count stays. The dataset rig answers exactly this from the fixture's rows
(`answerFetchXml` in `dev/host.js`), and the first form build is the probe
that confirms or corrects it.

### The primary key

`count` is taken on the primary key, and the primary key is not always
`<table>id`: the out-of-the-box activity tables share `activityid`, and a
custom activity cannot be told from its name. Hard-code the known activities,
take `PrimaryIdAttribute` from `getEntityMetadata` when Utility answers, and
wait for that answer before sending the aggregate — one query, not one now
and one corrected.

## Listing a view's rows in a field control

A lookup shown as a dropdown — `pcf-lookup-search` 0.3.0's *Display as →
Dropdown*, the PCF Gallery request board's most-voted topic — lists a view's
rows on open rather than searching a table. It is the aggregate's idea without
the aggregate: **the view already knows which records it means**, and for
reference data that is the point — a table's lookup view filters
`statecode eq 0`, so a deactivated value leaves the list with nothing added.
Measured on contact (its `SPEC.md`, probe 0.2.9, 2026-10-13) and walked on the
form:

- **Which view.** Not the column's: `getViewId()` names nothing on a field
  (above). So, in order: a view the **maker names** in a text property (a
  GUID read through `readViewFetchXml`, anything else matched against
  `savedquery.name` with `returnedtypecode` — quote doubled, filter encoded);
  else the table's **default lookup view**, one `savedquery` read with
  `querytype eq 64 and isdefault eq true` (exactly one row on contact). A
  view the maker *named* that cannot be read is named back and the control
  falls to its other mode — never another view in its place, never the bare
  table.
- **The rewrite keeps `<order>`.** Remove every `<attribute>` and
  `<all-attributes>` at every depth (a `<link-entity>` left empty still
  runs), keep `<filter>`, `<link-entity>` and `<order>`, put back the three
  columns the list renders. Unlike the aggregate, order *is* the maker's
  intent here. The order is the server's collation — case-insensitive — so
  never re-sort client-side; a JavaScript sort disagrees on ties of case.
- **`count` is the limit plus one**, `top` and `page` removed: `count='6'`
  answered 6 rows and `morerecords: true`. One row more than the limit is
  "there are more", with no annotation to read. A parent goes in as a second
  sibling `<filter>`, as the aggregate's does.
- **Encode the query.** `retrieveMultipleRecords(table,
  '?fetchXml=' + encodeURIComponent(xml))`. `lib/view-aggregate`'s
  `queryString` sends its own generated XML raw, but a maker's view can carry
  `&amp;`, `#` or `+` inside a condition value, which raw would cut short.
  The platform accepts both forms.
- **Read once, filter locally.** On first open, not on mount — a form showing
  the field should not query a table nobody opened — and again only when the
  parent changes. Typing narrows the loaded rows in their order; nothing is
  sent per key. Key the cache on everything the query depends on (table,
  named view, parent, limit, secondary column).
- **Cap the listbox, with `!important`.** Fluent placed a 25-row list *beside*
  the field when it fitted neither above nor below; with `overflow-y: auto` it
  went below but ran to the window's bottom, because the positioning writes
  the room left as an **inline** `max-height`. `max-height: min(320px, 45vh)
  !important` on a class only the dropdown adds — a type-ahead's eight
  two-line results are not capped.

The rig answers it: `dev/host.js` honours FetchXML `count` and takes a
`viewId` option (`null` for the field case) from template 70180ec.

## What the server refuses in FetchXML, and what it runs

A control that checks FetchXML someone typed — `pcf-code-editor` 1.5.0 does —
needs to know which faults Dataverse **refuses** and which it **runs**,
because marking the second kind an error refuses a query that works. Sent
through `<entitySet>?fetchXml=…` from the Accounts form by the 1.4.9 probe
(its `SPEC.md`, P2, 2026-10-01):

| Fault | Server |
|---|---|
| An element FetchXML does not have (`<atribute>`) | **Refused**, 400 `0x8004111c` *"Invalid Child Node, valid nodes are filter, order, link-entity, attribute, all-attributes, no-attrs"* |
| An element where its parent does not take it (`<condition>` under `<entity>`) | **Refused**, the same `0x8004111c` |
| An operator it does not know (`equals`) | **Refused**, 400 `0x80041120` *"Unknown Condition Operator: equals"* |
| A column the table does not have | **Refused**, 400 `0x80041103` *"'Account' entity doesn't contain attribute with Name = 'nosuchcolumn'…"* |
| A column not valid for read | **Refused**, 400 `0x80041a08` |
| **An attribute FetchXML does not have** (`<fetch nosuch="1">`) | **Run** — 200, the row returned |

So: a grammar fault the server refuses is an **error**; an unknown attribute is
at most a **warning** (a typo like `alais` does nothing, silently, which is
worth saying); and a name checked against the environment's metadata depends on
the environment, so it is a warning too — the same query can be right in
production and wrong in a sandbox. The refusal's own list names a child the
reference pages do not — **`no-attrs`** under `<entity>` — which is one more
reason to take the grammar from the server's answers as well as from Learn.
Advanced Find and saved views write `version`, `output-format` and `mapping`
on `<fetch>`: list them as known, or every saved view carries a warning.

Two things Learn says that a control authoring FetchXML leans on (*link-entity
element*, read 2026-10-01): **`from` names a column of the linked table and
`to` a column of the table it links from** — the opposite of
QueryExpression's `LinkFromAttributeName`/`LinkToAttributeName` — and neither
is required (with neither, a system many-to-many is resolved for you). A
condition or an order on a link-entity's column names it by **`entityname`**:
the link-entity's `alias`, or its `name` when it has none.
