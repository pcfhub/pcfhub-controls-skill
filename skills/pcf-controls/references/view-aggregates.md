# Aggregates over a view

An aggregate over the view a dataset shows — a count, a sum, a group — read
through FetchXML the way `pcf-chart-view` measured it: the view's own
definition, a subgrid's relationship, the runtime filter, the aliases, the
buckets and the rows that come back. Lookup columns, hierarchies and a
view's rows listed by a field control are in
[lookups-and-fetchxml.md](lookups-and-fetchxml.md).

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
`retrieveMultipleRecords(entity, '?fetchXml=' + xml)`, raw, as *The Web API takes FetchXML, and in one place* in
`lookups-and-fetchxml.md` measured.

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
