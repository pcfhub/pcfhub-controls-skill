# Accessibility

What a control owes a keyboard and a screen reader on a model-driven form: the
Tab the form keeps, a tree or list of its own with one tab stop and the
WAI-ARIA keys (the template's `lib/tree-keys`), and live regions.

Split out of `styling-and-accessibility.md` on 15 Oct 2026, so each file can be
read whole.

- [Accessibility](#accessibility)
  - [A model-driven form keeps Tab](#a-model-driven-form-keeps-tab)
  - [A button that is working keeps focus](#a-button-that-is-working-keeps-focus)
  - [A tree or a list of your own: one tab stop, arrows inside](#a-tree-or-a-list-of-your-own-one-tab-stop-arrows-inside)
  - [Live regions: announce the change, not the value](#live-regions-announce-the-change-not-the-value)

## Accessibility

The hub publishes these controls to people who will put them on production
forms, so keyboard and screen-reader support is table stakes rather than polish.

- Every mouse interaction needs a keyboard equivalent. A chip with a mouse-only
  remove button is unusable without a pointer.
- Manage focus explicitly when the control changes what is on screen — opening
  a picker, removing the focused item.
- Use real semantics (`button`, `input`, `role`, `aria-label`) rather than
  clickable `div`s. Fluent components already do this; hand-rolled DOM does not.
- Respect the host theme rather than hard-coding colours, or the control will
  fail contrast in dark mode and in themed environments. *Styling* above is how:
  Fluent's tokens with literal fallbacks, and the dark set chosen from
  `fluentDesignLanguage.isDarkTheme` rather than from the operating system.
- A focus indicator on every tab stop, and the right one for where it sits —
  Fluent's underline inside a field surface, its two-ring outline anywhere else.
  `:focus-visible`, so a mouse click leaves nothing behind.
- An icon-only control carries `aria-label` **and** `title`. The label is for
  anything that reads text; the tooltip is for the sighted user who does not
  recognise the glyph, and neither substitutes for the other.
- Anything that means something by colour has to mean it another way too — a
  word, an icon, a shape. Three coloured states with no labels are three
  identical states under `forced-colors: active`, where every tint collapses to
  a system keyword.

### A model-driven form keeps Tab

On a model-driven form, Tab never reaches a control: the form moves focus to
the next field first. Measured on the Accounts form with `pcf-code-editor`'s
1.3.11 probe (2026-09-26) — a key log inside the editor recorded the Space
pressed after Tab and nothing for the Tab, while focus had moved on. So on a
form:

- **Never make Tab do something inside the control** — take a suggestion,
  indent, move between cells. Give it another key (Enter takes a suggestion)
  and say so in the docs.
- **A "release Tab" switch has nothing to release.** Monaco's `Ctrl+M`
  toggled a mode no Tab ever arrived to use.
- **The dev harness lets Tab through**, so it cannot show this; only the form
  can. In a canvas app it is unmeasured.

That is also the accessible default: Tab moving between fields is what a
keyboard user of a form expects.

### A button that is working keeps focus

**Do not set `disabled` on the button the user just pressed while its work
runs.** A focused element that becomes `disabled` is blurred — focus goes to
`BODY` — and enabling it again gives nothing back, so a keyboard user who
pressed Enter starts again from the top of the page. Measured on the account
form with `pcf-form-action-button` 0.2.0 (2026-10-28, its SPEC.md W8): Enter on
the focused button, the action's call, and `document.activeElement` was `BODY`
from then on. 0.1.0 had shipped the same fault in its `setBusy()` and while
its confirmation dialog was open, and no assertion could see it — the suite's
DOM does not blur, and nobody had pressed it with a keyboard on a form.

While it works — a call in flight, a dialog open, a handler busy — mark the
button `aria-disabled="true"`, keep it focusable, and refuse the press in the
click handler by state, which a single-flight control already does:

```ts
const working = this.phase === 'asking' || this.phase === 'busy';

this.button.disabled = !this.hostInteractive;      // cannot be used at all: disabled proper
if (working && this.hostInteractive) {
    this.button.setAttribute('aria-disabled', 'true');
} else {
    this.button.removeAttribute('aria-disabled');
}
```

Style the busy look from a class, not from `:disabled`, so it does not depend on
which of the two the state uses. Keep `disabled` proper for a button that cannot
be used at all — a read-only form, a missing privilege, a configuration that
cannot run: there is no press in flight to come back to. And the platform's own
dialog then hands focus back on close — measured on the same form, Enter on the
dialog's button returned focus to the control's.

**When the blur happens, and why a rig hides it.** Measured in Chrome 152
(2026-10-29): straight after `button.disabled = true` the button is still
`document.activeElement`. Two animation frames later it is not, and setting
`disabled = false` gives nothing back. So a write that settles inside one
frame never shows the bug, and every rig answers that fast. `pcf-tag-list`'s
harness kept focus on a disabled add box until its writes were slowed to
400 ms; then focus went to `BODY`, as it does on a form. Slow the rig's writes
before you press, as `pcf-tag-list`'s `dev/focus.js` does: wrap `fetch` and
the context's `webAPI`.

**In React:**
- **A Fluent `Button`** takes `disabledFocusable`, which renders
  `aria-disabled="true"` and swallows the click.
- **A plain `<button>`** takes `aria-disabled={busy || undefined}`, and its
  handler returns early.
- **A text box that starts the work on Enter** is `readOnly` (with
  `aria-busy`), not `disabled`. `pcf-tag-list` 0.5.4's add box is the example.
- **Draw the busy look from `[aria-disabled="true"]` as well as `:disabled`.**
- **A suite's Fluent stand-in that copies props onto a `<div>` must turn
  `disabledFocusable` into `aria-disabled` itself.** React drops an unknown
  boolean attribute, so as passed, nothing renders and no assertion can see
  it (`pcf-audit-history` 0.2.1).

**A control that leaves with its own action takes focus with it**, a chip's
remove or a row's delete, and the browser puts focus on `BODY`. Decide the
neighbour when it is pressed (the next item, else the previous one, else the
add box), and once it is gone, focus that neighbour, but only if
`document.activeElement` really is `BODY`. A user who clicked elsewhere in the
meantime keeps their place. `pcf-tag-list` 0.5.4: measured `body` before,
"Remove Bug" after.

### A tree or a list of your own: one tab stop, arrows inside

A control that draws many choosable things of its own — a tree, a list of
rows, a grid it renders itself — is a *composite widget*, and the keyboard
contract is the WAI-ARIA pattern's, not a tab stop per row. Tab reaches the
widget once (and leaves it once — the form keeps Tab anyway, above); the
arrows move inside it. A tree of forty thousand nodes with forty thousand tab
stops is a page nobody can leave.

**The keys a form lets through.** `pcf-code-editor`'s 1.6.9 probe put a
focusable `role="tree"` element inside the control on the account form and
pressed every key the pattern uses (2026-10-11): ↑ ↓ ← → Home End Enter Space
`*` a letter Ctrl+C F2 Escape. Every one reached the element's own listener
and bubbled back to the window; none arrived prevented, nothing scrolled, no
dialog opened, the record stayed unchanged. So the whole pattern is available
on a form — and the control has to `preventDefault()` the keys it takes, or
Space and the arrows also scroll whatever is scrollable. Leave the rest alone:
Escape, F2 and every shortcut but the widget's own are the host's.

**The tree's map** (APG *Tree View*), as `pcf-code-editor` 1.7.0 ships it:

| Key | Does |
|---|---|
| ↓ ↑ | Next / previous row on show |
| → | Opens a closed node; on an open one, to its first child; on a leaf, nothing — but still taken |
| ← | Closes an open node; otherwise to its parent |
| Home, End, Page Up, Page Down | First, last, a page |
| `*` | Opens every sibling that can open; focus stays |
| Enter | The row's action (for Code Editor: back to the node's text) |
| A printable character | Type-ahead on names, the buffer reset after ~500 ms of quiet; one character searches from the *next* row, a growing buffer from the current one |
| Space | Taken and does nothing in a single-select tree — selection follows focus, and untaken it scrolls the scroller a page under the focus |

Write it as a pure function — `(rows, focus, expanded, key) → { focus,
expanded, action, handled }` — so the suite proves the map, and let the
control only apply the answer. `handled` is what decides `preventDefault`.

**It is written once, in the template:** `lib/tree-keys` (`keys.ts`,
`typeAhead.ts`), adopted by making `<Control>/lib/tree-keys` and syncing. It
works over the rows a control draws, reduced to `{ id, level, expanded, name }`
(`expanded` `undefined` for a node that cannot open), and answers the new
focus, **the ids to open and close** — so a reducer-driven React tree and a
`Set` in a DOM control both apply it — an `activate` or `copy` action, and
`handled`; `nextBuffer()` is the type-ahead's 500ms buffer as a pure
function. The template's verifier tests it from source. `pcf-code-editor`
(DOM, windowed) and `pcf-hierarchy-view` 0.3 (React, a tree and an org chart
over the same rows) both run on it; the second's `tree/keyboard.ts` shows a
control's own affordances put on keys the pattern already has — `*` under an
ancestor showing one branch loads the rest of the family, → on a node whose
children could not be read retries.

**A press inside the widget must not take the focus.** A button inside a row
with `tabIndex={-1}` is out of the Tab order but **still takes focus on
mousedown** — and when it unmounts, as a *Show all* does once pressed, focus
falls to the page and the arrows stop (`pcf-hierarchy-view`'s walkthrough on
the form, 0.3.0). On the row's mousedown, `preventDefault()` and focus the
widget with `{ preventScroll: true }`; the button's click still fires.

**Draw the ring with `:focus-visible` on the widget**, on the active row —
`.tree:focus-visible .row--active { outline … }` — not from a React focus
state: a click focuses the widget without a ring, as Fluent's own tree does,
and the ring follows the keys. A state set from `onFocus` also never sets in a
page whose window has no focus, which is every automated screenshot.

**`aria-activedescendant`, not a roving tab index, once rows are windowed.**
The two ways to say which row has focus:

- **Roving tab index** — the focused row has `tabindex="0"`, the rest `-1`,
  and `.focus()` moves with the key. Right when every row is in the DOM.
- **`aria-activedescendant`** — the scroller is the one focusable element and
  names the focused row's `id`; rows are never focused. **Required when only
  the rows in view are drawn**: focus on a row that scrolls out of the window
  is focus on a removed node, and the browser drops it to `<body>`.

Window as soon as the count can be large. The same probe drew rows off-screen
on the form: 500 in 12–15 ms, 2,000 in 36–40 ms, **10,000 in 167–177 ms**, all
43,206 of a 1 MB document in up to 901 ms. Fixed-height rows, absolutely
placed on a track as tall as all of them, and a window of the ones in view
plus a few either side — arithmetic, not measurement (`treeWindow.ts`). Size
the window from the height the control *set*, not `clientHeight`: a form tab
not yet shown reports 0.

With `aria-activedescendant`, each drawn row carries what the browser can no
longer work out from a nested DOM:

- `role="treeitem"` (or `option` / `row`) and an `id` **unique per
  instance** — two copies of the control on one form share the page, so prefix
  the ids with a per-instance counter.
- `aria-level`, `aria-setsize`, `aria-posinset` — a flat or windowed list
  has no nesting to infer them from.
- `aria-expanded` on rows that can open, and **only** on them: `false` on a
  leaf announces a node that cannot open.
- `aria-selected="true"` on the focused row where selection follows focus.
- An `aria-label` when the visible text is punctuation — `{3}` reads as
  "left brace three right brace"; *3 keys* does not.

**A strip that echoes the focus is not a live region.** A status line under
the widget that shows where focus is (a path, a description) must be
`aria-hidden` if it sits in a `role="status"` — otherwise every arrow is
announced twice, once by the tree and once by the strip. Announce events
there (*Copied*), not position (*Live regions*, below).

**Prove it with real keys.** `dev/dom.js` models no `keydown` and no bubbling,
so the suite cannot show the listener is on the focused element, that the
default was stopped, or that `aria-activedescendant` moved. `dev/keys.js`
(the template's) presses keys through the DevTools protocol against the
harness — `press(chrome, 'ArrowRight')`, `type(chrome, 'st')`,
`focused(chrome)` for where focus is and what it points at. Code Editor's
`dev/keys-walk.js` (`npm run keys`) is the worked example: it serves the
harness, clicks Tree, walks every key, and asserts the row named, the strip,
and what Enter selected in the editor. The desktop app's browser pane sends
Shift+8 as `8` and its own `*` with an empty `key`, so press `*` through
`keys.js`, not the pane.

**Not yet heard.** Nobody has run Code Editor's tree under Narrator or NVDA;
the markup above is the pattern's, not a measured reading. A control that
ships one should say so in `SPEC.md` under *Not verified*.

**Rows on a CSS grid: a `role="row"` wrapper with `display: contents`.** A
layout that places every cell on one grid — a timeline's label, its day
cells and its bar, each with an explicit `grid-row` — has no element per
row, so a `role="grid"` around it holds cells and no rows. Wrap each row's
cells in an element with `role="row"` and `display: contents`: the wrapper
lays out as nothing, its children stay items of the one grid, and the
tree has its rows. `pcf-calendar-view` 0.4.0 does this for the timeline,
the header row of days included. Three rules came with it:

- **`treegrid` only when the rows on screen are a tree.** `aria-level` is
  not allowed on a `grid`'s rows, so a timeline whose rows nest by a Parent
  is a `treegrid` with `aria-level` and `aria-expanded` on each row — and a
  range with no parent in it stays a `grid` with no indent, so binding the
  role changes nothing until there is a tree to show.
- **A drawing says nothing a row does not.** Dependency arrows are an
  `aria-hidden` SVG laid over the grid; each row's header carries the same
  fact in words (*After ‹name›*, visually hidden where the arrow is drawn,
  and on screen where it is not, or *Starts before ‹name› ends* in red).
- **A move's consequence is an event.** A move that puts a task before its
  predecessor's end is announced once in the polite region below (*‹task›
  now starts before ‹name› ends*); the red on screen is state and is not.

Not heard under a screen reader either: the structure was read back from the
DOM on a model-driven form, not listened to.

### Live regions: announce the change, not the value

`aria-live="polite"` on anything that updates by itself is the reflex, and on a
value that changes often it is the bug. A countdown wired that way is read to a
screen-reader user once a second, which makes the rest of the form unusable.

The distinction worth holding: **a live region should carry events, not state.**

- **A value that ticks** belongs in `role="timer"` — a live region whose
  implicit `aria-live` is `off`, so the element is identified as a timer and
  nothing is announced as it counts.
- **A transition between meaningful states** — on track → due soon → overdue,
  saved → failed, 3 of 10 → 4 of 10 when the user asked for it — belongs in a
  separate visually-hidden `aria-live="polite"` element, written *only* when the
  state actually changes.
- **Not on first render.** A control appearing on a form is not a change to
  anything. Seed the "last announced" state silently and announce from the
  second value onwards.

Hide the polite region with the clip-rect idiom, not with `display: none` or
`visibility: hidden` — both remove it from the accessibility tree along with the
layout, which is the usual reason a live region is silent:

```css
.control-announcer {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
}
```

`pcf-sla-timer` is the worked example of the pair.
