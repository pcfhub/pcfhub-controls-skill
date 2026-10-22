# Filtering a dataset

Filtering the view a dataset control is bound to: what the platform keeps, what
a runtime filter can say, and how it combines with the view's own.

Split out of `dataset.md` on 15 Oct 2026, so each file can be read whole.

- [Filtering](#filtering)
- [Rows related through another table: `linking`](#rows-related-through-another-table-linking)

## Filtering

```ts
ds.filtering.setFilter({
    filterOperator: 1,                                   // Or — see below
    conditions: columns.map((name) => ({
        attributeName: name,
        conditionOperator: 6,                            // Like
        value: `${escapeLike(term)}%`,
    })),
});
ds.paging.reset();                                       // not optional
ds.refresh();                                            // the fetch
```

`pcf-view-filter` (a search box) and `pcf-data-table` (a per-column filter row)
are the two controls in the house that do this; read whichever is the shape you
are building. Six things, and each is a bug somebody ships:

- **`setFilter` is not a fetch.** It records an expression and not one row moves
  until `refresh()`. A control that omits the refresh looks *exactly* like one
  whose filter matched nothing, which is what makes this the hardest of the six
  to spot.
- **Filtering does not reset the page**, and the platform will not do it for
  you. Filter from page three and the control has asked for page three of a
  result set that may have one page in it; what comes back is nothing at all,
  which reads as "no matches" for a term that has plenty.
- **`refresh()` fires `updateView`.** So apply the filter from an event handler
  — a debounce, a button — never from a render, and **guard on the expression
  last applied**, serialised. Without the guard this is an unbounded refresh
  loop, and a browser shows that as a hang rather than as a loop.
- **`filterOperator` defaults to `And` (0), and which one you want depends on
  the shape of the UI rather than on taste.** There are two shapes and they take
  opposite operators:

  | UI | Meaning | Operator |
  | --- | --- | --- |
  | One box, searched across several columns | "this term *anywhere*" | **`Or` (1)** |
  | One box per column, filled independently | "all of these at once" | **`And` (0)** |

  A *search box* that omits `Or` asks for the term present in all four columns
  at once, matches nothing, and reads as a broken query rather than as a missing
  field. A *filter row* that copies that `Or` is the mirror bug and is quieter:
  a second filled box returns **more** rows than the first, so the control looks
  like it is ignoring what was typed rather than failing.

  🔴 **A test can pass this either way if the fixture is wrong.** Assert it with
  two columns the control will actually build conditions for. Written against a
  choice or date column — which a well-built filter row deliberately skips —
  only one condition ever exists, and flipping the constant changes nothing.
  That happened in `pcf-data-table`, and only a mutation test caught it.
- **`totalResultCount` follows the filter**, so it is what a
  `filteredRecordCount` output should report — not the length of the page, which
  would report the page size on any view with more than one. It is `-1` on a
  view the platform did not count, and `-1` should travel as `-1`: "none" and
  "unknown" are different answers, and a canvas formula can tell them apart only
  if the control does not flatten them.
- **Escape the term for SQL `LIKE`.** `%`, `_` and `[` are wildcards, and the
  escape is a character class rather than a backslash — `[%]`, `[_]`, `[[]`.
  Without it, a user typing `%` matches every record in the table, which looks
  like a search box that ignored what was typed.

**The operators are not symmetric across the hosts**, and the asymmetry runs
both ways. From the DataSet reference's own table: `NotLike` (7) and `NotNull`
(13) are **canvas-only**; `Yesterday` (14), `Today` (15) and `Tomorrow` (16) are
**model-driven-only**. `Equal` (0), `NotEqual` (1), `GreaterThan` (2),
`LessThan` (3), `GreaterEqual` (4), `LessEqual` (5), `Like` (6), `In` (8) and
`Null` (12) are on both. Reaching past that set is choosing a host, and it
belongs in `docs/limitations.md` rather than in a comment.

🔴 **75–79 are not the SDK's numbers.** They are the hierarchy operators, and
the two Microsoft pages disagree about them. The SDK's `ConditionOperator` has
75 Under, 76 NotUnder, 77 UnderOrEqual, 78 Above, 79 AboveOrEqual. The PCF
DataSet reference has 75 Above, 76 Under, 77 NotUnder, 78 AboveOrEqual, 79
UnderOrEqual. **A dataset filter takes the PCF reference's.** It was measured
2026-10-17 on a subgrid (`pcf-data-table` SPEC.md 0.8.0, P2), against an
account with one child: 75 → 0 rows, 76 → the child's alone, 79 → the
account's and the child's. The platform's own query on the wire showed 79 as
`operator="eq-or-under"`. Any table that turns a dataset filter back into
FetchXML (`lib/view-aggregate`'s `CONDITION_OPERATORS`) has to use these;
the template's had all five the SDK's way until that day.

**A date range is a model-driven decision, and it was measured rather than
assumed.** `On` (25), `OnOrBefore` (26) and `OnOrAfter` (27) are not in the
both-host set, and a `GreaterThan` against a date column compares the wrong
thing. On a model-driven subgrid (2026-09-11, `pcf-data-table` 0.4.0) all three
were accepted with `value: 'yyyy-MM-dd'`, `dataset.error` stayed false, and —
the part nothing documents — **the day is compared in the user's time zone,
not UTC**: a record stamped `2026-09-01T04:30:00Z` matched `On 2026-08-31` for
a user at UTC-5, because that is 11:30 PM on the 31st where they sit. Canvas has
not been asked, so a date box is offered wherever `dataset.filtering` exists
and `docs/limitations.md` says the canvas half is unverified. The template's
dataset rig models the three by local calendar day; send the day as typed, and
send nothing for a half-typed `2026-03`.

Two more measurements from the same probe, both about the refresh rather than
the expression: a `refresh()` on that subgrid took **3–14 seconds**, and one
issued while another was in flight **appeared to be dropped rather than
queued**. So never chain refreshes — one `setFilter` → one `refresh()`,
debounced and guarded — and never read `sortedRecordIds.length` as an answer
while `dataset.loading` is true, because the loading state briefly reports
zero rows.

⚠️ **Check the rig models the operator before trusting a green test.** The
harness passes an operator it does not model — deliberately, so a modelling gap
reads as "no filtering happened" rather than "everything vanished" — which means
an unmodelled operator filters *nothing* and the assertion still passes.
`GreaterEqual` and `LessEqual` were in this list and missing from `dev/host.js`
until 2026-09 for exactly that reason.

Two more things before designing around this:

- **Only text columns can be searched with `Like`.** A `Like` against a whole
  number, a currency or a lookup is a query the server rejects, and the
  rejection names the column rather than the control. Filter `dataset.columns`
  by `dataType` before building conditions.
- **A choice column can be offered a dropdown, and only from entity
  metadata.** The server filters on the integer, and `Column` does not carry
  the option list — the entire interface is `name`, `displayName`, `dataType`,
  `alias`, `order`, `visualSizeFactor`, `isHidden`, `isPrimary`,
  `disableSorting`. Reading one means `utils.getEntityMetadata()`, which is
  model-driven only and adds a `<uses-feature name="Utility">` entry — an
  install-time prompt on every environment. `pcf-data-table` declined that
  trade for two releases while it bought one dropdown, and took it in 0.4.0
  when the same prompt also bought a choice *editor*; the arithmetic changed,
  not the principle. Send `Equal` (0) with the integer **as a string** — that
  is what `ConditionExpression.value` is typed as, and the server accepted
  `'3'` and `3` alike (2026-09-11). Where `utils` is absent — canvas, or an
  environment that declined the feature — the column stays unfilterable, and
  says so. Harvesting the options from the loaded records (`getValue()` gives
  the integer, `getFormattedValue()` the label) is the tempting alternative
  and stays rejected: it lists only the options present in the rows already
  fetched — two of seven statuses on page one, fewer under a filter — and the
  reader has no way to tell a short list from a complete one.
- **A lookup, two-options or multi-select column still gets no box.** A lookup
  filters on a GUID, and turning a typed name into one is a query
  (`pcf-lookup-search`'s whole job, and a second feature); a multi-select
  holds a list that `Equal` says nothing true about.
- **A maker-typed column list is a query boundary.** Validate each entry against
  `/^[a-z][a-z0-9_]*$/` and drop what cannot be a logical name; pass a merely
  *wrong* one through, because the server's rejection is the only thing that
  will ever name it. Same rule and same reasoning as
  [escaping a `$filter`](context-apis.md#escaping-a-filter-in-the-right-order).

**A search box cannot live in a control that rebuilds its DOM on every render**,
and that is most dataset controls including the scaffolded one. `refresh()`
causes a render, so the input the user is typing in is destroyed on the first
keystroke — and the symptom is a search box that will not accept more than one
character. Split the control: chrome built once in `init`, records rebuilt in
`render()`. The same applies to anything else stateful a user can be in the
middle of.

🔴 **The React version of that trap is a different one, and it bites later.**
Reconciliation keeps the input alive across renders, so the keystroke problem
never appears — but a dataset control almost always early-returns a "no records"
message before it builds the table:

```tsx
if (pageIds.length === 0) {                 // ← deletes the filter UI with it
    return <p>{getString('Ctl_Empty')}</p>;
}
```

If the filter inputs live in `<thead>`, that return fires at exactly the moment a
filter matches nothing and takes away the only control that could clear it. One
character too many and the component is a dead end with no route back to the
reader's own data — and it is invisible until someone types a term that matches
nothing, which no fixture does by accident.

Gate the early return on whether the reader has filtered, and put the message in
the body instead:

```tsx
const filtered = Object.values(props.filters).some((v) => v.trim() !== '');

if (pageIds.length === 0 && !filtered) { … }   // unfiltered: message only
// filtered: draw the table, header and filter row, message inside <tbody>
```

Assert it against **rendered markup**, not props: the early return is inside the
component, and `updateView` only builds an element. Two more consequences of the
same shape — a filter row belongs in the *same* `<thead>` as the headings, so it
inherits `<colgroup>` widths for free (including the leading select column); and
the boxes need local mirrored state keyed on the applied value, or a debounced
control renders each keystroke a third of a second late.

Note also what the local rigs do and do not give you. The template's dataset
`dev/host.js` applies filters for real — conditions, `Or`/`And`, `LIKE`
wildcards including `[%]` escaping — and models the request/apply split, so a
missing `refresh()` shows up as rows that did not move. `npm start` and the
hub's demo harness do not: both accept the call and render the same records, so
**a filtered view is one of the few things a control can get completely wrong
and still demo**.

## Rows related through another table: `linking`

A subgrid follows **one** relationship, and the view behind it cannot name the
form's record. "The opportunities of this account *and of every account under
it*", or "the activities of this account's contacts", have no platform route.
The dataset's own `linking` has one, and nothing in the catalogue had called
it before `pcf-data-table` 0.8.0. Its 0.7.3 probe asked eleven questions on a
subgrid (SPEC.md 0.8.0, P1–P11), and they decide the shape:

```ts
ds.linking.addLinkedEntity({ name: 'account', from: 'accountid', to: 'cll_customer', linkType: 'inner', alias: 'rel0' });
ds.filtering.setFilter({
    filterOperator: 0,
    conditions: [{ attributeName: 'accountid', conditionOperator: 79 /* eq-or-under */, value: recordId, entityAliasName: 'rel0' }],
});
ds.paging.reset();
ds.refresh();
```

- **It narrows an unrelated subgrid** (*Show related records* off): 52 → 31,
  the account's own rows exactly, `error: false` (P1). On a **related**
  subgrid it **ANDs** with the relationship, which the control cannot see
  (P8). So the maker turns the setting off, and the docs say so.
- **The condition names the link by `entityAliasName`** and sits in the root
  expression. The platform puts it on the wire as
  `<condition entityname="rel0" …/>` in the root filter.
- **79 is `eq-or-under`.** See the operator note under Filtering above: a
  dataset's 75–79 are not the SDK's (P2).
- **A sort keeps the filter and the link** (P3). Learn's DataSet page says
  "if sorting is re-configured it will reset the filter", and on a
  model-driven subgrid it did not. Paging works as usual (P4).
- **A link is for the page's life** (P5). An identical expression added again
  is kept once. A *different* one under an alias already used is **appended**
  (two entries in `getLinkedEntities()`), and the query is refused. There is
  no remove. So add each alias once, and treat a configuration changed after
  mount as "applies on reload".
- **Sibling links are honoured; a nested one is refused** (P6). `to:
  'rel0.parentaccountid'` fails, because `addLinkedEntity` has no parent
  alias. Refuse a `<link-entity>` inside another before the platform does.
- **Every refusal is the same sentence and names nothing** (P5, P6, P11):
  `dataset.error` true, *0x80041103 Query Builder Error*, `sortedRecordIds`
  empty, and **`totalResultCount` left at its old value**. Never read the
  total under an error. Name the bad column yourself: `GET
  EntityDefinitions(LogicalName='t')/Attributes(LogicalName='c')` is 200 for a
  column that exists, and 404 `0x80060888` for one that does not. A missing
  table answers 404 *Entity With Id = LogicalName='t' does not exist.*
  (measured the same day).
- **The view's rows are in the dataset at `init`** (P7). An untouched subgrid
  draws them on the first `updateView`, so a link applied later is drawn over
  the whole view first. **Link, filter and refresh in `init`**, and the
  platform folds it into the fetch it makes after `init` anyway. That is one
  fetch, with `loading: true` from the first pass. Configuration that has to
  be fetched (a web resource) cannot do that, so hide the rows until the first
  idle pass after the link. Apply on an idle pass too, because a refresh
  issued mid-fetch is dropped (measured 2026-09-11).
- **An aggregate over the same rows appends the same `<link-entity>`** inside
  `<entity>`. It equals the grid on an unrelated subgrid and not on a related
  one (32 under 31). The rows cannot tell the two apart (every loaded row
  pointed at the record both ways), so **the parent resolver of *Aggregating
  a view* has to stand aside** under a link. Check the groups' summed count
  against `totalResultCount` instead (P9).
- **A filter the control hands the platform replaces the last one whole**, so
  the related conditions go into *every* expression. While they stand,
  `clearFilter` is never called.
- `getLinkedEntities()` hands each link back with `filtering: { aliasMap: {} }`,
  `linking: {}` and `sorting: []` beside the five fields given.
- **Model-driven only**, per Learn; a canvas app has no `linking`. With no
  record (a main grid, an unsaved form) there is nothing to relate to. In both
  cases show no rows and a reason, because the whole view is a wrong answer
  that looks right.

**What the template carries:**

- `variants/lib/related-rows/fragment.ts` is a strict parser from a FetchXML
  link fragment with `{id}` to `links`, `conditionsFor(id)` and `fetchXml(id)`.
  It refuses nested and outer links, a link with no condition, `or` filters and
  columns by name, and it numbers 75–79 the dataset's way.
- The dataset rig answers all of the above from the shared `dev/linked.js`,
  including a FetchXML query's inner `<link-entity>`.
- `pcf-data-table` 0.8.0 (*Related through*) is the exemplar. Its 0.8.0
  walkthrough (W1–W9) watched every case above on a form, and measured that
  `factory.requestRender()` repaints a dataset control.
