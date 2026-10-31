# Lookups and hierarchies

Lookup columns, and the FetchXML shapes the catalogue sends: a hierarchy
read through the hierarchical operators, and a view's rows listed by a field
control. An aggregate over the view a dataset shows is in
[view-aggregates.md](view-aggregates.md).

- [Lookup columns](#lookup-columns)
- [Reading a hierarchy through FetchXML](#reading-a-hierarchy-through-fetchxml)
  - [The Web API takes FetchXML, and in one place](#the-web-api-takes-fetchxml-and-in-one-place)
  - [Ask whether the relationship is hierarchical before querying](#ask-whether-the-relationship-is-hierarchical-before-querying)
  - [Two routes, one interface](#two-routes-one-interface)
  - [Load what is looked at](#load-what-is-looked-at)
  - [The record's picture](#the-records-picture)
  - [The rig](#the-rig)
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

## Listing a view's rows in a field control

A lookup shown as a dropdown — `pcf-lookup-search` 0.3.0's *Display as →
Dropdown*, the PCF Gallery request board's most-voted topic — lists a view's
rows on open rather than searching a table. It is the aggregate's idea without
the aggregate (*The view already knows which records it means* in
`view-aggregates.md`): **the view already knows which records it means**, and for
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
