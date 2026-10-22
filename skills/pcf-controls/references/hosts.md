# The hosts a control runs in

Canvas, model-driven and Power Pages, and what each removes; updating a
control a canvas app already has; and asking the host for the screen.
Moved out of `rendering-and-hosts.md` on 2026-10-08 — a pointer that still
names that file for one of these sections is stale.

- [Canvas vs model-driven vs Power Pages](#canvas-vs-model-driven-vs-power-pages)
  - [A canvas app runs its own copy of the control](#a-canvas-app-runs-its-own-copy-of-the-control)
  - [Measuring a control inside a canvas app](#measuring-a-control-inside-a-canvas-app)
- [Full screen](#full-screen)

## Canvas vs model-driven vs Power Pages

Power Pages is the third host, and it is not a variant of the other two — it
removes things both of them have. A control that will run there is worth
checking against this column before it is written, because two of the rows
cannot be worked around.

| | Model-driven | Canvas | Power Pages |
| --- | --- | --- | --- |
| `Device.*` — all six | Yes, but see [Device APIs](files-and-device.md#device-apis) | Yes | **None supported** |
| `context.utils` (`Utility`) | Yes | No | **Not supported** |
| `context.navigation` — `openUrl` | Yes | Yes | Yes |
| `context.navigation` — `openForm`, `openFile`, `openWebResource` | Yes | **No** — there is no form to open | **No** |
| `context.navigation` — the three dialogs | Yes | **No** | **No** |
| `<uses-feature required="true">` | Allowed | Allowed | **Must not be `true`** |
| Property types | All | All | A restricted list — no `Lookup`, no `File`, no `Image` |
| WebAPI / Dataverse APIs | Yes | No — use connectors instead | Via its own APIs, not `context.webAPI` |
| Custom auth | Yes | Not supported | — |
| Lookup properties | Yes | No | No |
| A lookup **column in a dataset** | `getFormattedValue` gives the display name | Retrieves the whole referred record; `getFormattedValue` returns a **JSON string** and `getValue` a JSON object |
| Enabling | Solution import + form designer | Also needs **Code components for canvas apps** switched on in the environment |
| Sizing | Form section drives it — but see [Scrolling wider than the container](layout.md#scrolling-wider-than-the-container): `allocatedWidth` is needed here too. **A table main grid or related-records grid always reports `allocatedHeight: -1`** — see [The height a main grid never gives you](layout.md#the-height-a-main-grid-never-gives-you) | `allocatedWidth` / `allocatedHeight` on context, often `-1` until laid out |

That second row is the one that catches dataset controls, because it looks like
a rendering bug rather than a platform difference. A control that renders
`record.getFormattedValue(column.name)` — which is nearly all of them, since a
dataset gives no other way to show a value — reads "Dana Whitfield" on a form
and prints `{"id":…}` on every row in canvas. Nothing errors, and the control
that does it looks broken rather than mistyped.

So a `property-set` role that will be rendered as text should be typed
`SingleLine.Text` rather than `Lookup.Owner` or `Lookup.Simple`, unless the
control is model-driven only and says so. Lookup types are model-driven only in
any case — the framework's own lookup sample states it. `pcf-kanban-board`
declares its assignee role as text for exactly this reason, and documents that
a maker wanting the live owner must bind a text column carrying the name.

The three `context.navigation` rows are the ones that decide whether a *feature*
ships, rather than how it is written. A command whose only route is `openForm`
is model-driven only; one that has to confirm before acting is model-driven only
twice over, because canvas has neither the dialog to ask with nor the `webAPI`
to act with. The bag itself is typed non-optional and each method goes missing
separately — see [Presence is per method, not per
bag](navigation-and-events.md#presence-is-per-method-not-per-bag). `pcf-row-commands` draws two of its
three commands in canvas and three on a form, from exactly this table.

The `uses-feature` row is the one that decides an attribute rather than a
behaviour. Since Power Pages forbids `required="true"` outright, and since
`required="true"` on any host lacking the feature is component **load failure**
rather than degradation, `required="false"` plus a feature detect is the default
and `true` is the exception that needs an argument.

### A canvas app runs its own copy of the control

**Importing a newer solution updates the forms in an environment and no canvas
app in it.** A published canvas app serves the bundle from the app's own
package — the player fetches `<Namespace>.<Control>.bundle.js` from
`…/powerapps/appruntime/<app id>/…`, not the environment's
`cc_<Namespace>.<Control>/bundle.js` web resource — so the version in
`customcontrols` says nothing about what an app runs. Measured with
`pcf-date-range-picker` 0.3.1 → 0.3.2 in a developer environment (2026-10-07):
the environment held 0.3.2 and the published app went on serving 0.3.1's
24,591 bytes.

The route is Studio's **Update code components** prompt, which needs a higher
manifest version and an app **opened after the import**. Three things watched
the same day, each of which looks like the fix not working:

- **A Studio session that was open before the import cannot carry the new
  build.** With `pcf-copy-field` 0.2.0 → 0.2.2, an edit, Save and Publish in
  such a session published the edit and the old bundle together — 6,192 bytes
  before and after.
- **Opening the app again after the import brought the prompt**: "This app may
  contain unsafe code" (Open app), then "Update code components" (Update).
  **Neither list says what changed**: twice the prompt named the same two
  components and not the one with a new version (`pcf-input-mask` 0.1.1 →
  0.1.2 was the second), and the banner afterwards named every code component
  in the app as updated. Accepting it left **Save enabled** with no other
  edit, and Save then Publish moved the player to 6,513 bytes.
- **Studio's editor can draw the new build while the app still holds the old
  one.** With the picker, the editor showed 0.3.2's behaviour, Save was greyed
  out, and Publish published 0.3.1 — twice. Importing the control again from
  the Insert pane changed nothing. Changing a formula so there was something
  to save, then Save, then Publish, moved the player to 24,694 bytes. Whether
  a prompt had been shown and dismissed in that session is not known.

So, for a canvas app that already has the control:

1. Import the solution with the higher version.
2. Open the app in Studio **after** the import — reload a session that was
   already open — and accept the update.
3. Save, and see that there was something to save: a greyed-out Save means the
   app is unchanged whatever the editor draws. Change a formula if it is.
   Then publish, and wait for "Publish successful".
4. **Read the published app, not Studio.** Listen for the bundle's response
   and check its size or a string only the new build has, or bind a value the
   two builds display differently.

This is a step for `docs/migration.md` whenever a release changes what a
canvas app shows, because the maker who imported the fix and reopened the
player sees no change and concludes the fix does not work.

PCF is not supported on-premises at all. Say which hosts a control supports in
`docs/overview.md` and delete the `canvas.md` or `model-driven.md` page for the
host it does not — the paragraph that names supported hosts plainly is the one
that saves a reader twenty minutes. Where support differs *within* a host, say
that too: `pcf-geo-stamp` works on a model-driven form in the mobile app and
cannot record a location on the same form in a browser, and its overview leads
with that rather than burying it.

### Measuring a control inside a canvas app

A probe build that publishes a global (`window.__pcfKanbanProbe`) is easy to
call on a form — the control runs in the page. **In a canvas app it runs in a
cross-origin frame** (`runtime-app.powerplatform.com` under
`apps.powerapps.com`, and `authoring.*.powerapps.com` in Studio): the page's
own console shows the probe's `console.log` lines, and nothing on the page can
call into the frame. Opening the frame's address on its own does not work
either — the app never starts without its host page. What worked
(`pcf-kanban-board` 0.4.8, 2026-10-10): a test app holding the control,
**published**, and Playwright on the player with `frame.evaluate` in the frame
that answers the global — a small Playwright project of its own,
one interactive sign-in, then headless runs. Keep the harness outside the
control's repository: the saved session is a token.

Four things about the app itself:

- **The player URL takes Dataverse's `canvasappid`**:
  `https://apps.powerapps.com/play/e/<env>/a/<canvasappid>?tenantId=<tenant>`.
- **A role is a text property holding a column name** in canvas
  (`statusField = "statuscode"`), set on the Advanced tab — not the Fields
  pane, whose *Control type* lists only the column's own kind. And Studio may
  list two tables under one display name (a custom *Tasks* beside the
  activity one): check the columns before binding.
- **Studio's edit lock outlives a closed session by minutes**: reopening the
  app in a new session — to take *Update code components* — opened it
  read-only, "you already have editing control elsewhere", with no take-over.
  Wait it out before saving.
- **A saved Playwright session pins the app version.** After a new publish the
  player went on serving the first build — the control's URL carried the old
  publish's timestamp (`…/20261010T202615Z/PCFControls/…bundle.js`) — because
  the session file holds the player's `localStorage`, where it keeps the app
  version. Start the context with the session's **cookies only**
  (`storageState: { cookies, origins: [] }`) and the new build comes at once.
  Check which build ran by a string only the new bundle has, or its size.

## Full screen

`context.mode.setFullScreen(true)` asks the host for the screen, and the host
decides what that is: the form area on a model-driven form, a panel over the
screen in a canvas app, the browser window in the hub's demo. One control in
the catalogue calls it — `pcf-sparkline`'s Expand — and each rule below is
something its 0.1.0 shipped wrong, fixed in 0.2.0.

**It has no getter. The host tells you, in `updatedProperties`.** Nothing on
`context` says whether the control is in full screen. The call returns having
changed nothing; the host re-lays-out and calls `updateView`, and that context
names the transition as `fullscreen_open` or `fullscreen_close` — with the new
box in `allocatedWidth` and `allocatedHeight`, if `init` called
`trackContainerResize(true)`. Microsoft's canvas dataset tutorial (*Add full
screen support*) keeps its state from exactly that:

```ts
if (context.updatedProperties.indexOf('fullscreen_close') > -1) {
    this.isFullScreen = false;
}
if (context.updatedProperties.indexOf('fullscreen_open') > -1) {
    this.isFullScreen = true;
}
```

**Remembering what you asked for is not enough, because the host can leave
without asking.** A canvas app's full-screen panel has a close button of its
own, above whatever the control drew (seen 2026-10-02), and the hub's demo puts
an **Exit full screen** bar over the control for the same reason. Neither
calls anything on the control. `pcf-sparkline` 0.1.0 kept an `expanded` flag
from its own click, so after either it went on reading *Collapse*, at its
expanded height, until the button was pressed once for nothing. 0.2.0 corrects
the flag from `updatedProperties` and keeps its own request only where the host
names neither.

**The host's render is not yours, and it must not take the focus.** A standard
control that rebuilds its markup on every `updateView` has to put the focus
back on a button its own click destroyed — and then loses it one render
later, when the host calls `updateView` for the transition and the one-shot
flag is already spent. Before throwing the markup away, note which of the
control's *own* elements has the focus, and give it back afterwards; compare by
identity, so focus anywhere else on the page is left where it is. The same
loss is there for anything the user is holding when a refresh or a resize
arrives — a point being read with the arrow keys, in that control. A React
control that keeps the same element across renders does not have the problem.

**The height the host allocates is the control's, not its biggest part's.** In
full screen the host hands over a real `allocatedHeight`, and a canvas app does
for any box a maker drags. `pcf-sparkline` 0.1.0 gave all of it to the chart,
so the title above and the readout below were outside the box: with 160px
allocated the control was 208.8px tall. Expanded, it ignored the number and
used `70vh`, a guess measured off the window, and a canvas full-screen panel is
smaller than the window — which is where the readout was seen cut off
(2026-10-02). Take the control's own chrome out of the allocation, and keep a
viewport guess only for a host that gave no box:

```css
.Sparkline-plot--boxed {
    height: max(24px, calc(var(--Sparkline-box) - var(--Sparkline-chrome)));
}
.Sparkline--fullscreen .Sparkline-plot:not(.Sparkline-plot--boxed) {
    height: 70vh;
}
```

`--Sparkline-chrome` is a `calc()` of the same lengths the head, the readout
and the gaps are sized with, so the three cannot drift — and a part counted
there has a `height`, not a `min-height`. The rig's DOM measures nothing, so
the suite can only assert that the number is handed over as a box; that the
control then fits is a browser's to show, and the hub's demo is one.

**Feature-detect it, and do not name a host that lacks it.** The method is
typed as always present, which is a claim about the type definitions. But "a
canvas app has no `setFullScreen`" was written into four pages of that
control's docs and into the template's rig without anybody having looked, and
Microsoft's reference lists the call for model-driven apps, canvas apps and
portals. No host is known to lack it. The fallback for one that does is to
grow in place — never `position: fixed` from the control, which escapes the
form's stacking context, covers the command bar and takes an Esc key it cannot
promise to receive.

**`destroy()` hands it back.** A control destroyed while holding full screen
calls `setFullScreen(false)` first; the platform has no reason to take it back
on its own.

**In the rig.** The dataset rig answers the call the way the platform does: the
next context names the transition, and the call owes a render, so `settle()`
is the host's re-render. `handle.closeFullScreen()` is the host leaving by
itself, and `quirks.hasFullScreen: false` removes the method. The assertions
worth having are after `settle()`: the button's label, and where the focus is.

**On the hub.** The demo honours the call since 2026-10-02: it covers the
browser window, re-renders the control with `layout` and `fullscreen_open` in
`updatedProperties` and a real `allocatedHeight`, and sends `fullscreen_close`
when the visitor leaves by its bar. A demo limitation that says Expand cannot
take over the page is out of date. `docs/demo-harness-full-screen.md` in the
hub's repository has the detail.

**Not measured.** What a model-driven form does with the call, and what a
canvas app actually hands over in `updatedProperties` and the allocated box.
The canvas panel was seen; its context was not read back, so "the panel's
height arrives as `allocatedHeight`" is Microsoft's tutorial speaking.
