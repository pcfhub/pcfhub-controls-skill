# Standard and React controls, teardown and bundle size

The two rendering models, what a control owes `destroy()`, and what actually
decides bundle size. How canvas, model-driven and Power Pages differ — and
updating a control a canvas app already has, and full screen — moved to
[hosts.md](hosts.md) on 2026-10-08, when this file had grown to 894 lines.

- [Standard controls](#standard-controls)
  - [The caret, and what actually moves it](#the-caret-and-what-actually-moves-it)
  - [A value the control reformats as you type](#a-value-the-control-reformats-as-you-type)
- [React (virtual) controls](#react-virtual-controls)
- [Timers and teardown](#timers-and-teardown)
  - [What `destroy` owes](#what-destroy-owes)
  - [Four rules, and each is a bug somebody shipped](#four-rules-and-each-is-a-bug-somebody-shipped)
  - [Testing it](#testing-it)
- [Bundle size](#bundle-size)
- [Markdown or HTML a user wrote](#markdown-or-html-a-user-wrote)

## Standard controls

The template's `index.ts` is a complete example. The shape:

```ts
export class ColorPicker implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    private notifyOutputChanged!: () => void;
    private value = '';

    public init(context, notifyOutputChanged, _state, container): void {
        this.container = container;
        this.notifyOutputChanged = notifyOutputChanged;
        // build DOM once, attach listeners, then render
    }

    public updateView(context): void { this.render(context); }

    public getOutputs(): IOutputs { return { value: this.value }; }

    public destroy(): void { /* remove every listener added in init */ }
}
```

Rules that follow from `updateView` running on every change to any bound value,
including the control's own:

- Build DOM in `init`, mutate it in `updateView`. Recreating elements each pass
  destroys focus and selection.
- Guard assignments to input values against the platform's own echoes — see
  [The caret, and what actually moves it](#the-caret-and-what-actually-moves-it)
  below. One comparison is not enough.
- Put expensive work behind a comparison. `updateView` is not a render budget.
- `notifyOutputChanged()` tells the platform to call `getOutputs()`. Call it
  when the user changes something, not when the platform hands you a value.
- Remove in `destroy()` every listener added in `init`. Model-driven forms
  create and destroy controls as the user moves between records.

`context.mode.isControlDisabled` and `context.mode.isVisible` are how the form's
own state reaches the control. Honour both.

### The caret, and what actually moves it

A browser moves an input's cursor to the end when `value` is assigned
something **different** from what the box holds; the same string assigned
again leaves the cursor where it was (HTML's value setter). So the caret does
not jump because a control assigns unconditionally — it jumps because a
different value arrives while the user is typing. On a PCF form that value is
usually the platform's own **late echo**: every `notifyOutputChanged` comes
back as an `updateView` carrying what was written, and typing "pase laur" on a
real form produced passes carrying "pase laur", "pase lau", "pase laur"
(`pcf-address-autocomplete-azure`, 2026-09-13). A guard comparing the incoming
value with the latest one takes "pase lau" as the form's change, writes it into
the box, drops the `r`, and moves the cursor to the end.

The guard that holds: **remember every value this control wrote recently**
(bounded — 32 is far more than the lag measured) and treat an incoming value
found there as an echo whatever its order; a value never written is the form's
— a script, a business rule, a refresh — and is taken, and the list starts
again. Both scaffolds carry it since `_template` 87173d2, and their suites stage
the reordered echoes with the rig's cursor model (see *The cursor, and typing
as a person does* in `pcfhub-new-control/references/verification.md`). A React control needs it on the class,
not only in the component: the class hands the value down as a prop, and the
component's resync effect puts whatever it is handed into the box.

### A value the control reformats as you type

A mask, a formatted number, anything that changes what the user typed: here
the value in the box changes on *every* keystroke, so the browser's cursor
always goes to the end and the control must put it back. `pcf-input-mask` is
the exemplar, and its design turned on three findings:

- **Let the browser edit, then read the edit back.** Cancelling `beforeinput`
  and redoing the edit covers typing and not much else: autofill fires no
  `beforeinput` at all, a composition's `beforeinput` is not cancelable, and
  undo is a path of its own. Comparing the field with the display the control
  last drew — anchored on the cursor, since the text after it is untouched —
  finds the changed run for every one of them, including which of two
  identical digits was typed.
- **Put the cursor back by counting content, not positions.** The display
  gains and loses literals as it fills (`(555` becomes `(555) 1`), so a display
  offset means nothing across a redraw; "after the third digit" does.
- **Leave a composition alone until `compositionend`.** Chromium fires the last
  `input` of a composition *before* `compositionend`, so a control reformatting
  on `input` rewrites the value under an open IME — and the Android keyboard
  composes every word.

And a delete that removes only a literal — Backspace just after `) ` — must
remove the character before it, or Backspace appears to do nothing.

**Undo is the one edit to cancel.** A browser's undo history matches the box
only while the browser is the one changing it; after a control's first
assignment Ctrl+Z fires `historyUndo`, changes nothing, and leaves the cursor
at 0 (measured on a model-driven form, 2026-09-28). The event is cancelable
there, so the control cancels `historyUndo`/`historyRedo` and steps through a
history of its own — a run of typing as one step, a paste or autofill as its
own, the history cleared when a value arrives from the form.

**Measured on a form (2026-09-28, `pcf-input-mask` P2/P3):** typing, paste
and Backspace arrive as `InputEvent`s with `inputType` and `data`; autofill as
a bare `input` with neither and no `beforeinput`; `preventDefault` on
`beforeinput` is honoured; and echoes arrive 120–430 ms after each write,
reordered at typing speed — the recent-writes guard caught one.

### A drag is one write

A control whose value moves continuously — a slider, a dial, a colour wheel —
writes when the gesture **ends**, not while it moves. Each write is an
OnChange in a canvas app, a business rule and a dirty flag on a form, and an
echo the control has to tell from the form's own change.

A native `<input type="range">` already draws that line: `input` fires while
the thumb moves, `change` once it is let go. Repaint on `input`, write on
`change`. Measured on a model-driven form (`pcf-number-slider` P8,
2026-10-03): **every key reaches a focused range** — arrows, Page Up/Down,
Home, End, nothing taken by the form (`defaultPrevented: false`) — and each
press fires `input` **and** `change`, so each press writes once and the
control handles no keys itself. Tab leaves.

**No throttle is needed at key-repeat speed.** The same probe wrote 30 values
about 47 ms apart: the form coalesced them into **one** `updateView` pass and
**one** OnChange, carrying the last value, with nothing reordered (P4). A held
arrow key is cheaper than it looks.

Two things follow for the code:

- **Hold the moving value apart from the committed one.** While a thumb
  moves, an `updateView` must not put the committed value back under the
  user's pointer; keep a `live` value per thumb, cleared on `change`.
- **A two-thumb range clamps on both events.** On `input` so the fill never
  turns inside out, and on `change` too — a key press on a focused thumb can
  arrive as `change` with the `input` already past. One of the two alone is
  caught only by a test that fires the other.

## React (virtual) controls

`control-type="virtual"`, and the class implements `ReactControl` rather than
`StandardControl`. The difference is that the control returns a React element
instead of writing to a container, and the platform attaches it to its own React
tree — which is what makes the bundle small and the styling consistent.

```ts
export class TagList implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    public init(context, notifyOutputChanged, state): void { /* no container */ }

    public updateView(context): React.ReactElement {
        return React.createElement(TagListControl, { /* props */ });
    }

    public getOutputs(): IOutputs { /* … */ }
    public destroy(): void { /* usually empty */ }
}
```

Notes:

- Do not import React or Fluent as bundled dependencies. Declare them as
  `<platform-library>` and keep them as devDependencies — otherwise the whole
  point is lost and the bundle carries a second copy of React.
- Fluent v9 components that render through a React Portal (dialogs, popovers,
  tooltips, menus) escape the host's theme context, so wrap the tree in a
  `FluentProvider`. **`context.fluentDesignLanguage` is typed as of
  `@types/powerapps-component-framework@1.3.18`** —
  `Context.fluentDesignLanguage?: FluentDesignState` at
  `componentframework.d.ts:792`, carrying `tokenTheme: Theme` — so no cast is
  needed. It is still absent from PCFHub's demo harness, so keep the
  `webLightTheme` fallback rather than rendering unthemed:

  ```ts
  const theme = context.fluentDesignLanguage?.tokenTheme ?? webLightTheme;
  ```

  Older 1.3.x releases did not declare it, which is why some controls still
  carry an `as unknown as` cast alongside a comment saying the property is
  untyped — `pcf-choices-picker/ChoicesPicker/index.ts:112-124` is the example.
  The cast is now redundant rather than wrong; the comment beside it is
  misleading. Verified by compiling `pcf-data-table`, which assigns `tokenTheme`
  straight to `FluentProvider`'s `theme` prop.

  A hand-rolled control needs the provider too, even with no portal and no
  Fluent component anywhere: `FluentProvider` is what emits the design tokens as
  CSS custom properties on its own wrapper, which is how plain CSS
  (`var(--colorNeutralStroke1)`) inherits the host's theme. Miss it on one
  return path — the loading branch, the empty branch — and that branch renders
  unthemed.

  **And the control's own stylesheet does not reach a portal either.** This is
  the same fact from the other side, and it is the half that gets missed,
  because the theme problem announces itself and this one does not. A portalled
  surface is attached near the end of the document rather than under the
  control's root, so every rule written the way the template teaches —

  ```css
  .ColorPicker .ColorPicker-option-secondary { … }
  ```

  — matches nothing inside it. Nothing errors, nothing warns, and the styles are
  simply absent. `pcf-lookup-search` shipped two dead rules this way and only
  found them by reading Fluent's source:
  `@fluentui/react-combobox/…/renderCombobox.js:22` is
  `state.inlinePopup ? <listbox/> : <Portal>…`, with `inlinePopup` opt-in — so a
  `Combobox` portals its listbox unless told otherwise, and so do `Dialog`,
  `Popover`, `Menu` and `Tooltip`.

  Put the class on the slot and lead the selector with it:

  ```tsx
  <Combobox listbox={{ className: 'ColorPicker-listbox' }}>
  ```
  ```css
  .ColorPicker-listbox .ColorPicker-option-secondary { … }
  ```

  Still namespaced, so it still cannot restyle the host page — just anchored to
  an element that exists. `inlinePopup` is the other way out and buys correct
  scoping plus a documented touch-screen-reader benefit, at the cost of being
  clipped by any ancestor with `overflow: hidden` — which on a form section is
  not a risk worth taking blind.

  **And a portalled list follows its field out of the form — close it.**
  Nothing clips a portal, and Fluent's positioning keeps it attached to its
  field wherever the field goes, so a form scrolled with the list open carries
  the list up over the form's header with its field gone beneath it. Measured
  on `pcf-lookup-search` 0.3.0, 2026-10-13: the header is *outside* the form's
  scroller (`tab-section0`), the field had scrolled to y 123 against the
  scroller's 286, and the listbox carried `data-popper-reference-hidden` and
  was drawn anyway. An `IntersectionObserver` on the field — no `root`, so the
  intersection is clipped by every scrolling ancestor — read 0 there. 0.3.1
  closes the list from it while open (`intersectionRatio < 0.5`, the typed text
  kept, a click reopens), feature-detected for a host without the API. A list
  that flips *above* a field in view overlays the header like any popover; that
  is fine. The same class as Code Editor's widgets under `<body>` (closed once
  the caret's line leaves the intersection of every clipping ancestor), and
  any control with an open portalled surface owes the same check.

  **Every kind of portalled surface does it, so the close is shared.**
  Measured across the catalogue on 2026-10-14: a Fluent `Popover`
  (`pcf-date-range-picker`), a Fluent `Menu` (`pcf-calendar-view`'s event
  menu) and a hand-rolled list lifted into a `<body>` layer (`pcf-tag-list`)
  all stayed drawn over the header with their anchor gone; the two Fluent
  ones carried `data-popper-reference-hidden` as well. Fluent's own
  `closeOnScroll` is no substitute: it closes on *any* scroll outside the
  surface, and which Fluent a model-driven host loads is the platform's
  choice. The template ships the close as `variants/lib/close-when-hidden/`
  — `useCloseWhenHidden(anchor, open, close)`, the anchor held in state —
  adopted by making `<Control>/lib/close-when-hidden` and running `sync-rig
  --into . --add-missing`. An uncontrolled `Menu` has to become controlled
  (`open` / `onOpenChange`) to be closed at all.

  **Focus goes back to the anchor before the close, with `preventScroll`.**
  A surface that takes focus — a `Popover` with `trapFocus`, a `Menu`, which
  focuses its first item — restores it to its trigger on close, and focusing
  an element scrolls it into view. The first build closed the date picker
  correctly and then the form jumped from scrollTop 491 back to 269, undoing
  the user's scroll. The hook focuses the anchor itself (`focus({
  preventScroll: true })`) when focus is not already inside it, so Fluent has
  nothing to restore; a combobox, whose focus never leaves the field, is
  untouched. **And a list closed while its input keeps focus cannot be
  reopened by `onFocus`** — give the input an `onClick` that opens it too.

  **Measured, 2026-09-23: it is clipped.** `pcf-tag-list` 0.3.0 hand-rolled its
  suggestion list as `position: absolute` under the field; on an Account form
  the searches went out and answered 200 and no list appeared, not even its
  "Searching…" row. The dev harness had no clipping ancestor and showed it
  fine. **Without Fluent, a portal is not free either:** `react-dom` is a
  platform external only behind pcf-scripts' `pcfReactPlatformLibraries` flag
  (`platformLibrariesHandler.js`), so `createPortal` means bundling a second
  ReactDOM.

  **And `position: fixed` inside the form is trapped too — measured the same
  day.** 0.3.1 placed the list fixed against the field, falling back to in-flow
  when an ancestor has a `transform`, `filter`, `perspective` or `contain` (any
  of which becomes the containing block of a fixed element). The Account form
  has such an ancestor above the subgrid: the list went in-flow and pushed the
  section open — working, and not a dropdown. **Nothing inside the form's tree
  is both unclipped and overlaid.** The platform's own lookup flyout escapes by
  living at the end of `<body>`, and so does 0.3.2's list
  (`components/placement.ts`): React renders it in place, and an effect **moves
  that one `<ul>` into a layer appended to `document.body`**, placed fixed
  against the field's `getBoundingClientRect()`, flipped above it when there is
  more room there, re-placed on scroll (capture) and resize. Three conditions
  make the move safe, and each is load-bearing:

  - **the moved node is never conditionally unmounted** — always rendered,
    toggled with `hidden` — so React only ever edits its *children*, which it
    does wherever the node lives; unmounting removes its ancestor in the form,
    and the effect's cleanup removes the layer;
  - **the moved node's pointer events are plain DOM listeners, not React
    props.** A React `onMouseDown` there works only where React hears events
    at `document` (React 16). **Measured on a real form, 2026-09-23: the
    platform's React delegates at the control's own container**, as React 17+
    does — `pcf-tag-list` 0.3.2's options floated, followed the field on
    scroll, and could not be clicked, while the React 16 harness clicked them
    fine. `addEventListener('mousedown' | 'mouseover')` on the moved node,
    reading the option from a `data-index` and calling through a ref refreshed
    every render, works under both; remove the React handlers or the React 16
    path fires twice. Model the host in the harness by stopping pointer events
    from the layer before `document`, and check it bites;
  - **the layer is outside the FluentProvider**, so copy the control's resolved
    custom properties (`getComputedStyle(root).getPropertyValue('--X-…')`) onto
    it on each open, and give it the control's root class so scoped rules match.

  Put both conditions in the harness as switches — `overflow: hidden` with a
  tight `max-height`, and a `transform` on the surface — and check with
  `elementFromPoint` at the list's centre and the section's height before and
  after, because a suite that renders without layout sees none of this.

- **A Fluent trigger clones its child, so do not put a button inside one.**
  `PopoverTrigger`, `MenuTrigger` and `DialogTrigger` add `role`, `tabindex`
  and `aria-expanded` to the element you give them. Wrap a real `<button>` in a
  styled `<div>` — the natural shape when the field surface carries the border
  and the button carries the click — and the result is **two tab stops for one
  control**: the div Fluent just made focusable, and the button inside it. It
  reads perfectly and is unusable with a keyboard.

  Make the surface *be* the button and hand that to the trigger. Declare neither
  `aria-haspopup` nor `aria-expanded` yourself; they are the trigger's to set,
  and duplicating them is how they come to disagree. Found on
  `pcf-date-range-picker` by reading the DOM, not by looking at it.

- `updateView` returning an element means React's own reconciliation handles the
  DOM. The caret problem from standard controls becomes a controlled-input
  problem instead: derive state from props rather than mirroring it, or accept
  the same guard.

**Hold user-driven state in React, not on the control instance.** On a real form
either works, because the platform re-renders after `notifyOutputChanged()`.
PCFHub's demo harness does not: its `notifyOutputChanged()` posts
`harness:outputChanged` to the parent window and neither calls `renderView()`
nor writes the value back into its `values` map. A control that renders straight
from `context.parameters` therefore looks completely dead in its own published
demo — every click accepted, nothing visibly changing. **And when the harness
does re-render** — a width change (a message line that grows the frame is
enough), a theme, a locale — it hands down the preset's value as it always was.
A standard control whose guard compares the incoming value with its own takes
that as the form's change and wipes what the visitor typed: measured on
`pcf-input-mask`'s demo 2026-09-28, where Backspace, then leaving the field,
reverted the value and took its *Incomplete* line with it. The guard is to
ignore **a value equal to the one the host sent last time** — a form never
repeats itself like that, since every write comes back as a new value. The
React scaffold always guarded on `lastIncoming`; the standard one does since
`_template` (28 Sep). Seed state from props and
resync on the **content** of the prop, since every `updateView` hands down fresh
objects and an identity-keyed effect would undo the user's click:

```ts
const [selected, setSelected] = React.useState(props.selected);
const incoming = props.selected.join(',');

React.useEffect(() => {
    setSelected(props.selected);
}, [incoming]);
```

That `eslint-disable react-hooks/exhaustive-deps` you are about to write needs
`eslint-plugin-react-hooks` installed, or the build fails with "Definition for
rule was not found" — which reads as a config error rather than a missing
dependency. `setup.mjs --framework react` adds it.

**Asynchronous results have to land in React state too, for a different
reason.** A control cannot make the platform re-render: there is no `refresh()`,
and calling `notifyOutputChanged()` to force one pushes an unchanged value at
the form and dirties it. So a class that awaits something — metadata, a query,
anything — cannot hold the answer and expect `updateView` to run again. Hand the
component the *promise* and let an effect own the result. `pcf-lookup-search`
passes down `prepare()` and `search(term)` for exactly this.

## Timers and teardown

A control that repaints on its own — a countdown, an SLA clock, a view that
polls — is the one shape where `destroy` carries weight, and `destroy` is the
lifecycle method with nothing visible riding on it. Nothing on a form tells you
it did nothing.

### What `destroy` owes

Three things, none of which the DOM cleans up for you:

- **Intervals and `requestAnimationFrame` loops.** They go on firing against a
  container the platform has already thrown away.
- **Listeners on `document` or `window`.** Unlike a listener on an element
  inside `container`, these are not collected with the subtree — and they hold a
  reference to the control, so nothing about it is collected either.
- **Anything else with a lifetime the DOM does not own**: an `AbortController`,
  a `ResizeObserver`, a subscription.

The cost is invisible until it is not: a form left open all afternoon, or a
subgrid re-rendering its rows, mounts and unmounts repeatedly and keeps whatever
the last pass did not release.

### Four rules, and each is a bug somebody shipped

**Arm in `init`, clear in `destroy` — never arm from `updateView`.**
`updateView` runs on every change to any bound value, including ones the control
caused itself, so a `setInterval` reached from the render path adds a timer per
render:

```ts
public init(context, notifyOutputChanged, state, container): void {
    this.timer = setInterval(this.paint, SECOND) as unknown as number;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
}

public destroy(): void {
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
}
```

**Clear before re-arming.** A control that changes its own cadence — repainting
every second while it is showing seconds and every thirty otherwise — has to
replace the timer, not run a second one beside it. Guard on the cadence actually
having changed, or the guard is the leak:

```ts
private arm(cadence: number): void {
    if (this.cadence === cadence && this.timer !== undefined) {
        return;
    }

    this.disarm();
    this.cadence = cadence;
    this.timer = setInterval(this.paint, cadence) as unknown as number;
}
```

**A tick must not call `notifyOutputChanged`.** It makes the platform re-read
the outputs and re-run the form's rules at the tick rate, for a control that
usually has nothing new to say. A display-only control should notify zero times
in its whole life — assert that, because it is easy to lose to a refactor.

**A tick must not read `context`.** `updateView` is handed a context for the
duration of the call; nothing promises the same object still describes the form
thirty seconds later. Take a plain snapshot in `updateView` of everything the
repaint needs — including any string from `resources.getString` and any date
formatted through `context.formatting`, both of which need `context` to produce
— and let the tick render from that snapshot and a clock reading alone.

Two more worth doing, neither of which is a correctness bug:

- **Pause while hidden.** `document.addEventListener('visibilitychange', …)`
  and disarm when `document.hidden`; repaint *before* re-arming on the way back,
  or the user returns to a stale number and waits a full cadence for it to
  correct itself. This is also the second thing `destroy` then owes.
- **Pause when `mode.isVisible` is false.** A clock nobody can see is a repaint
  nobody needs.

### Testing it

Real time makes this untestable: a countdown test waits a second to watch a
second pass, and a leaked interval takes an afternoon to show. `_template` ships
`dev/clock.js`, which installs a fake `Date`, `setInterval` and `setTimeout`
onto the global **before the bundle is evaluated** — `vm.runInThisContext`
shares the realm, so those are the ones the control closes over. No clock
parameter is threaded through the control, because production code should not
carry a seam whose only purpose is a harness.

The assertion worth having is generic and needs no knowledge of what the control
took:

```js
const timersBefore = time.pending();

mount({}).destroy();

check('destroy() releases every timer it took', time.pending() === timersBefore);
```

⚠️ **A suite that mounts and never destroys cannot assert this.** The abandoned
controls hold their own timers and listeners, so the counts include them and a
`document` event dispatched by the test reaches all of them. `pcf-sla-timer` hit
exactly this — four assertions failing for reasons that were about the harness —
which is the same leak the control is written to avoid, reproduced one file
away. Track live mounts and dispose them at each boundary.

## Bundle size

Moved to [bundle-size.md](bundle-size.md) on 15 Oct 2026, so each file can be
read whole:

- **Bundle size** — `standard` versus `react_virtual` is not a bundle-size decision · A library that is most of the bundle · Language features without a worker

## Markdown or HTML a user wrote

Anything a record holds was typed by whoever could write that row, so a
control that renders it renders untrusted markup. `pcf-code-editor` 1.6.0's
Markdown preview, measured in the harness and on the account form with probe
1.5.9 (its `SPEC.md`, 2026-10-09):

- **Reuse the sanitiser the bundle already carries.** Monaco's
  `renderMarkdown` (`monaco-editor/base/browser/markdownRenderer`, the one its
  hovers use) brings `marked` and a DOMPurify-based sanitiser, so the preview
  cost almost nothing. It is a deep import no public API promises: pin the
  library by the lock, type the module yourself, and re-check it on every
  upgrade. A library a control does not already carry is a size question
  first — *A library that is most of the bundle* above.
- **Sanitising after rendering is too late for anything that fetches.** The
  sanitiser hands back a fragment imported into the live document, and an
  `<img>` there starts loading whether it is attached or not: Monaco's default
  fetched a Markdown image, a raw `<img>` and a `<video>` from a third party
  before any code could strip them. **Decide media while the document is
  still tokens**: a `marked` `walkTokens` extension turned every image into a
  link, and only the ones allowed were drawn as `<img>` after sanitising,
  from sources kept beside the tokens; raw-HTML media were taken out of the
  sanitiser's tag list. Then the only request was the allowed image.
- **Allow images from the environment's own origin, and `data:`.** An image
  fetched when a record opens tells whoever hosts it who opened which record
  and when. The environment's origin is `page.getClientUrl()`'s; without one
  (canvas, the hub's demo) allow `data:` only. A web resource image loaded on
  the form by its relative and its absolute address. A refused image stays a
  link with its alt text, titled to say why.
- **What survived the sanitiser** with HTML on: headings, lists, task lists
  (checkboxes disabled), tables, quotes, code, `<details>`, `<kbd>`, `<sub>`.
  **What did not:** `<script>`, event handlers, `<iframe>`, `<style>`, `style`
  attributes, `<svg>`, `<form>`, `<object>`/`<embed>`, and `javascript:`,
  `data:` and `command:` links. A relative link is dropped too.
- **Links come back as `href=""` with the target in `data-href`.** Pass an
  action handler, always: it is what calls `preventDefault`, and without it a
  press reloads the page. Open the target with `openUrl` and the two-scheme
  allow-list of *`openUrl` has no failure channel, so validate before calling*
  in `navigation-and-events.md`; `mailto:` through `openUrl` did nothing on
  the form, so it renders as its text.
- **The renderer drops a link to `data:`**, so an allowed `data:` image
  carried as a link needs a placeholder href (`https://image.invalid/<n>`)
  until it is drawn.
