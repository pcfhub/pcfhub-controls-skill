# Dataset controls: rows and cards in your own order

Letting people put records in a sequence of their own and keeping it for
everyone: rows in a table, cards in a board's lanes. Writing in general — the
record route, the Web API, a Status Reason — is in `dataset-writing.md`; the
arithmetic is `_template`'s `variants/lib/rank-order`. Split out of
`dataset-writing.md` on 12 Nov 2026.

- [Rows in your own order](#rows-in-your-own-order)
- [Cards on a board](#cards-on-a-board)

## Rows in your own order

Letting people put rows in a sequence of their own — a plan's steps, an
account's priorities — and keeping it for everyone. `pcf-data-table` 0.9.0
does it; its SPEC.md has the probe (R1–R6) and `_template`'s
`variants/lib/rank-order` the arithmetic. What it rests on, measured on a
model-driven subgrid:

- **The order lives in a whole-number column the maker names**, and the
  table sorts by it, ascending, alone. **A row with no value sorts first**
  ascending and last descending (R1), so one unnumbered row breaks the order
  above every numbered one. **A sort the control applied is forgotten on
  reload** — the first pass arrives with the view's sort — so apply it in
  `init` every time; the rows are already in the dataset there, so the sort
  rides the platform's own first fetch.
- **The column can be left out of the view.** Outside it, `getValue` answers
  `null` whatever the row holds (R2). `dataset.addColumn(name)` exists on
  model-driven and brings the value in on the next fetch — and adds the
  column to `dataset.columns` with `order: -1` and `isHidden: false`, where a
  control drawing every column draws it. Look the name up first (a
  same-origin `EntityDefinitions(...)/Attributes(LogicalName=...)`, `AttributeType`
  `Integer`): a link to a column that does not exist cleared every row
  (`pcf-data-table` 0.8.0, P11), and nobody has tried `addColumn` with one.
- **A move reuses the values the rows it passes already hold**, handed out in
  the new order: 10, 20, 30 stay 10, 20, 30, and only the rows in the span are
  written. Where that would leave a tie the new order relies on, number a
  window of the new order with consecutive values, growing it until it fits
  between its neighbours — **inside the range the page already spans**, except
  at the open ends of the list, so a move on page 2 never lands among page 3's
  rows. A middle page whose values are all taken (5, 5, 6 … 13 for ten rows)
  has no room: refuse and say so. `lib/rank-order`'s `planMove` is all of
  this, fuzzed against a re-sort.
- **`setValue` returns nothing, and the row reads its old value until `save`
  resolves** (R3). Saves took 295–458 ms each; four one after another 1,397 ms,
  four in parallel 551 ms, all accepted. **Each save repaints with its new
  value, and nothing is re-sorted until a re-read** — halfway through, two
  rows shared a value. So hold the moved order on screen yourself, from the
  drop until the re-read agrees (with a timeout), and never derive the order
  from the values while a move saves.
- **Re-read with `loadExactPage(page)`** past page 1 (`dataset.md`, paging); a
  refusal is undone by writing every touched row back, not by re-reading
  (`dataset-writing.md`, *A refused save keeps what it was refused with*).
- **`isEditable(column)` answered `true` for an inactive row, and its save
  went through** (R4). It is about privileges, not state. Ask it for every row
  on the page before drawing handles: a move the platform refuses costs a
  rollback.
- **Numbering the rows with no value** has to reach all of them at once, since
  they all sort above every numbered row — numbering some drops those below
  the rest. Loading more to reach them is out: raising the page size
  mid-session broke paging on a real subgrid (`pcf-data-table` 0.6.0), and a
  row on another page has no record to write. So number from the page only
  when every unnumbered row is on it (the first page, and the list ends there
  or a numbered row does), just under the first numbered value; tell the user
  to show more rows otherwise.
- **The keyboard**: a handle that is a real button; Space lifts, Up and Down
  move, Space drops, Escape and Tab cancel (Tab not handled, so focus still
  leaves), each step said in a live region. Reorder the rows live while
  lifted and put the focus back on the handle — React may move its button to
  do it. `lib/rank-order`'s `liftKey`.
- **The pointer**: prevent the default on the handle's `pointerdown` and focus
  it yourself — a press over cell text started a native `dragstart`, which
  cancelled the pointer — and read the drag from a ref, because the first
  move can arrive before React re-renders with the press. Draw a drop line
  rather than reordering under a captured pointer. Catch `setPointerCapture`:
  it throws for a pointer the browser does not know.
- **Another sort, a filter, grouping**: the rows are not in the order, so hide
  the handles and offer one way back — the order column's sort, the filter
  row emptied.

## Cards on a board

A board orders the cards inside each lane — each cell, with swimlanes — by a
whole-number column. `pcf-kanban-board` 0.6.0 does it; its SPEC.md has the
probe (Q1–Q9) and `lib/rank-order`'s `planInsert` and `liftGridKey` the
arithmetic. What differs from a table, measured on a model-driven subgrid:

- **Bind the column as a role, not by name.** A `property-set` of
  `Whole.None` is always in the dataset, a view column or not: off the view it
  arrives in `columns` with `order: -1`, reads as the number `10` or `null`,
  sorts on the server with empty values first, and is written through the
  record — alone, or in the same save as a Choice lane (Q1–Q4). No
  `addColumn`, no lookup first.
- **A lane is a slice of what is loaded.** A board loads more and never turns
  pages, so the loaded cards are the first of the whole order, and each lane's
  loaded cards the first of that lane. A value below the lowest loaded is
  always safe — the top is open, down to the column's own minimum; one above
  the highest loaded is safe only once nothing is left to load. So plan with
  `PageEdges.min`/`max` from **every** loaded card, not the lane's, and
  `floor`/`ceiling` from the column. A card given a value past the highest
  loaded drops out of the loaded prefix on the next fetch.
- **The range is in the attribute definition**, not in `getEntityMetadata`'s
  answer as a control reads it (Q6): a same-origin
  `EntityDefinitions(LogicalName='<table>')/Attributes(LogicalName='<column>')/Microsoft.Dynamics.CRM.IntegerAttributeMetadata?$select=MinValue,MaxValue`.
  A value past it is refused at the save — a `UciError`, `errorCode`
  2147762991, *"…outside the valid range. Minimum Value: …, Maximum value:
  …"*, through the record; *"An integer provided is outside of the allowed
  values."* through the Web API (Q7).
- **The fewest writes, not readable values.** `planInsert` writes nothing
  when the moved cards' values already fit, only them when their new
  neighbours leave room — at the top of a lane packed down against the card
  below, 9 under a 10 — and a small consecutive window otherwise. A table's
  rotation (`planMove`) keeps 10, 20, 30 readable and would write every card a
  drag passes; a board does not show its numbers.
- **One write per card**: lane, row and place together — the state pair and
  the rank in one `updateRecord` (Q5), a Choice lane and the rank in one save
  (Q4). Several cards are written a few at a time, each settling on its own.
- **No re-read after a move** — a refresh restarts a board at its first page.
  Hold the place as an override, order each lane yourself by the value in
  force (stable, empty first), and let it retire when the data agrees:
  **`loadNextPage()` re-reads every card already loaded** (Q3), so Load more is
  usually when.
- **Only while the order on screen is the order**: the sort in force is that
  column ascending, and no search narrows the board. Hide the grips and the
  drop line otherwise; a move between lanes still works and lands at the top,
  where a Move from a menu lands too.
- **The cards with no place** all sort first, so number them across the whole
  loaded board in its order (`planNumbering`), and refuse while the last
  loaded card still has none and more is left to load.
- **+ can place the new card**: a quick create parameter for a column the form
  does not show is still applied (Q9), so pass the top of the lane beside the
  lane.
- **The keyboard across lanes**: a grip that is a real button, `liftGridKey`
  — Up and Down within the lane, Left and Right to the nearest lane the card
  may go to (swapped right to left), Space drops, Escape and Tab cancel. Draw
  the card where it is carried and put the focus back on its grip each time:
  in another lane it is a new element. `aria-disabled`, not `disabled`, while
  its save runs, or focus drops to `BODY`.
- **Selecting several**: one `updateView` follows `setSelectedRecordIds`; the
  selection survives `loadNextPage()`, and a `refresh()` keeps only the
  selected rows still on its first page (Q8) — keep the board's own copy. A
  drag or a Move of one selected card carries all of them, in board order, as
  one block. The command bar is a manifest attribute read from the installed
  control (`dataset.md`, *The subgrid's own chrome*), so a shipped board that
  adds it adds it to every form; a form script can read the selection
  instead, through the subgrid's `getGrid().getSelectedRows()` (Q8).
