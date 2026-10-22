# Grid customizers

The shape that binds nothing and renders nothing of its own: a table of cell
renderers and editors handed to the Power Apps grid.

- [Grid customizers](#grid-customizers)
  - [Assigned to a grid, and what decides whether it works at all](#assigned-to-a-grid-and-what-decides-whether-it-works-at-all)
  - [The types are vendored, because there is nothing to install](#the-types-are-vendored-because-there-is-nothing-to-install)
  - [Returning `undefined` is the contract, not the fallback](#returning-undefined-is-the-contract-not-the-fallback)
  - [What a renderer can see, and what it therefore cannot draw](#what-a-renderer-can-see-and-what-it-therefore-cannot-draw)
  - [Reading attribute metadata from a customizer](#reading-attribute-metadata-from-a-customizer)
  - [The `gridCustomizer` half behaves differently](#the-gridcustomizer-half-behaves-differently)
  - [There is a local harness, and it is the only way to see this shape work](#there-is-a-local-harness-and-it-is-the-only-way-to-see-this-shape-work)
  - [The latches and lifetimes the shape needs](#the-latches-and-lifetimes-the-shape-needs)
  - [The rules the platform actually enforces](#the-rules-the-platform-actually-enforces)
  - [Fluent 8, and no icons](#fluent-8-and-no-icons)
  - [What is not configurable](#what-is-not-configurable)

## Grid customizers

A control that binds nothing, renders nothing, and whose entire output is other
controls' cells. `updateView` returns an empty fragment; the contribution is one
call during startup:

```ts
public init(context: ComponentFramework.Context<IInputs>): void {
    const eventName = context.parameters.EventName.raw;

    if (!eventName) {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (context as any).factory.fireEvent(eventName, {
        cellRendererOverrides,
        cellEditorOverrides,
    });
}
```

Documented at [Customize the editable grid control][gridcustomizer]. The
overrides are objects keyed by `ColumnDataType` — `Text`, `Currency`,
`OptionSet`, `TwoOptions`, `Lookup`, and about twenty more — so **an override
applies to every column of that type on the grid it is assigned to**. Narrowing
to one column happens inside the function, off
`params.colDefs[params.columnIndex].name`. That second argument is the only
thing standing between "style the credit limit" and "restyle every currency
column on the table".

[gridcustomizer]: https://learn.microsoft.com/en-us/power-apps/developer/component-framework/customize-editable-grid-control

### Assigned to a grid, and what decides whether it works at all

It is assigned to a **table's grid**, not placed on a form — Settings →
Customizations → the table → Controls → Power Apps grid control → *Customizer
control* = `{prefix}_{namespace}.{constructor}`.

The things that decide whether it works at all, each learned by shipping the
opposite and watching it look like it worked:

- **Put the surface in `cellRendererOverrides` / `cellEditorOverrides`, never in
  `gridCustomizer`.** The shipping grid ignores that key — see *The
  `gridCustomizer` half behaves differently* below, which is why loading
  skeletons and custom empty states are not a shape at all. The local harness
  renders those members anyway, so it will tell you a control works when it
  cannot.
- **Imported ≠ active.** A customizer that is built, packed and imported but
  never named on a grid is silently inert and logs nothing. This is the single
  most common way the shape appears broken; say it in `docs/installation.md` and
  expect to say it again.
- **One grid, one customizer.** Multiple customizers can exist in an
  environment; a grid gets one. Two sets of overrides means merging them into a
  single control.
- **`--type grid-customizer` scaffolds it**, React-virtual on **Fluent 8**, not
  the Fluent 9 the other React variants use. A cell is mounted by the grid with
  nothing of the customizer's above it, so there is nowhere to put a
  `FluentProvider` — and Fluent 9 needs one. This is why the flag does not
  compose with `--framework`; see *Fluent 8, and no icons* below.
- **`demo.host` must be `"grid"`** in `pcfhub.json`, with a `datasetFixture` for
  the grid's rows, and the manifest must declare
  `<platform-library name="React">` — see *`demo.host`* in
  `pcfhub-publish/references/hub-demo.md`. The scaffold ships `demo/columns.json` — one row per
  interesting case across every column type an override can key on — and
  points `datasetFixture` at it, so this is a thing to keep rather than to
  write. `fidelity` still starts at `none` and raising it is the author's call:
  a customizer reading attribute metadata may have to stay there, because the
  harness supplies none and the demo would show a grid with none of the
  control's work in it.
- **Develop it against `dev/harness.html`, not `npm start`**, which hosts a
  customizer the way a form would, where it correctly renders nothing — and
  **`npm run smoke`** turns the per-cell decisions into assertions. See *There
  is a local harness, and it is the only way to see this shape work* below.
- **Anything a renderer needs beyond its own cell comes from attribute metadata,
  and not from `context.utils.getEntityMetadata`** — and a renderer that is
  merely *waiting* must never return `undefined`, because declining is
  permanent. See *Reading attribute metadata from a customizer* and *Returning
  `undefined` is the contract, not the fallback* below.

### The types are vendored, because there is nothing to install

The customizer contract is a `types.ts` inside `microsoft/PowerApps-Samples`, at
`component-framework/resources/GridCustomizerControlTemplate/PAGridCustomizer/` —
a file in a repository authors are told to clone, not a published package.
`@types/powerapps-component-framework` carries neither it nor
`factory.fireEvent`, whose `interface Factory` has exactly `getPopupService` and
`requestRender`. So the payload goes out through an `as any` cast, exactly as
Microsoft's own template does, and the type file is copied into the control with
its source path and the date it was taken in the header. Nothing type-checks it
against the platform; a re-take and a diff is the only way to find drift.

`--type grid-customizer` scaffolds both, so this is a thing to maintain rather
than to write.

### Returning `undefined` is the contract, not the fallback

**`null` or `undefined` back from an override means "use the grid's own".** It is
how a customizer says "only these columns", and a good one declines most cells —
returning an element for every cell of a type replaces the grid's virtualized
rendering with yours on every row, for no visible difference.

It is also the only correct answer to four cell states an override cannot
reproduce, and each is easy to miss because the sample reads none of them:

| State | Why declining is the fix |
| --- | --- |
| `props.validationError != null` | An element replaces the *whole* cell, and the grid's error border and message go with it. The message lives in an element `cellErrorLabelId` names and the customizer does not own, so it cannot be rebuilt. Render through it and the cell is quietly invalid and looks fine — the first signal is a save that fails. |
| A nullable value that is unset | `props.value === true` makes `null` render as "No". An unanswered two-options column is not a No, and the server filters on the real value — so the grid on screen disagrees with the row count the filter returns. Applies to every nullable type, not just `TwoOptions`. |
| `props.secured` (editors) | Field-level security. An override that ignores it hands the user a working editor for a column they cannot write, moving the refusal to the save. |
| `props.isRequired` (editors) | Not a decline — but an affordance the grid would have drawn and yours does not, unless you pass it through. |

Two more the platform hands over and a first draft always drops:
`props.isRightAligned`, which the grid sets on numeric columns — ignore it and
the column most likely to be aligned is the only one that is not — and
`props.rowHeight`, which is why a hardcoded editor height looks wrong in a grid
configured for tall rows.

**An element replaces the cell's interactions, not just its pixels — and
editing is the one that goes.** Row selection survives, because the grid owns
the row: the cell still highlights, takes a focus ring and looks entirely
alive, while no longer opening an editor when clicked. That combination is why
this survives review, a rendered harness and a screenshot. Every renderer
returning an element must forward the interactions it displaced:

```tsx
<div
    className="..."
    onClick={props.onCellClicked}
    onDoubleClick={props.columnEditable ? () => props.startEditing?.() : undefined}
>
```

This is what those three fields on `CellRendererProps` are for. `onCellClicked`
is documented as "callback indicating the grid cell has been clicked" — once you
have drawn your own element, nothing else can raise it. `startEditing` opens the
editor directly and `columnEditable` says whether there is one to open. Wire
both gestures: which one the grid turns into an edit is its own business and can
differ between a grid with *Enable editing* set and one without, and
`startEditing` on a cell already editing is a no-op.

Do **not** add keyboard handling or `tabIndex` to that element. The grid owns
cell focus and keyboard navigation at the row level, so Enter and F2 never
reached it, and a tabbable element inside the cell adds a second stop to a
roving-tabindex surface the customizer does not own.

**Never decline for "not yet".** Declining is *permanent* for that cell: it
becomes the grid's own, the customizer never hears about it again, and — since
nothing can trigger a repaint — no later answer can reach it. A control waiting
on anything async that returns `undefined` in the meantime looks exactly like a
control that works, until you notice the decoration only appears on cells you
have clicked. Keep the cell, render `props.formattedValue` alone, and subscribe
for the answer. The four states in the table above are decisions, not delays;
that is what makes declining right for them and wrong for a pending fetch.

### What a renderer can see, and what it therefore cannot draw

Read off the vendored `types.ts`, and worth knowing before designing anything
that is not a per-cell decoration:

- **`CellRendererProps` describes one cell.** `value`, `formattedValue`,
  `columnDataType`, `rowHeight`, `isRightAligned`, `validationError`,
  `cellErrorLabelId`, `columnEditable`.
- **`RowData` is `{ __rec_id: string }`.** The row's id and nothing else — no
  sibling column values, so nothing can be computed across a row.
- **`GetRendererParams` adds `colDefs` and `columnIndex`**, which is the only
  route to the column's logical name and the only supported way to narrow.
- **There is no `PAGridAPI` handle.** `PAOneGridCustomizer` has exactly three
  keys — `gridCustomizer`, `cellRendererOverrides`, `cellEditorOverrides` — and
  no callback receives one. **A customizer cannot make the grid re-render.**

Those last two together rule out a whole category of design, and the ruling-out
is the useful part. Anything needing context beyond the cell — a data bar scaled
to the column, a sparkline, a heat tint, a rank — has no way to measure that
context and no way to correct itself once more rows arrive. Accumulating a
running maximum across the cells the grid happens to ask for is the obvious
workaround, and it is wrong for every row drawn before the largest value showed
up, permanently, because nothing can trigger the redraw that would fix it.

The sound alternative is **attribute metadata**: the range, precision or option
set the *column* declares, read once and held in module scope for the renderers
to read synchronously. `pcf-grid-data-bars` is built this way. Getting it right
took three rounds against a live environment, because the obvious API cannot do
it and fails without saying so — see *Reading attribute metadata* next.

### Reading attribute metadata from a customizer

> **Verified 2026-08-25 against a live environment.** Every item here was first
> written the other way, shipped, and looked like it was working.

**The table name is confirmed available.**
`context.mode.contextInfo.entityTypeName` carries the logical name on a grid
customizer. (`context.page.entityTypeName` is the older fallback.) Neither is in
`@types/powerapps-component-framework`, so both are casts — but the cast is a
typings gap, not an absent API. A customizer has no dataset and therefore no
`getTargetEntityType()`, so this is the only route.

**`context.utils.getEntityMetadata` cannot answer a question about a numeric
range, and this is the trap.** Two separate failures, both silent:

1. **With no `attributes` argument it returns an entity with no columns.** The
   promise resolves, `Attributes` is a real collection object, and its backing
   `_collection` is empty — `.get(name)` answers `null` for everything. The
   argument is the list of columns to *fetch*, not a filter over columns already
   fetched.
2. **Even with columns named, the attribute metadata carries no
   `MinValue`/`MaxValue`.** The client-API surface is four properties —
   `AttributeType`, `DisplayName`, `EntityLogicalName`, `LogicalName` — plus
   option-set extras for the choice-shaped types. Nothing numeric, ever.
   `@types/powerapps-component-framework` *does* declare `MinValue`/`MaxValue`,
   under `PropertyHelper.FieldPropertyMetadata` — which is the shape a **bound
   field property** carries on an ordinary control. A customizer binds no field,
   so it can never reach that object. The typings make an unreachable API look
   available.

**Read it from the Web API instead**, where the range lives on the *typed*
metadata entity. The attribute collection must be **cast** before `MinValue` can
even be named in a `$select`:

```
{clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='{table}')
  /Attributes/Microsoft.Dynamics.CRM.DecimalAttributeMetadata
  ?$select=LogicalName,MinValue,MaxValue
```

| Column type | Cast |
| --- | --- |
| `Integer` | `IntegerAttributeMetadata` |
| `Decimal` | `DecimalAttributeMetadata` |
| `FloatingPoint` | `DoubleAttributeMetadata` |
| `Currency` | `MoneyAttributeMetadata` |

A cast is per request, so four types are four requests. Use `fetch`, same-origin
— `context.webAPI` addresses records by entity logical name and cannot reach
`EntityDefinitions`. No feature-usage gates it, and reading metadata needs no
privilege beyond being signed in. Prefer `context.page.getClientUrl()` over a
root-relative URL: on-premises puts the org in a *path*, where `/api/...` 404s.

**Resolve in `init`, which the Web API makes possible.** The Web API query
needs only the *table* name. The client API needed *column* names, which do not
exist until the grid asks for a cell — which is what forced the whole
request-from-the-renderer design, with its queue, its batching timeout and its
side-effect-during-render problem. All of that disappears when the request can
start in `init`, and the answer then beats the first paint instead of always
losing to it. Unfiltered and once per type: there is no column list to narrow
by, and each request answers for every column of its type, including ones the
user reveals later.

**Re-firing the event does not make the grid repaint.** The obvious way to
handle a late answer is to hand the grid a fresh payload; it takes the payload
and draws nothing new. Confirmed by the symptom: bars were missing until a cell
was *clicked*, because a click invalidates that one cell and the grid calls the
renderer again for it alone. There is no repaint mechanism at all.

**So a cell drawn before the answer lands must not decline** — see the caveat
under *Returning `undefined`*. Return a component that draws
`props.formattedValue` and subscribes to the metadata module, re-rendering
itself when the answer arrives. Hooks are safe there because the manifest
declares React as a `platform-library`: the host's React instance both mounts
the element and dispatches its hooks.

**The platform defaults, read off a real table** — four columns created through
the modern designer with Minimum and Maximum left alone:

| Type | Default range when nobody chooses |
| --- | --- |
| `Integer` | `-2147483648 .. 2147483647` |
| `Decimal` | `-100000000000 .. 100000000000` |
| `FloatingPoint` | `0 .. 1000000000` |
| `Currency` | `-922337203685477 .. 922337203685477` |

Note `FloatingPoint`: `0..1000000000`, **not** the ±100 billion the type
accepts. Documentation and the SDK's `MaxSupportedValue` both mislead here.

Treat "the range equals the type default" as "nobody declared a range" — a value
of 40,000 against a maximum of one hundred billion draws a bar four
ten-thousandths of a pixel wide, on every row.

**But that check only catches a *fresh* column.** Dataverse ships columns whose
ranges nobody chose and which are not their type's default either:
`account.creditlimit`, `revenue` and `marketcap` declare `0..100000000000`;
`numberofemployees` and `sharesoutstanding` declare `0..1000000000`;
`timezoneruleversionnumber` and `utcconversiontimezonecode` declare
`-1..2147483647`. No default check recognises those. Suppress **per cell** on
the computed geometry instead — if the width rounds to `0%`, decline — which
needs no growing list of constants and stays right on a column holding both
trivial and enormous values. The pixels are identical either way; what it really
fixes is the accessible label, which otherwise announces "0% of column range" on
a column nobody customized.

### The `gridCustomizer` half behaves differently

> **Verified 2026-08-25 against a live environment: the shipping grid does not
> call these members. Do not build a control whose only surface is
> `gridCustomizer`.**
>
> Tested on a form subgrid and a table main grid, across empty and populated
> views, with the control instrumented to log both directions. The grid
> generated an event name (`CustomizerReady####`) and delivered it on the first
> `init`, so it was listening before the control mounted. The payload was fired
> up to seven times per instance — from `init`, from `updateView`, and from
> timers at 50/150/400/1000 ms — and `fireEvent` never threw.
> `GetLoadingRowRenderer` and `GetNoRowsOverlayConfiguration` were never called,
> on any surface.
>
> The same payload carrying `cellRendererOverrides` **was** honoured in the same
> grid, on the same fire: Text, Email, Phone and Lookup overrides ran per column
> per row with real `colDefs` names. One key read, the other ignored.
>
> The control was not the variable. Its manifest matched Microsoft's
> `GridCustomizerControlTemplate` exactly — `control-type="virtual"`, a bound
> required `EventName` of `SingleLine.Text`, React 16.14.0, Fluent 8.121.1 — and
> it made the same `(context as any).factory.fireEvent(eventName, payload)` call
> from the same lifecycle method, with retries the template does not have.
>
> **There is no workaround.** An empty grid has no cells, so
> `cellRendererOverrides` — the channel that works — can never reach an empty
> state or a loading skeleton. A control needing those needs `gridCustomizer`,
> and the grid does not read it.
>
> The members are declared in the types Microsoft vendors with that template,
> and the maker documentation for the Power Apps grid control says the
> *Customizer control* property can change "the visuals or interactions for one
> or more columns in the grid or the empty grid visual". The developer
> documentation describes only the two cell-override maps, and no first-party
> sample uses `gridCustomizer`. On this evidence that clause describes an
> interface that exists in the types and not in the grid.
>
> `pcf-grid-chrome` was built on it and **withdrawn** — release deleted, repo
> kept; its `SPEC.md` carries the reproduction. The rest of this section
> describes the interface as the vendored types declare it, and is kept for
> whenever the platform starts honouring it.

The payload's third key is the one nothing reaches for, and it does not follow
the rules the override maps taught:

| | `cellRendererOverrides` / `cellEditorOverrides` | `gridCustomizer` |
| --- | --- | --- |
| Shape | maps keyed by `ColumnDataType` | one object, named methods |
| Return type | `ReactElement \| null \| undefined` | `ReactElement` |
| Can decline? | **Yes — and should, often** | **No** |
| Receives a context? | no | no |

**They cannot decline.** Implementing `GetHeaderRenderer`,
`GetLoadingRowRenderer` or `GetNoRowsOverlayConfiguration` replaces the grid's
version of that thing for every column of every view of the table, with no
per-case opt-out. That inverts the advice above: for cell overrides declining is
the feature, and here there is no such escape — so the decision is whether to
implement the member at all.

Three specifics that each cost a build to discover:

- **`GetHeaderRenderer` should almost always be left out.** `GetHeaderParams`
  carries `colDefs`, `columnIndex`, the two visual-edge flags, `rowData`,
  `isRTLMode` and `allowTabKeyNavigation` — **no sort direction, no filter
  state, no callback to open the column menu**. Combined with the inability to
  decline, implementing it means drawing a display name while removing sorting,
  filtering and the column menu from every column on the table.

- **`NoRowsOverlayConfig.component` is a `ComponentClass`, and the type then
  refuses the props the contract hands it.** A function component is a type
  error. So is a class typed on real props: bare `ComponentClass` resolves to
  `ComponentClass<{}, any>` while the neighbouring `props?: unknown` exists to
  carry props to it, and TypeScript rejects both the assignment (TS2322) and a
  single `as` assertion (TS2352), naming `as unknown as` itself. The alternative
  — widening the component to `Partial<…>` — typechecks by making every string
  optional and needing an in-code English default for each, trading a cast for a
  localisation hole.

- **These members get no context, so they cannot read the `.resx`.** Both take
  no parameters at all. Export a factory taking `ComponentFramework.Resources`
  and call it from `fire()`, where a context still exists, rather than exporting
  a constant.

`pcf-grid-chrome` implemented two of the three and documented why it refused the
header — and was withdrawn when the grid turned out never to call either.
`--type grid-customizer` still scaffolds all of it, unwired, in
`customizers/GridCustomizerOverrides.tsx`, with the reasoning in place: the
scaffold is harmless and the reasoning is still right about what the interface
*says*. Delete those members rather than wiring them, and put the control's
surface in `cellRendererOverrides`.

### There is a local harness, and it is the only way to see this shape work

`npm start` hosts a customizer the way a form would, where it correctly renders
nothing. PCFHub's demo harness renders cell renderers and editors over
`demo.datasetFixture` but does **not** call the `gridCustomizer` members and
carries no attribute metadata. So before this existed, the only way to watch a
customizer run was to pack a solution and import it.

`--type grid-customizer` now scaffolds `dev/harness.html` — a static page that
loads the built bundle plus React and Fluent from `node_modules`, calls every
override the way the grid does, and renders the chrome members. No bundler, no
dev server, no new dependencies; `npm run build`, then open the file. Two things
about it are easy to get wrong when editing:

- It runs over `file://`, so its fixture is a script rather than a `fetch` of
  `demo/` — `fetch` is blocked there and `<script src>` is not.
- **`registerControl` takes two arguments**, not three: `pcf-scripts` emits
  `registerControl('Namespace.Control', ctor)` with the name already joined.
  Reading the constructor from a third parameter gets `undefined`, and it
  surfaces later as "registered is not a constructor".

It is a stand-in, not the grid: `validationError`, `secured` and `isRequired`
are states it cannot produce, which makes the branches handling them exactly the
ones it cannot check.

**And it disagrees with the grid about the chrome members, in the direction that
misleads.** The harness calls `GetLoadingRowRenderer` and
`GetNoRowsOverlayConfiguration` because it was written from the vendored types;
the shipping grid calls neither (see the box above). A chrome member rendering
in the harness proves your component is correct, never that the platform will
ask for it. Cell renderers and editors do not have this problem — there the
harness and the grid agree.

Beside it, `dev/smoke.js` and `npm run smoke` load the same bundle from Node,
fire the payload, call the overrides and assert what comes back — because the
harness *shows* you a grid, while a customizer's behaviour is a set of per-cell
decisions that are invisible in a rendered grid unless you happen to be looking
at the right cell. It ships a worked example against the scaffolded `Text`
override, to be replaced. Fluent is stubbed rather than loaded — every component
resolves to its own name as an element type, so the props an override passed
survive for inspection without pulling a browser-shaped library into Node.

**A stub must never be more capable than the platform it stands in for**, and
this is the failure mode both local rigs invite. `pcf-grid-data-bars` shipped
twice while doing nothing, green both times, because its `getEntityMetadata`
stub answered for every column regardless of the `attributes` argument — where
the real call answers for none. A fixture that is *more generous* than the API
does not merely fail to catch a bug; it manufactures a passing suite for a
control with no working path at all. When stubbing a platform call, stub its
refusals first: the argument it requires, the fields it omits, the empty
collection it returns. If you cannot state what the real call withholds, the
stub is a guess and the assertions built on it prove nothing.

**CI runs it after the msbuild pack, not after `npm run build`**, since the pack
overwrites `out/controls` with the production bundle — so the step drives what
actually ships. Minification leaves the assertions alone: terser does not touch
string literals or React lifecycle names with property mangling off, which is
what lets `component.prototype.render` still identify a class component in
`pcf-grid-chrome`. Worth knowing the local consequence: `npm run smoke` tests
whichever bundle is on disk, so it silently switches back to the development one
after any `npm run build`.

### The latches and lifetimes the shape needs

**Fire from `updateView` as well as `init`, behind a flag.** The event name is a
*bound* property, and a bound property is not guaranteed to carry its value when
`init` runs. Microsoft's template fires only from `init`, so a name arriving one
render later is dropped for the life of the grid, with nothing logged, on the
one surface where the control was supposed to work. The flag is what makes
calling it twice safe.

**`stopEditing` needs a one-shot per editor, and "per editor" means per mount.**
Closing an editor blurs it, so `stopEditing(true)` on Escape is followed
immediately by the blur handler's `stopEditing()` — and the discard commits. The
user presses Escape and watches their edit save. Any editor that handles Escape
*and* commits on blur has this; both handlers must share a latch.

Where that latch lives is the part to get right, because module scope is so
obviously wrong that a closure looks like the answer:

```tsx
// Wrong twice over. In module scope, two cells editing at once share one flag.
// Built per call — which is what a closure created inside the override is — the
// flag resets every time the grid re-asks for the element, and the grid re-asks
// freely: Escape, then a re-render, then the blur, and the discard commits
// after all. The latch is defeated by the way the latch was built.
function closeOnce(params: GetEditorParams) {
    let closed = false;
    return (cancel: boolean) => { /* … */ };
}

// Right. One flag per mounted editor, surviving the re-renders in between.
function useCloseOnce(params: GetEditorParams) {
    const closed = React.useRef(false);

    return React.useCallback((cancel: boolean) => {
        if (closed.current) return;
        closed.current = true;
        params.stopEditing(cancel);
    }, [params]);
}
```

Which means the editors are **components**, not bare elements — the override
returns `<TextCellEditor cell={props} params={params} />` and itself stays the
pure, repeatedly-called function the platform requires. Anything that has to
happen once per open editor needs a mount to hang off, and the next two items
are the rest of that list.

**`charPress` seeds the input; it does not stage anything.** The character that
opened the cell arrives in `props.charPress` and belongs in `defaultValue` — but
the grid holds the value `stopEditing` commits, and nothing has told it about
that character. The user types "F", presses Enter, and the old value comes back,
having had "F" on screen throughout. It hides almost perfectly: a second
keystroke fires `onChange` with the whole field, so it only ever surfaces when
the first character typed is also the last. Stage it from a mount effect, not
from the override body, which has to stay pure:

```tsx
React.useEffect(() => {
    if (cell.charPress) {
        cell.onChange(cell.charPress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Every editor needs an exit that is not a commit.** A `Toggle` or a `Dropdown`
calling `stopEditing` only from its own `onChange` traps a user who opened the
cell and changed their mind: no Escape, and no blur either, because nothing
focused the control in the first place. Give it an explicit `focus()` on mount
through `componentRef`, and wrap it in an element carrying the Escape and blur
handlers — guarding the blur with
`event.currentTarget.contains(event.relatedTarget as Node | null)` so focus
moving *inside* the wrapper does not read as the user leaving. A blur with
nothing staged should discard rather than commit: a cell opened and abandoned is
untouched, not a decision.

### The rules the platform actually enforces

From the documentation's own best-practices list, in the order they bite:

- **The functions must be pure.** The grid calls them repeatedly, in an order it
  does not promise, and expects the same element for the same inputs. No state,
  no side effects, no writing to the record.
- **Never render a value other than the one the cell holds.** Sorting and
  filtering are server-side against the real value.
- **Stay cheap.** These run per cell on a surface that re-renders as it scrolls.
  Measuring text with a canvas is the tempting one to get wrong; estimate from
  `colDefs[columnIndex].width` instead.
- **The grid may dispose an element at any time.** Nothing may hold state that
  has to be flushed on unmount — which is why cell editors are uncontrolled,
  letting the DOM hold the draft and staging through `onChange`.
- **Don't use them to mutate data or metadata.**

### Fluent 8, and no icons

The manifest declares `<platform-library name="React" version="16.14.0" />` and
`<platform-library name="Fluent" version="8.121.1" />`. Fluent **8**, not 9, and
not nostalgia: the elements an override returns are rendered by the host's React
instance, and Fluent 8 styles without a provider above it. A cell has nowhere to
put a `FluentProvider`.

**Do not call `initializeIcons()`.** Fluent 8 icons are a registered font, the
customizer is mounted per cell inside a host that has made its own registration
decisions, and registering over it changes icons the control does not own. An
unregistered icon renders as nothing at all, silently. Use text marks, and give
them a word beside them — a glyph alone is unreadable to anything that reads
text, including the export a grid produces.

CSS has the same containment problem, one level up. Every rule belongs under a
control-specific class: these cells are mounted inside somebody else's grid,
which owns the row, the cell box, the selection state and the focus ring, and a
customizer is assigned to *every view of a table* — so a bare element selector
has a far larger blast radius than the same mistake in a field control. Define
literal colours as custom properties on `:root` and redefine them per theme.

**And do not reach for Fluent's tokens here, which is the opposite of the advice
under *Styling* in `styling-and-accessibility.md`.** The reason is not the missing provider — CSS custom
properties inherit through the DOM and care nothing about React context, so
tokens published anywhere up the tree would reach a cell perfectly well. The
reason is that they would be the *wrong* tokens: those are Fluent 9 and this
grid is Fluent 8. `colorNeutralForeground2` is `#424242` where Fluent 8's
`neutralSecondary` is `#605e5c`, so reading the token makes a customized cell
disagree with the untouched cell beside it. Matching the immediate surroundings
beats matching the app, and in a customizer those are not the same thing.

Say this out loud when reviewing one, because a customizer that has just been
"modernised" to `var(--colorNeutralX, …)` looks like an improvement and is a
regression.

**Redefine them against the host's theme, not the operating system's.**
`@media (prefers-color-scheme: dark)` is the obvious hook and it is the wrong
question: a model-driven app carries its own theme, and the user's OS setting
says nothing about it. An OS-dark machine on a light app picks up the dark
palette — which for anything painted straight onto the cell background, an
empty-value dash or a coloured number, means light grey text on white. There is
no palette that dodges this, either: nothing clears 4.5:1 against both `#ffffff`
and Fluent's dark `#292827`, so a customizer that colours text at all has to
know which one it is sitting on.

The signal is `context.fluentDesignLanguage?.isDarkTheme`, typed in
`@types/powerapps-component-framework` on `FluentDesignState` alongside
`tokenTheme` and `brand`. A cell renderer has no context to read it from, but
the control does — so publish it from `init` and `updateView` onto the one
element every cell inherits from, and let the stylesheet key off that:

```ts
private publishTheme(context: ComponentFramework.Context<IInputs>): void {
    const isDarkTheme = context.fluentDesignLanguage?.isDarkTheme;

    // Absent writes nothing, rather than assuming light. `fluentDesignLanguage`
    // is typed as Fluent *v9* theming data and a customizer declares Fluent 8,
    // so it may never arrive — leaving the attribute off hands the decision to
    // the media-query fallback instead of making the same guess again.
    if (isDarkTheme === undefined) {
        return;
    }

    document.documentElement.setAttribute(
        'data-gcs-theme',
        isDarkTheme ? 'dark' : 'light',
    );
}
```

```css
:root { /* light */ }
:root[data-gcs-theme='dark'] { /* dark */ }
@media (prefers-color-scheme: dark) {
    :root:not([data-gcs-theme]) { /* dark, for hosts that publish nothing */ }
}
```

Count the document-level writes: a page can hold several customized grids, so
`destroy` must not clear the attribute until the last instance goes — a module
counter incremented in `init` is enough.

`@media (forced-colors: active)` needs none of this and stays as it is; there,
carry meaning as border or underline, since tints collapse to one system colour.

### What is not configurable

Resist adding input properties to configure the overrides. They work, but a
customizer is assigned to a table's whole grid, so a value set on it applies to
every column of that type on every view of that table — which is almost never
what the setting meant. Narrow inside the override instead.

Keep the bound property named **`EventName`**. In the platform the host
generates the value, but nothing does in PCFHub's demo harness, so the harness
seeds it — finding the property by that name, falling back to the single text
input a customizer manifest has. Rename it *and* add a second text property and
the harness stops finding it: the demo loads cleanly, `init` returns at its own
guard, and nothing says why.

`getOutputs()` returning `{}` is correct here, and it is the one place the
"return every bound property" rule in `SKILL.md` does not apply — the host
writes `EventName` and the control never does.
