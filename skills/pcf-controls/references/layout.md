# Layout: fitting the host, and a width you measured

The height, width and column problems a control meets on a real form — a main
grid that never gives a height, a table wider than its container, pinned and
resized columns — and the narrow layout every control needs, measured rather
than queried. Any shape, not only a dataset control: the rules were found on
tables and charts and hold for a board or a field.

- [Fitting the host: height, width and columns](#fitting-the-host-height-width-and-columns)
  - [The height a main grid never gives you](#the-height-a-main-grid-never-gives-you)
  - [Scrolling wider than the container](#scrolling-wider-than-the-container)
  - [A drawing wider than a field's column](#a-drawing-wider-than-a-fields-column)
  - [Pinning a column while the rest scrolls](#pinning-a-column-while-the-rest-scrolls)
  - [Resizing a column](#resizing-a-column)
  - [A width measured from your own box is a loop](#a-width-measured-from-your-own-box-is-a-loop)
- [Narrow widths](#narrow-widths)
  - [A viewport-relative cap has a lower end, and something will find it](#a-viewport-relative-cap-has-a-lower-end-and-something-will-find-it)
  - [A narrow layout is measured, not queried — and never contained](#a-narrow-layout-is-measured-not-queried--and-never-contained)

## Fitting the host: height, width and columns

The four layout problems a dataset control meets on a real form, each measured
there rather than in a harness.

### The height a main grid never gives you

**`allocatedHeight` is always `-1` on a model-driven table main grid and on a
related-records grid.** Not "until laid out" — always, by design. The framework
docs say so and say what to do instead:

> When code components are added to a model-driven table main grid or related
> records grid, `allocatedHeight` will always return -1. The code component must
> use a CSS style to fill 100% of the available space. When on subgrids, a height
> must be provided by the maker configuring the code component.

So the two axes are not symmetrical, on the same host, for the same control,
after the same `trackContainerResize(true)`: **the width is measured and the
height is not.** Nothing in the type definitions distinguishes them — both are
`number` — which is what makes this worth writing down rather than discovering.

The consequence for a control that has to scroll its content vertically:

```css
/* Safe on every host. Against a parent with a definite height — a main grid —
   this fills it. Against an auto-height parent, such as a form section sizing
   itself around its contents, a percentage height computes to `auto` and
   nothing changes. */
.MyControl { height: 100%; min-height: 0; overflow: hidden; }
```

**Do not gate the scroll layout on having been given a height.** `pcf-row-commands`
did, and the result is a bug that looks like nothing: on a main grid the
measurement never arrives, the rules never apply, and the rows run off the bottom
of the page taking the pager with them — which is indistinguishable from an old
build still being installed, and was mistaken for one. Apply the layout always
and let a measured height, where a subgrid supplies one, override it inline.

`-1` and `0` are still both "no answer" wherever you *do* read the number; see
`pcf-sparkline`, which set the rule for the height half.

**Reach the state before shipping into it.** The dataset rig has
`quirks.heightUnmeasured`, which pins `allocatedHeight` at `-1` however the host
is sized and however politely the control asks — the asymmetry above, as a
switch, with a harness checkbox beside it. Setting `height: -1` by hand happens
to produce the same numbers and names nothing, which is why nobody wrote the
case for a year: a suite that can only build a state by coincidence is a suite
nobody builds it in.

### Scrolling wider than the container

A control whose content is wider than the space it is given — a board with more
lanes than fit, a table with more columns — needs `overflow-x: auto` on the
scrolling element **and a definite width for it to scroll inside**. Whether it
has one depends on the host, and half the time it does not.

Measured in a browser, four 280px lanes inside a 700px viewport, varying only
the element between the host and the control:

| Parent | `overflow-x: auto` alone |
| --- | --- |
| block, flex row, grid | scrolls |
| `fit-content`, `inline-block`, `table` | **clipped, no scrollbar** |

The three that fail are shrink-to-fit: they take their width *from* their
content. So `width: 100%` and `max-width: 100%` on the control resolve against a
number the control itself produced — a circle that constrains nothing. The
content extends, an ancestor clips it, and no scrollbar appears. It reads as a
broken control rather than as a layout that was never constrained.

**Nothing written inside the control can break that circle**, and CSS is where
everyone tries first. Two things that look like the fix and are not:

- `min-width: 0` on the scrolling element. This is the real flex trap — a flex
  item defaults to `min-width: auto`, a content-based minimum — but it applies
  only along the **main axis**. In a `flex-direction: column` control, the
  scrolling row is on the cross axis and `min-width` already behaves. Worth
  setting anyway for a host that lays the control out as a *row* item; just do
  not expect it to be the fix.
- `max-width: 100%`. This is the circular one.

The way out is a number from outside the circle:

```ts
public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
    // Without this call the platform does not provide allocatedWidth at all.
    if (typeof context.mode.trackContainerResize === 'function') {
        context.mode.trackContainerResize(true);
    }
}

// then, in updateView — -1 means no limit, 0 means not laid out yet:
const ceiling = context.mode.allocatedWidth > 0 ? context.mode.allocatedWidth : null;
```

Apply it as a pixel `max-width` on the control's root. With that, all six parent
shapes above scroll.

Two more things worth doing once it scrolls. A `div` with `overflow` is **not
keyboard focusable**, so give the scrolling element `tabIndex={0}` and a
`role` — without a role its `aria-label` exposes no name at all. And note that
`trackContainerResize` is documented for canvas apps; it is needed in
model-driven too, because a form section can hand a control a shrink-to-fit
parent just as easily.

`pcf-kanban-board` records the measurements in its `SPEC.md`, including the two
CSS fixes that shipped before anyone measured anything.

### A drawing wider than a field's column

**On a field control, `allocatedWidth` is the field's whole cell — label
included.** Measured on the account form with `pcf-hierarchy-view`'s 0.2.9
probe (2026-10-15), the field in a two-column section with its label beside
it: `allocatedWidth` 723.5, the control's own column **540**. A root held to
`allocatedWidth`, as the section above does for a dataset, overflows the
column by the label's width. The rule above is the dataset's (a subgrid's cell
has no label); a field needs the other way out of the circle.

**Take the wide thing out of the flow.** A `position: relative; width: 100%;
overflow-x: auto` scroller holding a canvas placed `position: absolute` —
nothing in the scroller's flow — took the control's column exactly (538px),
scrolled a 2,400px canvas inside it, read no `allocatedWidth` at all, and
followed the window both ways (538 → 289 → 538 as it narrowed and widened).
The same 2,400px canvas **in** the flow widened the control to 2,420px in that
540px column. Two more things the probe answered:

- **`allocatedWidth` arrives late.** The first pass had `-1`, the real
  number came about 3 s later. Anything sized from it draws at the wrong
  width first; the out-of-flow scroller never asks.
- **Set the scroller's height yourself.** An absolute canvas gives the
  scroller none: height = the drawing + its padding + room for anything that
  hangs below the last row (a chevron on a card's lower edge ran into the
  scrollbar in the first build) + about 18px when it overflows, for the
  scrollbar inside the box.

**Bring a part of it into view with `scrollLeft`, never `scrollIntoView`.**
Setting the scroller's `scrollLeft` moved the form's own scroll by nothing,
measured with the form scrolled to 0 and to 40 (C2); `scrollIntoView` scrolls
every scrolling ancestor, the form's included. Keep `scrollIntoView` — with
`block: 'nearest'` — for following the keyboard, where the person asked to
move. And **centre until the person moves**: the first draw on a form is often
the narrow part (`pcf-hierarchy-view`'s chain alone), the wide part arriving a
moment later, and centring once on the first draw left the record 79px
off-centre in the walkthrough. Re-centre on every layout change until the
person scrolls, clicks or presses a key in the control — a scroll you did not
set is theirs — and never after.

A narrow fallback is measured off the control's own box (*A narrow layout is
measured, not queried*, below): `allocatedWidth < 480` would never trip for a
field whose column is 289px inside a 470px cell.

### Pinning a column while the rest scrolls

Once a table scrolls sideways, the column that *names* the row scrolls away with
it, and the reader is looking at values belonging to nothing. `position: sticky`
on the cells is the answer, and four things about it are not obvious. Each was a
visible defect in `pcf-data-table` 0.3.0 before it was designed for.

**`border-collapse: collapse` and `position: sticky` do not work together.**
Collapsed borders belong to the *table*, not to the cells — that is what the
value means — so a sticky cell scrolls over its neighbours carrying no borders
of its own. The pinned column loses its horizontal rules while the table is
scrolled and gains them back when it is not, which reads as a rendering fault.
Move to `border-collapse: separate` **with `border-spacing: 0`**; the initial
spacing is 2px and will otherwise open a gap between every cell in the table.
Safe wherever cells set only one edge (a `border-bottom` rule and nothing else),
because there are no adjacent borders left to double up.

**A sticky offset has to be pixels, and a `<colgroup>` is usually percentages.**
`inset-inline-start` resolves against the containing block — the table — not
against the columns to the left of the cell, so percentage widths cannot express
"start where the previous pinned column ended". A pinned column therefore has to
leave the proportional pool and take a fixed px width, and the columns that
still divide a proportion must divide **what is left**. Bare percentages there
ask for the pinned pixels twice and the layout drifts wider on every render that
changes the pinned set.

**Do not write "what is left" as `calc()` on a `<col>`.**
`calc((100% - <pinned total>px) * <share>)` is what this section used to
recommend, and a browser ignores it: measured in `pcf-data-table`'s preview
2026-09-27 at a 1,368px box, pinned 1 + 1, every loose column drew at 171.33px —
an equal share, whatever the view said — from 0.3.0 until 0.7.0. Every assertion
passed, because the markup was exactly what was intended; only a measured width
could show it. Once anything is pinned, lay **every** column out in pixels
yourself, from a known width: the loose columns take their shares of
`width − pinned total − select column`, and the table's own width is set to the
sum. The width to lay out in is `allocatedWidth`, lowered by a measurement and
never raised by one — read [A width measured from your own box is a
loop](#a-width-measured-from-your-own-box-is-a-loop) before measuring anything.
Keep the percentage `<colgroup>` for a table with nothing pinned (a browser
honours plain percentages, and it is what an upgraded control drew) and for a
host that reported no width.

For a Dataverse view the px number is already to hand: `visualSizeFactor` is
stored in `layoutxml` as a **pixel width**, so reading it as pixels for a pinned
column and as a ratio for the rest is right in both places. Canvas reports `0`
for every factor, so fall back to a per-column budget there.

**A sticky cell needs an opaque background, and it has to track the row's
state.** Table cells are transparent, so without one the pinned column renders
its neighbours' scrolling text straight through itself. But hover and selection
are almost always `tr`-level rules, and the cell's own ground paints over them —
so the pinned column stays white down a highlighted row and the row appears to
break in half at the seam. Every `tbody tr:hover` and `tr.is-selected` rule needs
a `td.is-pinned` counterpart, in the same order, since `:hover` and a class carry
equal specificity.

**Pinning has to switch itself off where it cannot be afforded.** A 320px phone
subgrid with a 200px column pinned beside a 40px select column leaves 80px of
moving table — worse than not pinning, and only visible on a phone. Clamp
against `mode.allocatedWidth`, which is the half of the pair a main grid actually
reports (see the asymmetry above: the height stays `-1` forever). Treat `-1` and
`0` as "the host did not measure" and pin as asked — reading them as "no room"
unpins the control everywhere, including on `npm start`.

Two smaller ones. Draw the seam at the end of a pinned run with a pseudo-element
rather than a border: under `border-spacing: 0` a border takes part in layout, so
adding one widens the pinned column and shifts every offset after it. And if the
table has a leading select or command column, **it must be pinned too whenever
anything at the start is** — left loose, it slides underneath the column pinned
beside it.

`pcf-data-table` carries the implementation as two pure modules, deliberately
out of the render so they can be asserted without React: `pinPlan()` in
`components/resolve.ts` decides which columns pin and whether pinning switches
off, and `sizeColumns()` in `layout/widths.ts` (0.7.0) lays them out in pixels.
`dev/smoke.js` asserts the cell counts exactly — a pinned *header* over unpinned
*cells* is one missing class that looks like two bugs — and `dev/widths.js`
asserts the pixels against widths measured in a browser.

**On a CSS grid instead of a table, three more** — each found in
`pcf-calendar-view`'s timeline (a sticky label column beside a month or a
quarter of day tracks) by measuring the pinned cell at both ends of the
scroll, and none visible in a static render (2026-10-27, Chrome, the preview
and the hub's harness):

- **A sticky cell cannot travel past the end of its own grid.** The grid was
  `width: 100%` and its `minmax(36px, 1fr)` day tracks overflowed it into the
  scroll; once scrolled further than the grid's width less the label, the
  label column left with the days — a quarter's December lost every title
  (scrolled 1,305px), and so did a 373px month's last week. Give the grid a
  `min-width` of its tracks' minimums (`calc(<label> + <n> * <day>)`, inline,
  since `n` is the component's): the tracks land where they did and only the
  box under them grows. Not `min-width: max-content`, which sizes every `1fr`
  track to the longest item it spans (*The timeline, and a drag with nothing
  to drop on* in `dates-in-a-dataset.md`).
- **Pin with `inset-inline-start`, never `left`.** A physical `left: 0` holds
  nothing right to left: scrolled to the end, the label, the corner and an
  hour grid's axis all left the box. The logical offset is the same rule in
  both directions.
- **Right to left, `scrollbar-gutter: stable` on a box with `overflow-y:
  hidden` will not scroll back to its start.** `scrollLeft` stopped at minus
  the gutter's width (−15) even when set to 0, and the label column sat 15px
  past the box's edge, every title cut. Drop the gutter under `[dir='rtl']`;
  left to right can keep it.

Check a pinned column at `scrollLeft` 0 and at its maximum, in both
directions — four positions, one script — and compare the pinned cell's edge
with the box's inner edge, not with a screenshot.

### Resizing a column

Two exemplars, one per shape: `pcf-row-commands` 0.2.3 (plain DOM, its
`widths.ts`) and `pcf-data-table` 0.7.0 (React, `layout/widths.ts`, a
percentage `<colgroup>` until somebody drags). Seven things decide whether it
works:

- **`visualSizeFactor` is pixels**, measured (P5): at an allocated width
  narrower than the columns, each drew at exactly its factor — widths somebody
  had dragged in the view designer.
- **A table at `width: 100%` cannot hold a dragged width.** On a host wider
  than the columns the browser shares the surplus into every column (×2.23 on
  a 2,490px main grid), including the one the user just sized. Set the table's
  width outright and lay the columns out yourself. The arithmetic belongs in a
  decision module where a suite can assert it.
- **The first drag moves one column.** With nothing resized, the pixel layout
  has to reproduce what the browser drew — measure it, do not derive it:
  `pcf-data-table`'s percentages drew each column at `share × (table − select
  column)`, and its `dev/widths.js` fixtures are those measured widths. Round
  at the running edge (`round(sum so far) − previous edge`), not per column:
  flooring each share and handing the remainder to the last column summed
  exactly and put the last column 7px off.
- **A drag's slack goes to the column that is always last — never shared out.**
  `pcf-row-commands` 0.2.0 shared it among the columns nobody resized, and the
  columns *before* the dragged one widened with it, pushing its own left edge
  away: a 100px drag moved the edge about 43px, the handle sliding off the
  pointer (fixed in 0.2.3). Every column nobody resized keeps the width it drew
  before the drag; what a drag frees goes to the command column (right-aligned
  buttons, after every data column) or, where there is none, the last loose
  column. And the table still **fills** the room it was laid out in — ending it
  short looks tidy and is the first half of the next section's loop.
- **The handle is a `separator`**: focusable, `aria-orientation="vertical"`,
  `aria-valuenow` carrying the width, moved by ← and →, Home to reset one column.
  Pointer and keyboard write the same override.
- **Pointer capture on the handle, and nothing else listening.** Measured on a
  subgrid (P6): a header press reaches the control, `setPointerCapture` holds,
  `pointerup` then `lostpointercapture` arrive. A parent with its own
  `pointerup` commits twice (`pcf-calendar-view`). Wrap `setPointerCapture`
  in a try — a synthetic pointer id throws.
- **No render during a drag** — for a plain-DOM control. One that rebuilds its
  DOM on every `updateView` destroys the handle holding the capture. Owe the
  render and pay it on release; set widths in place (`th.style.width`) while
  dragging. A React control can keep the widths in state and re-render freely:
  the handle's element is reconciled, not replaced, so the capture survives.

**Where the width lives.** `localStorage`, keyed by table **and** view —
`getViewId()` measured present and stable on a subgrid and a main grid (P4); fall
back to the column set where there is none. The control is not framed on a form
(P4), so this is the org origin's storage. **Reading `localStorage` can throw**
(blocked site data throws a `SecurityError` on the access, not on a method), so
the getter itself goes inside the try, and a refused store still resizes for the
visit. The dataset rig's `storage` switch reaches all four states.

### A width measured from your own box is a loop

The trap under every layout in pixels — resized columns, pinned columns, a
chart — and the one that crashed a released build.

**A form section is a shrink-to-fit parent** (see [Scrolling wider than the
container](#scrolling-wider-than-the-container)): it takes its width from the
control. So the `clientWidth` of the control's own scroll box is, in part, the
width of whatever the control drew in it. Lay the content out in that
measurement and the content's width and the measurement feed each other.

`pcf-data-table` 0.7.0's first build did exactly that — measured the scroll box
in a `useLayoutEffect` and a `ResizeObserver`, and laid the columns out in it.
Reported from a real subgrid, 2026-09-27, and both halves of the loop showed:

- **Narrowing a column left white space at the end.** The table ended short of
  its box, the box shrank to the table, the room shrank with the box, and every
  column shrank again. Reproduced in the preview with the host made
  `fit-content`: one 64px narrowing took the box from 1,368 to 1,042px.
- **Widening the last column to cover it gave "Error loading control".** The
  table grew past its box, the box grew to the table, the room grew, every
  column grew, and round again — each pass a synchronous re-render from the
  layout effect, with nothing capping the climb, until React stopped
  re-rendering and the platform reported the control failed. The preview logged
  `ResizeObserver loop completed with undelivered notifications` on the way; it
  did not crash there only because the page capped the host at the viewport.

Three rules close it, and each closes a different half:

1. **The room is `allocatedWidth`, lowered by the measurement, never raised by
   it**: `Math.min(clientWidth, allocatedWidth)` — the same
   `min(measured, allocated)` that *A narrow layout is measured, not queried —
   and never contained*, below, reached from the other side. The allocated
   number comes from outside the circle; the measurement only corrects a host
   that over-reports it.
2. **No `allocatedWidth`, no measurement.** Where the host reported none (`-1`,
   `0`), nothing outside the circle bounds it, so lay out in a fixed budget
   (100px a column in `pcf-data-table`) rather than in the box.
3. **The content fills at least the room it was laid out in.** Give any slack to
   a last column rather than ending short. Then the box can never report less
   than it was given, and the downward half cannot start.

A plain-DOM control that measures once per render and has no observer —
`pcf-row-commands` — cannot run away, because nothing re-measures after its own
relayout. The engine is a measurement whose result changes the thing measured
and triggers another measurement: a layout effect with the width in its deps, or
a `ResizeObserver` on a box the content sizes.

**Reproduce it before trusting a fix.** The rig computes no layout and a
preview page with a block parent never loops. `pcf-data-table`'s
`dev/preview.html?fit=1` puts the root in a `fit-content` parent — a form
section in one line — and that is where the 326px collapse showed and where the
fix was measured holding: the box stayed at 1,368px through a narrowing, and
five widenings of the last column scrolled the table to 1,688px and stopped.

## Narrow widths

Moved here from `styling-and-accessibility.md` on 10 Oct 2026, because each
half of the `min(measured, allocated)` rule pointed at the other across two
files.

### A viewport-relative cap has a lower end, and something will find it

`max-height: min(80vh, 40rem)` on a popup reads as "most of the screen, capped"
and is fine until the viewport is tiny. One is: **PCFHub sizes its demo iframe
to the control's resting height** — 68px for a field control — and `80vh` of
68px is 54px. A calendar that needed 337px rendered as a scrolling sliver about
one row tall, in the demo, on the public component page.

Give any `vh`-based cap a floor:

```css
max-height: max(22rem, min(80vh, 40rem));
```

`vh` reads as "a fraction of a screen" and is a fraction of whatever box the
control was given. The same caution applies to `vw`, and to a `@media` query
written against the viewport when the control only ever occupies a form cell.

### A narrow layout is measured, not queried — and never contained

A control that reflows below some width has three ways to know its width, and
two of them are wrong on a form.

- **A viewport media query never fires for a narrow control in a wide
  window.** The hub's phone frame is a ~373px container inside a full-width
  page; so is a narrow section of a wide form. `@media (max-width: 560px)`
  matches neither.
- **`container-type: inline-size` on the root collapses the control on a
  form.** Size containment makes the element's intrinsic inline size zero,
  and a form section hands the control a *shrink-to-fit* parent that sizes
  itself from the control — the root is capped by `allocatedWidth` through
  `max-width`, not sized by it. `pcf-calendar-view` 0.1.3 shipped this and
  every form rendered the month as a one-column sliver; the demo's phone
  frame, which has a definite width, looked right (2026-09-16). **Never put
  size containment on a control's root.**
- **A `ResizeObserver` on the root measures the width the control actually
  got and contains nothing.** Set a class from it (`CalendarView--narrow`)
  and write the narrow rules against the class; keep the media query beside
  it for a host without the observer. It fires on the render step, so a rig
  that does not paint — a hidden preview pane — never sees it.

```tsx
const rootRef = React.useRef<HTMLDivElement>(null);
const [narrow, setNarrow] = React.useState(false);

React.useEffect(() => {
    const root = rootRef.current;

    if (!root || typeof ResizeObserver !== 'function') {
        return undefined;
    }

    const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;

        setNarrow(width > 0 && width < 560);
    });

    observer.observe(root);

    return () => observer.disconnect();
}, []);
```

`mode.allocatedWidth` is the other honest number, and the right one for a
*ceiling*; it is not the right one for the narrow switch, because the hub's
demo harness and a canvas host do not reliably answer it.

**And the measurement has a floor: `mode.allocatedWidth`.** Measured on the
Accounts **main grid** 2026-09-19 (`pcf-chart-view` W2): the control drew at
~380 px of a ~1050 px grid. The main grid is a **shrink-to-fit** host — the
root, rendered on its first pass without the SVG it draws once it knows a
width, measured the width of its own caption, and the SVG then locked that
width for good. A form section is a block parent and measures true, which
is why every earlier control got away with the ResizeObserver alone. Ask
`mode.trackContainerResize(true)` in `init` (`allocatedWidth` is -1 until
then, and a main grid answers it after) and take the **larger** of the
measured width and the allocated one — the allocated width is never more
than the host gives, so the maximum is safe on both hosts. The dataset rig's
`width` option is the allocated width; the chart's preview reproduces the
collapse with a shrink-to-fit root and `allocatedWidth` withheld.

**And nothing the control draws may prop its own parent open.** The same
walkthrough, on a two-column section (X7): the chart grew with the window
and never shrank, because an `<svg width="868">` in the flow holds its
parent at 868 for good — the ResizeObserver then measures a root that can
never be narrower than the last SVG. Anything sized from the measurement
goes **out of the flow** (absolutely positioned inside a box that carries
the height), so the root's width comes from the host alone and follows it
both ways. Measured in the preview: root 868 → 468 on a 900 → 500 viewport
once the SVG was absolute.

**Then give the root the host's width outright, because a form cell is
shrink-to-fit too.** The 0.1.0 walkthrough (Z4): with the SVG out of the
flow, nothing in-flow gave the root a width but the legend, so the flex row
collapsed to the legend and the donut drew over it from x = 0 — the legend
on the *left*, where the layout never puts it. A column chart with no
legend had overflowed into exactly the right place, which is why every
earlier look passed. So the rule has three parts, and each was a defect
first: ask `trackContainerResize(true)`; **set `allocatedWidth` on the root
as its width** when the host answers it (it follows the window both ways,
measured on the form and the main grid), leaving the stylesheet's 100% for a
host that does not; and keep what is sized from the measurement out of the
flow. The ResizeObserver is then the fallback, not the source.

**And a ceiling on it, because a host can hand over more width than the
box it gives.** The same control on the hub's demo, the day of the release
(2026-09-19): every preset flashed a horizontal and a vertical scrollbar on
the desktop toggle and was fine on tablet and phone. The harness set
`allocatedWidth` from its *wrapper's* border box — 8 px of padding a side
outside the container the control is in — so a root set to it outright was
16 px wider than the page. A horizontal scrollbar; its 17 px overflowing the
frame's height into a vertical one; that one narrowing the wrapper; the
wrapper re-measured and re-rendered; and round again. Tablet and phone
never showed it only because there the container is the request's own
width. Two fixes, and both belong: the harness now hands over the
container's `clientWidth`, and the root carries `max-width: 100%` — in a
shrink-to-fit parent a percentage max-width counts for nothing while the
parent sizes itself, so it cannot re-collapse the cell (Z4 still holds in
the preview on a shrink-to-fit root at 880 and 1000). **Then draw at the
measured width once both numbers exist**, `Math.min(measured, allocated)`,
not the larger — with the root clamped, the allocated number is the one
that is wrong, and an SVG drawn at it hangs past the root by the same
amount and scrolls the page sideways on its own. Before the first reading,
or on a host that never answers, whichever exists. The chart's preview has
`?over=24` for a host that over-reports.

**That "whichever exists" holds only while the measured box is not sized by
what is drawn from it.** The chart keeps its drawing out of the flow, so the
root measures the host. A table in the flow does not: its scroll box in a
shrink-to-fit section *is* the table's width, and laying the table out in that
measurement is a loop — white space when a column narrows, and
`pcf-data-table` 0.7.0's first build crashing ("Error loading control") when one
widened. There, the measurement only ever lowers `allocatedWidth`, a host with
no `allocatedWidth` is not measured at all, and the table always fills what it
was given. See *A width measured from your own box is a loop*, above.
