# Dataset controls

Reading a view: roles or the view's own columns, the subgrid's chrome, paging,
sorting, filtering and selection. Writing a record back, and fitting a table to
the host, are in `dataset-writing.md` and `layout.md`.

- [Dataset controls](#dataset-controls)
  - [Roles, or the view's own columns](#roles-or-the-views-own-columns)
  - [The subgrid's own chrome](#the-subgrids-own-chrome)
  - [Finding columns through a role](#finding-columns-through-a-role)
  - [Working with the dataset](#working-with-the-dataset)
  - [Paging](#paging)
  - [Write the pager against the platform you have](#write-the-pager-against-the-platform-you-have)
  - [Sorting](#sorting)
  - [Filtering](#filtering)
  - [Selection](#selection)
  - [Dataset controls in canvas](#dataset-controls-in-canvas)

## Dataset controls

A dataset control binds to a collection rather than a column.

```xml
<data-set name="tags" display-name-key="tags_Name">
  <property-set name="labelField" display-name-key="labelField_Name"
                of-type="SingleLine.Text" usage="bound" required="true" />
  <property-set name="colorField" display-name-key="colorField_Name"
                of-type="SingleLine.Text" usage="bound" required="false" />
</data-set>
```

### Roles, or the view's own columns

Not every dataset control wants `property-set` roles, and the choice determines
whether the rest of this section even applies.

Roles answer one question — *which column plays which part* — and they are right
when the control has parts to fill: a chip has text and a colour, a map pin has
a latitude and a longitude. They are wrong for a control that renders whatever
it is given.

A general-purpose table is the clearest case. A property-set is a **fixed-arity**
declaration; there is no way to say "however many columns the view has", so a
role-based table is capped at whatever N the manifest hard-codes and the maker
with N+1 columns is stuck. And the metadata a layout needs only exists on real
view columns — `displayName`, `order`, `visualSizeFactor`, `isPrimary`,
`isHidden` and `disableSorting` are the maker's own decisions, made in the view
designer, and they arrive on `dataset.columns` for free. A role cannot supply an
`order` for a column it does not know about.

So: **declare roles when the control assigns meaning to specific columns;
declare a bare `<data-set name="records" display-name-key="…" />` and read
`dataset.columns` when it does not.**

Two costs follow the second choice, and both are quiet:

- `::props-table{kind=dataset_column}` renders an **empty** table. Delete the
  section rather than shipping a "Dataset columns" heading over nothing, and say
  in prose that the columns are the view's. (The hub's parser is happy either
  way: `property-set` children are optional, and a `<data-set>` with none still
  produces a `kind: dataset` row.)
- The fixture rule below does not apply. With no roles there is no alias to be
  distinct from, and `alias === name` is what a real non-linked view column
  reports.

### The subgrid's own chrome

`cds-data-set-options` decides whether a model-driven subgrid keeps its command
bar, view selector and quick find. It is **an attribute of `<data-set>`, not of
`<control>`** — it configures the host's furniture, which sounds like a
control-level concern and is not. `pcf-scripts`' `ManifestSchema.json` settles
it: the key appears only under `definitions.dataSetAttribs`.

```xml
<data-set name="records" display-name-key="Records_DataSet_Name"
          cds-data-set-options="displayCommandBar:true;displayViewSelector:true;displayQuickFind:true" />
```

Absent means all three are off, so this is a decision to make rather than a
default to inherit:

- **Command bar** — turn it on if the control calls `setSelectedRecordIds()`.
  Without it, selection is a value the control reports and nothing acts on; with
  it, the ribbon buttons act on the ticked rows.
- **View selector** — only sensible if the control renders whatever columns
  arrive, since switching view changes them. A control with fixed property-set
  roles usually wants this off: its layout does not survive the user picking a
  different view.
- **Quick find** — the platform filters the result set and the control renders
  what comes back. Cheap way to get search on a control that implements no
  filtering of its own.

Two traps. The schema types the value as a **plain string**, so the option names
inside it are not validated — a misspelled `displayCommandBar` compiles clean
and silently does nothing. And the Microsoft reference table marks the attribute
`Required: Yes`, which the tooling contradicts: `dataSetAttribs.required` is
`["name", "display-name-key"]`. Optional in fact.

Model-driven only. A canvas app has no subgrid chrome and ignores it.

**It is read from the installed control, not from the form** — measured
2026-09-25 (`pcf-row-commands` P2): a control upgraded from a version without
the attribute to one with `displayCommandBar:true` showed the command bar on an
existing subgrid straight after the import, with no form published. So adding
it is a change every installation gets on upgrade, whatever its makers chose:
say so in `docs/migration.md` and lead the release notes with it. Removing it is
the same in reverse. A main grid is unaffected — it has the app's own bar.

### Finding columns through a role

When the control resolves columns by property-set role, this is the runtime
detail that catches people: **a property-set-bound column's `alias` is the
property-set role name from the manifest** (`labelField`), while its
`name` is the schema name of whichever real column the maker mapped to that
role. So find the column by `alias`, then read record values with
`getFormattedValue(column.name)`:

```ts
const labelColumn = ds.columns.find((c) => c.alias === 'labelField');
if (labelColumn) {
    record.getFormattedValue(labelColumn.name);   // name, not alias
}
```

Backwards, `find` never matches, the control renders zero rows against real
data, and nothing errors. A demo fixture will not necessarily catch it either:
a fixture that sets `name` and `alias` to the same string resolves in both
directions, so the harness looks correct while the control is broken
everywhere else. Give fixtures a realistic `name` (`cr123_tagname`) distinct
from the role `alias`, so the harness can fail the way the platform does.

That alias is also why a role cannot be a demo preset's property: it is bound
in the fixture, which every preset shares unless one names its own. An
optional role only some presets should show needs that — see *A preset can
name a fixture of its own* in `pcfhub-publish/references/hub-demo.md`.

**Canvas hands the roles over differently** (measured 2026-10-10,
`pcf-kanban-board` 0.4.8):

- **Every role arrives twice** — once by its alias with `order: -1` and no
  `isHidden`/`disableSorting`, once among the table's own columns with alias
  equal to name. A control listing `columns` (a sort menu, a column picker)
  dedupes by `name`.
- **An unset role arrives as a column with no name**: `{ name: null, alias:
  "valueField", dataType: "SingleLine.Text", order: -1 }`. A form leaves it
  out. Find a role by alias **and** a non-empty string `name`, or an unset
  optional role reads as bound — `pcf-kanban-board` 0.4.x printed a totals
  caption over nothing on every canvas board.
- **A choice's raw value is the number** (`858010003`); a form hands over the
  string `"858010003"`. Key on a value that accepts both.

On a form, the raw values a dataset record hands over, measured the same day:
a **Choice** `"858010000"` (string) with its label formatted; a **Yes/No**
`"1"` / `"0"` with its labels formatted, and **`null` when never set** — a
third state, not *No*; **Owner** `{ etn: "systemuser" | "team", id: { guid },
name }` with the GUID bare and lower-case, formatted as the name. A column
outside the dataset: `getFormattedValue` answers `null` on a form, and in
canvas a date answered as epoch milliseconds (`"1790708505000"`).

### Working with the dataset

```ts
const ds = context.parameters.records;
ds.sortedRecordIds.forEach(id => {
    const record = ds.records[id];
    record.getFormattedValue(column.name);
    record.getValue(column.name);
});
ds.openDatasetItem(record.getNamedReference());
ds.refresh();
ds.getTargetEntityType();
ds.getTitle();
```

**An empty column formats as `null`, not `''`.** Measured on a model-driven main
grid 2026-09-25 (`pcf-row-commands`): a nameless account handed the control
`null`, and a placeholder written as `value === ''` drew a blank cell and named
the row "Open null" in every button's `aria-label` — for three weeks, because
the dataset rig answered `''` and the check passed there. Read it as
`typeof value === 'string' && value.trim() !== ''`, or through `?? ''` before any
`.replace('{0}', …)`. The rig answers `null` for an empty column now. Measured on a
text column; a number, choice or lookup left empty is modelled the same way.

Check `ds.loading` before rendering; the first `updateView` usually arrives with
an empty dataset still loading. Keep the previously rendered rows and dim them
rather than swapping in a spinner, or every sort and page turn flashes empty.

Every member in the three subsections below is present in
`@types/powerapps-component-framework@1.3.18`, verified by reading the installed
`componentframework.d.ts` rather than the documentation. What is **not** verified
is the runtime behaviour of two of them, flagged where it matters.

**The rule all three share: a dataset has mutators, and `updateView` fires on
every dataset change including the ones you caused.** For a field control that
is a jumping caret. Here it is an infinite loop. Never call a mutator
unconditionally from `updateView` — either guard it on a control-instance field,
or call it only from an event handler.

Two consequences that only appear once a control does slightly more than the
template's:

**A second guarded mutator has to skip its own first run.** The guard pattern is
`if (wanted !== this.applied) { this.applied = wanted; mutate(); ds.refresh(); }`,
and with one mutator that is complete. Add a second — a paging mode, a filter,
anything ending in `refresh()` — and on the very first `updateView` every
`applied` field still holds its initial value, so every guard fires at once and
each one refreshes: one load, several round trips. Initialise the field to a
value no real answer can equal (`''`, `-1`) rather than to the property's
default, so "nobody has asked yet" is distinguishable from "the answer changed",
and return early on the first pass.

**Rebuilding the container throws away focus, and the chrome is where that
hurts.** Dataset controls generally re-render wholesale — `container.innerHTML =
''` — which contradicts the usual "build DOM in `init`, mutate in `updateView`"
rule and is defensible, because the record set genuinely changes wholesale. The
records are not the problem. The **buttons around them** are: clicking Next
destroys the Next button mid-interaction, focus falls back to `<body>`, and
turning a second page by keyboard means tabbing in from the top of the form
again. Note the intent before the mutator and restore it after the render:

```ts
next.addEventListener('click', () => { this.restoreFocus = 'next'; ds.paging.loadNextPage(true); });

// at the end of render(), consumed once
if (this.restoreFocus) {
    const wanted = this.restoreFocus;
    this.restoreFocus = null;
    // a disabled button cannot take focus — fall back to its partner on the last page
    const button = this.container.querySelector<HTMLButtonElement>(`.c-${wanted}`);
    (button?.disabled ? other : button)?.focus();
}
```

The template's dataset variant does this for its pager. Any control with a
persistent action in its chrome — a load-more button, a filter, a refresh —
needs the same, and nothing will fail to tell you it is missing.

### Paging

```ts
totalResultCount: number;  firstPageNumber: number;  lastPageNumber: number;
pageSize: number;  hasNextPage: boolean;  hasPreviousPage: boolean;
loadNextPage(loadOnlyNewPage?: boolean): void;
loadPreviousPage(loadOnlyNewPage?: boolean): void;
reset(): void;  setPageSize(pageSize: number): void;  loadExactPage(pageNumber: number): void;
```

- **`setPageSize()` does nothing until the next fetch**, so it has to be followed
  by `refresh()` — and `refresh()` fires `updateView`. Guard on a
  control-instance field, **not** on `ds.paging.pageSize`: the platform's own
  value does not equal the requested one until the refresh lands, so comparing
  against it re-fires at least once more, and if the platform clamps the request
  it never converges at all.

  ```ts
  if (wanted !== this.appliedPageSize) {
      const previous = this.appliedPageSize;   // 0 until a size has been applied

      this.appliedPageSize = wanted;
      ds.paging.setPageSize(wanted);

      if (previous > 0) {         // a *change*, not the first application
          this.page = 1;          // see below — the one people leave out
          ds.paging.reset();
      }

      ds.refresh();
  }
  ```

- **Any change to the *shape* of the result set resets the page** — a sort, a
  filter and a page size alike. `this.page = 1` and `ds.paging.reset()`, then
  refresh. Sorting and filtering are the two everybody remembers; **the page
  size is the one that gets left out**, and it is left out because it is nearly
  unfalsifiable while the size comes only from a manifest property. A property
  changes once, at configuration time, almost always while the reader is on page
  one. It becomes reachable the moment the control offers a rows-per-page
  picker — and then changing the size on page 3 asks for page 3 of a result set
  that has just been recut, which the platform answers with nothing at all.

  `_template`'s two dataset variants both shipped without it, so every control
  scaffolded before 2026-09 had the same gap. Fixed there and in seven controls
  on 2026-09-08; worth checking in anything older.

- ⚠️ **Reset on a change, not on the first application** — and this is the
  correction to the entry above rather than a refinement of it. `reset()` is a
  fetch in its own right, so `reset()` then `refresh()` is two, and at mount the
  platform is already on page one: resetting there buys a round trip for
  nothing, on every install, forever. The first sweep of this fix across seven
  repositories did exactly that, and it quietly undid a win those repos had
  already banked — taking `default-value` off `pageSize` was worth having partly
  because a mount then cost one pass rather than two.

  `previous > 0` is the whole distinction. Note that it cannot be inferred from
  `wanted !== this.applied`, which is true of the first application as well.

- 🔴 **And do not give that property a `default-value`.** A `default-value` on
  an *optional* property is not a default, it is an **override**: the platform
  hands the value down whether or not the maker ever touched the property, so
  there is no unset state left for anyone to express. `paging.pageSize` is the
  size the host is already retrieving with — a main grid's *Rows per page*
  personalisation, a subgrid's form-designer setting, the canvas default — and a
  control declaring `default-value="25"` replaces all three on every install,
  for a maker who never opened the property.

  `pcf-row-commands` shipped exactly that and needed two releases to take it
  back out; the same default was then found in `_template` and seven shipped
  controls, none of whose suites could see it. **If the platform already has an
  answer, read it, and give the property no default:**

  ```ts
  const raw = context.parameters.pageSize.raw;

  if (raw === null || raw === undefined) {
      // Adopt, and never call setPageSize. `0` is "the host did not say",
      // NOT "one row per page" — a fallback of 1 is a page size the platform
      // never has, and a page slice would honour it.
      this.appliedPageSize = ds.paging.pageSize > 0 ? ds.paging.pageSize : 0;
      return;
  }
  ```

  Two consequences worth having. The mount costs **one** `updateView` pass
  rather than two, because the first no longer ends in a `refresh()` the control
  asked for itself. And only the types carrying a null can express the
  distinction at all — `Whole.None` is `number | null`, which is exactly what a
  `TwoOptions` is not, the same gap that forces boolean inputs to be named
  around the problem.

  **The rig has to be able to see it, or nothing will.** Keep the host's page
  size and the control's `pageSize` *input* as two separate options in
  `dev/host.js`; seeding the input from the host's value makes every bind look
  like a maker who deliberately typed in what the host was already doing, and
  the unset case — which is what a fresh install is — becomes unreachable from
  any test in the repository.

- **`loadNextPage()` bare is infinite scroll, not paging.** The type comment says
  it verbatim: it "Returns results for the whole page range", with
  `loadOnlyNewPage` documented as limiting the return to the newly loaded page.
  Called with no argument, `sortedRecordIds` accumulates pages 1..N and the table
  grows instead of turning. Pass `loadNextPage(true)`.

  🔴 **And expect it to be ignored anyway.** Observed on a real model-driven
  form, 2026-08-21: `loadNextPage(true)` from page 1 of a 6-record view at page
  size 3 returned all six ids, and page 2 rendered under page 1. The argument is
  documented, typed, passed — and disregarded. Do not write a pager that assumes
  otherwise; see the three-part failure below, because it does not arrive alone.

  **That is a trap for a table and a feature for a list.** "Load more" is the
  right interaction for a stacked list on a phone — the record you were reading
  stays where it was — and bare `loadNextPage()` implements it with no
  accumulator of your own, which matters because a local copy of the records is
  a second source of truth that any sort or refresh silently invalidates. So
  choose the argument deliberately rather than always passing `true`:

  ```ts
  mode === 'loadMore' ? ds.paging.loadNextPage() : ds.paging.loadNextPage(true);
  ```

  `pcf-compact-list` offers both behind an `Enum` input. Two things it had to
  add for the append mode, both of which any accumulating control needs:
  `paging.reset()` when the mode changes (appending page four onto a list
  showing only page three is not a state worth reasoning about), and the same on
  a page-size change, since `setPageSize()` + `refresh()` discards everything
  accumulated. ⚠️ Still unverified at runtime — neither `pcf-start` nor the hub's
  demo harness reports a second page, so no harness can exercise the append at
  all. Say so rather than implying it was tested.
- **`totalResultCount` is `-1`** when the platform did not count, which is common
  on large views. Render "Page 3" rather than "51–75 of -1". A pager printing
  "of -1" is the tell that nobody checked.
- **`loadExactPage`** is in the types, but guard it with
  `typeof ds.paging.loadExactPage === 'function'`. Hide a jump-to-page control
  when it is missing — and prefer it over `loadNextPage` for an ordinary pager
  too, for the reason below.
- **Do not slice `sortedRecordIds` to the page size — except as the documented
  repair below.** The rule exists because on a platform that honours
  `loadOnlyNewPage` that array already *is* the current page, so slicing hides
  records the platform paged for, and a demo that serves every row on one page
  — the hub's did until 2026-09-27 — actively tempts you into it. The
  exception is narrow and must be guarded; see below.
- 🔴 **`firstPageNumber` tracks neither reliably.** Previously flagged here as an
  inference from the naming. It is worse than that: on the form above it
  reported 2 while `sortedRecordIds` held both pages, so a control combining a
  start from the platform with a row count from the array printed **"4–9 of 6"**
  — a range past its own total. Do not read it. The local counter is not a
  fallback, it is the source.

### Write the pager against the platform you have

The three faults above share one cause and arrive together, so treat them as one
pattern rather than three bugs. Found in `pcf-compact-list` from a user's
screenshot; `pcf-data-table` and the template's dataset variant had the identical
code and were corrected at the same time.

1. **The page number is the control's own counter.** Never `firstPageNumber`.
2. **`hasPreviousPage` does not gate Previous** — `this.page > 1` does.
   `hasPreviousPage` stays false after paging forward, because the platform
   treats the load as the *range* pages 1..N and a range starting at page 1
   truthfully has nothing before it. Trusting it leaves Previous permanently
   disabled with no way back. `hasNextPage` **is** still the gate for Next: it
   has behaved, and a local counter cannot answer "is there more".
3. **Prefer `loadExactPage(n)`**, feature-detected with `typeof … === 'function'`
   even though it is typed as required — a required member is a claim about the
   type definitions, not about the host, which is the whole lesson here. Fall
   back to `loadNextPage(true)` / `loadPreviousPage(true)`.
4. **Slice the accumulated array back to the page**, guarded so the repair
   removes itself:

   ```ts
   private currentPage(ids: string[]): string[] {
       if (ids.length <= this.appliedPageSize) return ids;   // host behaved; nothing to cut
       const start = (this.page - 1) * this.appliedPageSize;
       const slice = ids.slice(start, start + this.appliedPageSize);
       return slice.length > 0 ? slice : ids.slice(-this.appliedPageSize);
   }
   ```

   By page offset, not by tail, so it is correct going backwards too. Never
   return empty: a wrong page is recoverable by clicking, an empty one looks
   like data loss.

A control that *wants* the accumulation — a "load more" list — skips step 4
entirely and is the one shape this platform behaviour does not break.

**Neither harness can test any of this.** `pcf-start` and the hub's demo harness
both report a single page. What worked was compiling the control with `tsc` to
CommonJS and driving it under jsdom against a fake dataset that reproduces the
misbehaviour — accumulating ids, `hasPreviousPage` pinned false,
`firstPageNumber` reporting the loaded page count. Run the driver against the
pre-fix code first: if it does not reproduce the bug, it is not testing the bug.
Then run it against a dataset that *honours* the flag, or you have written a
control that requires a broken host.

### Sorting

```ts
// SortDirection is the numeric union -1 | 0 | 1 (None | Ascending | Descending).
// A type, not an importable enum object — there is no SortDirection.Ascending.
const current = ds.sorting.find((s) => s.name === column.name);

ds.sorting.length = 0;                                   // replace, do not append
ds.sorting.push({ name: column.name, sortDirection: current?.sortDirection === 0 ? 1 : 0 });
ds.paging.reset();
ds.refresh();
```

- **`dataset.sorting` is a plain array you mutate**, not a setter. Mutate in
  place, then `refresh()` — the one route that works on both hosts. **Assigning
  `ds.sorting = [...]` is ignored on a form and applied in canvas**: measured
  2026-10-10 (`pcf-kanban-board` 0.4.8), on a subgrid the assignment threw
  nothing and the next pass held the old array, order unchanged; in a canvas
  app the same assignment re-sorted.
- **Only a column the dataset carries sorts on a form.** A sort on
  `createdon`, in neither the view nor a role, came back in the view's own
  order both ways — no error, and `dataset.sorting` went on naming it. In
  canvas it sorted. A role column outside the view (`order: -1`) sorts on
  both. So a sort menu offers `dataset.columns` and nothing else.
- **A choice sorts by its label on a form and by its value in canvas** —
  descending gave Todo, On Hold… on the subgrid and Cancelled (858010005),
  Done (858010004)… in the canvas app. The host's order, not the control's;
  nothing to correct, but nothing to assert across hosts either.
- **`loadNextPage()` after a sort continues in that order**, and the refresh
  that applies a sort drops the pages Load more had brought in.
- **Replace, don't append.** The array is the whole `ORDER BY`; appending gives a
  three-deep sort after three clicks. Multi-column sort is a deliberate feature,
  not a default.
- **Sorting is server-side, across every page.** This is the entire reason not to
  sort client-side: sorting the current page reorders 25 rows out of 240, which
  is a wrong answer that looks completely right.
- **Reset paging** — a new order makes "page 4" meaningless. ⚠️ Unverified:
  `reset()`'s own comment says it reloads from the server, so `reset()` +
  `refresh()` may cost two round trips. Watch the network tab.
- **Honour `column.disableSorting`**: no sort button, no `aria-sort`, plain `<th>`.

### Filtering

Moved to [dataset-filtering.md](dataset-filtering.md) on 15 Oct 2026, so each
file can be read whole:

- **Filtering**

### Selection

```ts
ds.setSelectedRecordIds(ids);
ds.getSelectedRecordIds();
ds.clearSelectedRecordIds();
```

`setSelectedRecordIds` is not bookkeeping. On a model-driven subgrid it is how
the control tells the form's **command bar** which records the ribbon buttons act
on — **measured 2026-09-25** (`pcf-row-commands` P3): three ids set from the
console, and the command bar's Assign acted on exactly those three. So call it
on every selection change even when the control also tracks its own copy.

**The platform kept the selection through a refresh.** The Assign refreshed the
subgrid, and the `updateView` that followed still answered all three from
`getSelectedRecordIds()`. A page turn with a selection is still unmeasured. Keep your
own copy anyway — the ribbon can change the rows behind it (a ribbon Delete
removes them, and the control hears of it only as their absence) — and let the
rig's `quirks.selectionDropsOnFetch` (off by default) stand for the page
turn.

Decide and document one policy for whether selection survives paging, and know
what each costs. `pcf-data-table` persists it across pages: the ids are stable,
and a user who ticks three rows and pages forward has not changed their mind.
`pcf-row-commands` 0.2.0 keeps it to **the page on screen** — a page turn, a
sort or a page size clears it, and every render intersects it with the rows
drawn — because its selection feeds a **delete**: a confirmation reading "12
records" should be about twelve rows the user can see, and a cross-page
selection cannot tell a row on another page from a row a ribbon Delete removed.
A header checkbox means the page either way.

### Dataset controls in canvas

⚠️ Reasoned from the type definitions, not yet observed on a real canvas app.

A canvas app has no view, so `dataset.columns` reflects the Fields flyout on
`Items` rather than a view's layout. Three consequences: `visualSizeFactor` is
absent so there are no widths to honour; picking no fields is a real state that
needs its own message rather than an empty `<table>`; and `openDatasetItem` is
generally a no-op, since there is no form to navigate to — surface an output
property so the app can do its own `Navigate()`. `addColumn` is typed
**optional** (`addColumn?:`), so feature-detect before calling it.
