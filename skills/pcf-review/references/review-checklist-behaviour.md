# Review checklist — part two: control behaviour

Section 6 of the [review checklist](review-checklist.md), kept in a file of its
own because it is the longest: what the control does at runtime, across every
host and shape. Work through [review-checklist.md](review-checklist.md) in
order; it sends you here between sections 5 and 7, and back.

## 6. Control behaviour

- [ ] `updateView` does not do expensive work unconditionally. It runs on every
      change to any bound value, including ones the control caused itself.
- [ ] An incoming value is ignored when it is one of the control's own recent
      writes, not only its latest: the platform echoes out of order, and a
      single-value guard takes a late echo — the characters typed after it are
      lost and the caret jumps to the end. The suite stages it by typing in
      the *middle* and updating with the echoes newest first. See *The caret,
      and what actually moves it* in `pcf-controls/references/rendering-and-hosts.md`.
- [ ] A control that rewrites `input.value` while the user types puts the
      caret back itself, counted in content rather than display positions,
      and leaves a composition alone until `compositionend`.
- [ ] DOM is built in `init` and mutated in `updateView`, not recreated.
- [ ] `destroy()` removes every listener `init` added, and any timer, observer,
      or subscription. A listener on `document` or `window` is the one that
      matters most: unlike one on an element inside `container`, it is not
      collected with the subtree, and it holds a reference that keeps the whole
      control alive. Assert it — count timers and document listeners before
      `init` and after `destroy()`, which `_template`'s `dev/clock.js` and
      `dev/smoke.js` now do generically.
- [ ] `notifyOutputChanged()` is called on user-driven change, not on
      platform-driven update.
- [ ] Every `ConditionOperator` the control sends is a case in the rig's
      `holds()`. An unmodelled operator **passes by default** there — so a
      filter that filters nothing on the platform reads as green in `smoke.js`
      — and that is how `pcf-data-table` carried a date filter that narrowed
      nothing until the three date cases were added. Read the rig's switch
      against the control's operator constants, and prove the case with a
      mutation: remove it and a row count should move.
- [ ] A control that reads `getEntityMetadata` reads the option list from
      **both** routes the node carries — the value-keyed `OptionSet` map and
      the `attributeDescriptor.OptionSet` array — not from `OptionSet.Options`,
      which was `undefined` on a live node. A parser reading one route is
      caught only by a rig fixture that serves the other; the template's does.
- [ ] A control whose content can exceed its container calls
      `context.mode.trackContainerResize(true)` in `init` and pins itself to
      `allocatedWidth`. `overflow-x: auto` alone is clipped rather than
      scrollable under a shrink-to-fit parent, and no CSS written inside the
      control can fix it.
- [ ] A scrolling element is keyboard reachable: `tabIndex={0}` and a `role`,
      or the content past the edge cannot be reached without a mouse.
- [ ] A table with `position: sticky` cells is `border-collapse: separate` with
      `border-spacing: 0`. Under `collapse` the borders belong to the table, so
      a pinned column loses its rules whenever the table is scrolled. Its sticky
      cells also carry an opaque background **and** restate the row's hover and
      selected colours, or the pinned column stays pale down a highlighted row;
      its sticky offsets are pixels, not the `<colgroup>`'s percentages — and
      the loose columns beside them are pixels too, never `calc(% - px)` on a
      `<col>`, which a browser ignores and draws as equal shares; and the
      pinning is clamped against `allocatedWidth` so a phone-width host is not
      left with a sliver of moving table.
- [ ] A control that lays content out in a **measured** width takes
      `Math.min(clientWidth, allocatedWidth)`, measures nothing where
      `allocatedWidth` is `-1` or `0`, and fills at least the width it laid out
      in. On a shrink-to-fit form section the box is sized by the content, so a
      measurement used outright is a loop: white space as it shrinks, "Error
      loading control" as it grows. Check it in a `fit-content` host
      (`pcf-data-table`'s `?fit=1`); a block-parent preview never loops.
- [ ] A resizable column moves only itself: every other column keeps the width
      it drew before the drag, and the slack goes to the column that is always
      last. Drag the third column narrower and confirm the first two did not
      widen — the handle should end under the pointer.
- [ ] A control that **writes** rolls back or surfaces the failure. An
      optimistic update with no `.catch()` leaves the UI asserting something
      about the record that is not true, and the user has no way to tell.
      `pcf-tag-list` had none through 0.2.x; 0.3.0 puts every failure under the
      control as the server's sentence, and its suite fails on any unhandled
      rejection.
- [ ] A dataset control that writes a column on a row it already holds uses
      `record.setValue()` + `record.save()` rather than `webAPI.updateRecord`.
      The former needs no `<uses-feature>`; the latter costs an install-time
      prompt on every environment and is model-driven only. **Unless the column
      is the maker's to choose** — a `property-set` role can land on
      `statuscode`, which `isEditable` refuses and the Web API writes — in
      which case the control takes both routes, decided per record by
      `isEditable`, and keeps `WebAPI` declared `required="false"`
      (`pcf-kanban-board` 0.3.0).
- [ ] A write that can land on `statuscode` sends `statecode` beside it when
      the reason's `State` differs from the record's — the server refuses a
      bare reason from the other state with a message naming neither
      (`2147779592`, measured 2026-09-29). The state is on the descriptor
      option; a `statecode` write sends the state's `DefaultStatus`
      (`pcf-kanban-board` 0.4.0, *Writing a Status Reason*).
- [ ] Anything compared with a Choice read off a record goes through one
      normaliser: `getValue()` is the string `"3"` on a form, and `===`
      against a number never matches (`pcf-kanban-board` through 0.3.5).
- [ ] Editability is asked for, not assumed: `record.isEditable(column)` before
      offering an editor. It is **async** — as are `isSecured`, `isReadable` and
      `getFieldRequiredLevel` — so an unawaited call returns a truthy Promise and
      every column looks editable. None of them is in the typings.
- [ ] A local override applied over fetched data is retired when the refreshed
      data agrees **and** when the record leaves the view. Retiring it when the
      write's promise resolves is too early; the dataset has not re-read yet.
- [ ] `uses-feature required="true"` is only used where the control is useless
      without the feature. On a host that lacks it the component **fails to
      load**, so a control that could degrade should declare `required="false"`
      and feature-detect instead. `WebAPI` is absent in canvas apps.
- [ ] A React control holds user-driven state in React, not only on the control
      instance. The hub's harness does not re-render on
      `notifyOutputChanged()` — it posts the outputs to the parent and writes
      nothing back — so a control rendering straight from `context.parameters`
      works on a form and looks completely dead in its own published demo.
- [ ] `context.mode.isControlDisabled` and `isVisible` are honoured.
- [ ] Dataset controls check `ds.loading` before rendering, find property-set
      columns by `alias` (the manifest role name), and read record values with
      `getFormattedValue(column.name)` (the real bound column). Backwards, the
      control renders zero rows against real data and nothing errors — and a
      fixture using the same string for `name` and `alias` hides it in the
      demo.
- [ ] **No dataset mutator is called unconditionally from `updateView`.**
      `setPageSize()` needs a `refresh()` to take effect and `refresh()` fires
      `updateView`, so an unguarded pair spins forever on a real form. The guard
      is on a control-instance field, not on `ds.paging.pageSize` — that does not
      equal the requested value until the refresh lands.
- [ ] `loadNextPage()` is called with `true` if the control pages. Bare, it
      returns "results for the whole page range" and `sortedRecordIds`
      accumulates — infinite scroll, not paging, and a table that grows instead
      of turning.
- [ ] `paging.totalResultCount` is checked for `-1` before being printed. The
      platform returns it when it did not count.
- [ ] `sortedRecordIds` is not sliced to a page size in the browser. It already
      *is* the current page, and slicing hides records the platform paged for.
- [ ] Sorting goes through `dataset.sorting` and `refresh()`, not a client-side
      sort — which would reorder 25 rows out of 240, a wrong answer that looks
      right. The array is replaced rather than appended to, paging is reset, and
      `column.disableSorting` is honoured.
- [ ] `setSelectedRecordIds()` is called on selection change, not just tracked
      internally: on a model-driven subgrid it is what tells the command bar
      which records the ribbon acts on. The control keeps its own copy too,
      because the platform's does not survive a refresh or a page change.
- [ ] No use of `context.webAPI.execute` — it does not exist. Only
      `createRecord`, `deleteRecord`, `updateRecord`, `retrieveRecord`,
      `retrieveMultipleRecords`. A Web API *function* (a GET) is fetched
      same-origin instead — see *Calling a Web API function `context.webAPI`
      cannot* — and an *action* (a POST) is a limitation to record.
- [ ] Every same-origin `fetch` of the organisation URL goes through **one
      helper** sending `Accept`, `OData-MaxVersion`, `OData-Version` and
      `credentials: 'same-origin'` (plus `Prefer: odata.include-annotations="*"`
      only where annotations are read), and a non-2xx answer lands in a named
      state the control shows, never a thrown error.
- [ ] A control reading audit history reads it through
      `RetrieveRecordChangeHistory` one page at a time — every detail carries
      its `AuditRecord`, whatever Learn says — and never pages the `audit`
      table by `maxPageSize`, which that table ignores.
- [ ] A documented "the API does not return X" that the design rests on was
      put to the form as a probe question before the design was built.
- [ ] Any `deleteRecord(ds.getTargetEntityType(), id)` used as a "detach" is
      bound to an explicit junction entity. On a native N:N's virtual view that
      call deletes the related record itself, environment-wide — silent and
      destructive. Detach a native N:N with a `$ref` DELETE instead (see
      *Linking records over a many-to-many*), and assert the absence of
      `deleteRecord` in the suite, not just the presence of the right call.
- [ ] A control that decides *which relationship* a subgrid shows reads it from
      metadata and asks the maker when there is more than one. The subgrid does
      not report it, and one pair of tables can hold an N:N and a lookup at once.
- [ ] Every irreversible action is confirmed before it runs — `openConfirmDialog`
      where the host has it, or an inline two-step arm like `pcf-action-button`'s.
      A destructive command is opt-in (`showDelete`, not `hideDelete`) and its
      handler is guarded, not just its button: `disabled` stops a browser
      dispatching a click and stops nothing else.
- [ ] `openConfirmDialog`'s **cancel is read from `response.confirmed`, not from
      the promise settling.** It resolves either way. A `.then()` that acts
      without reading the flag destroys what the user just declined to destroy;
      a `.catch()` that treats the cancel as failure shows an error for a
      deliberate no.
- [ ] Each `context.navigation` method is feature-detected **separately**. The
      bag is typed non-optional and its members go missing independently —
      `openUrl` everywhere, `openFile` and the dialogs model-driven only — so one
      check followed by four calls passes on the host it was written on and
      throws on the next.
- [ ] A URL that came out of a record is scheme-checked before `openUrl`. It is
      untrusted input, `openUrl` returns `void` so there is no failure to catch,
      and the check is an allow-list of `http`/`https` rather than a block-list
      that forgets `data:`.
- [ ] `openErrorDialog`'s **`message` carries the reason** — the control's
      sentence, then the server's, shortened — because the dialog shows nothing
      else: `details` goes only into *Download Log File* (measured 2026-10-16).
      Any test asserts the server's sentence is in `message`, not merely that
      `details` was decoded.
- [ ] A command whose host support is partial **hides rather than fails**. Check
      what the control does with `context.webAPI` or `context.navigation`
      missing: a button that throws on press is a bug report, an absent one is a
      documented host difference — and `docs/canvas.md` says which.
- [ ] Errors from `webAPI` and `context.device` are handled with a visible
      state, not swallowed. A `.finally` without a `.catch` turns a mistyped
      column name into a no-op the user cannot see.
- [ ] The device error handler survives `null`. `getCurrentPosition` is
      documented to pass `null` to its error callback on an older mobile client,
      so a handler beginning `error.message` throws *inside the catch* — the
      failure handler fails and the control hangs on its busy label.
- [ ] A device API that is **absent** is told apart from one that **refused**.
      `required="false"` means the platform may omit the member entirely, so
      `typeof context.device?.method === 'function'` is the guard, and "not
      available on this client" is a different sentence from "that did not
      work". Only one of them is actionable.
- [ ] `getCurrentPosition` is not assumed to work on a model-driven form in a
      browser. It is documented for canvas apps and the mobile client only.
- [ ] `position.timestamp` is not treated as a `Date`. It is typed as one and
      documented as a DOMTimeStamp — a number — so `.toISOString()` compiles and
      throws.
- [ ] `captureImage` is read as **one** `FileObject`, not an array. Only
      `pickFile` returns many.
- [ ] That visible state shows the *message*, not the object. `context.webAPI`
      rejects with a plain `{ errorCode, message }`, so
      `error instanceof Error ? error.message : String(error)` renders the
      literal `[object Object]` — which satisfies the item above while telling
      the user nothing, on every webAPI failure.
- [ ] A `$filter` built from typed text doubles the single quote *first* and
      URL-encodes *second* — `encodeURIComponent(term.replace(/'/g, "''"))`.
      Either rule alone is silently wrong, and the wrong order produces `%27%27`,
      which matches nothing rather than erroring.
- [ ] Maker-supplied column names are validated as logical names
      (`/^[a-z][a-z0-9_]*$/`) before being interpolated into a query. Free text
      in a URL is how a search box becomes a different request.
- [ ] A request whose response can be overtaken is retired rather than raced —
      an effect-scoped flag or a sequence number. `webAPI` returns a bare promise
      with nothing to abort, so a slow earlier search will otherwise repaint over
      a newer one.
- [ ] Formatting goes through `context.formatting` and strings through
      `context.resources.getString`, so the control matches the user's locale
      and the rest of the form.

**A control that filters a dataset** — read *Filtering* in `pcf-controls/references/dataset.md`
alongside these:

- [ ] `filtering.setFilter()` is followed by `paging.reset()` **and**
      `dataset.refresh()`. Without the refresh nothing moves, which is
      indistinguishable from a filter that matched nothing; without the reset,
      filtering from page three asks for page three of a one-page result set and
      gets nothing back.
- [ ] The filter is applied from an event handler and **never from a render**,
      and guarded on the serialised expression last applied. `refresh()` fires
      `updateView`, so an unguarded re-apply is an unbounded loop that a browser
      shows as a hang. Assert the settle count, not just the output.
- [ ] `filterOperator` is set explicitly on any multi-column expression. The
      default is `And`, which asks for the term in every column at once and
      matches nothing.
- [ ] **A filter the control must always hold** (a link's conditions, a
      window) is ANDed into **every** expression it sends. While it stands,
      `clearFilter()` is never called, because `setFilter` replaces the last
      expression whole. A filter row that drops it quietly brings back the
      whole view. See *Rows related through another table* in
      `pcf-controls/references/dataset-filtering.md`.
- [ ] Hierarchy operators are numbered the dataset's way (79 is
      `eq-or-under`), not the SDK's: in any condition sent, and in any table
      that turns a dataset filter back into FetchXML.
- [ ] Only text columns are given `Like` conditions. Against a number, a date or
      a lookup the server rejects the query and names the column, not the
      control.
- [ ] Typed terms are escaped for SQL `LIKE` — `%`, `_` and `[` become `[%]`,
      `[_]`, `[[]`, a character class and not a backslash. Otherwise a typed `%`
      matches every record in the table.
- [ ] A record count reported as an output comes from `totalResultCount`, which
      follows the filter — not from the length of the page, which reports the
      page size on any view with more than one. `-1` travels as `-1`.
- [ ] A persistent input — a search box — is built once in `init` rather than in
      the rebuilt region. Most dataset controls recreate their DOM per render,
      and `refresh()` causes one, so the box is destroyed on the first keystroke.

**A control that reads files:**

- [ ] It does not claim to bind a File or an Image column, because PCF cannot.
      The supported shape is base64 in a bound text column.
- [ ] A size limit is enforced **before** the file is read, and set below what
      the column can hold. `Multiple` caps at 1,048,576 characters and base64
      costs a third on top, so ~768 KB is the ceiling; over it, the platform
      rejects on save with an error that never mentions size.
- [ ] `FileObject.fileSize` is treated as **KB** and `File.size` as bytes. A
      check written against the wrong one is off by a factor of 1024.
- [ ] `Device.pickFile` is declared `required="false"` where the control has a
      fallback, and the fallback is silent rather than an error state. The call
      rejects on every host that is not a real device origin.
- [ ] A control needing the current record's identity does **not** rely on
      `context.mode.contextInfo` alone. It is undocumented and absent from the
      type definitions; the documented route is bound `recordId` / `recordEntity`
      input properties. Prefer the first, fall back to the second, and decline
      the feature with a reason when neither is configured — never guess.
- [ ] An entity logical name from a maker-supplied property is validated
      (`/^[a-z][a-z0-9_]*$/`) before it is interpolated into an `@odata.bind`
      or a path.
- [ ] `dragover` calls `preventDefault()`, or `drop` never fires at all.
- [ ] `destroy()` aborts a `FileReader` still in flight.
- [ ] An icon the control draws is an **inline `<svg>`**, not an `<img>` of any
      kind. An image behind `<img src>` renders in an isolated document that
      cannot see the page stylesheet, so its `currentColor` is black and a dark
      theme gets a black icon on a dark background. Check this in dark mode
      specifically -- it is invisible in every light-theme review.
- [ ] An **icon-only button** has an `aria-label`, and ideally a `title` too.
      Dropping a text label for a glyph ships a control announced as "button",
      and takes the label away from sighted users as well unless the tooltip
      puts it back. Read the name from the same .resx key the text used, so the
      translations keep working.
- [ ] **Every `localStorage` access is inside a try — the getter too.** Blocked
      site data throws a `SecurityError` on *reading* `window.localStorage`,
      not on `getItem`, so `const s = localStorage; try { s.getItem… }` still
      takes the control down. And a full store throws on `setItem`. Run the
      dataset rig's `storage: 'throws' | 'full' | 'absent'`.
- [ ] Where a **sticky header crosses a sticky column**, the corner cell's
      `z-index` is read back with `getComputedStyle` after scrolling. A rule
      meant to lift it loses to a more specific `th` rule without a word, ties
      with the column's body cells, and the rows — later in the document — paint
      over it (`pcf-row-commands` 0.1.5 to 0.2.0: the Commands header vanished on
      a scrolled main grid). `dev/dom.js` has no cascade; only the browser sees it.
- [ ] A control that rebuilds its DOM on every `updateView` and has a **drag**
      owes the render until the release, or the element holding the pointer
      capture is destroyed mid-drag.
- [ ] Array methods on a `querySelectorAll` result go through `Array.from`
      first. A browser returns a `NodeList`, which has `forEach` and no
      `find`/`map`/`filter` — and `dev/dom.js` returns a plain array, so the
      suite passes and the form throws.
- [ ] `utils.hasEntityPrivilege` is called only with `<uses-feature
      name="Utility">` declared, and a throw is read as "cannot say" — it is
      published without the declaration and throws at the call. So does
      `utils.getEntityMetadata` (measured 2026-10-01).
- [ ] A control that reads the table definitions keeps **one reader per page**
      and asks each thing once: every answer says `no-cache`, so nothing else
      will. A refusal or an offline client is a state named once, never a
      request per keystroke; and where `page.getClientUrl()` is not there
      (canvas, the hub's demo) no reader is made at all — see *Reading the
      table definitions* in `pcf-controls/references/context-apis.md`.
- [ ] A check of FetchXML a person typed marks as an **error** only what the
      server refuses, and an attribute it runs or a name the environment lacks
      as a **warning** that does not count against the verdict — see *What
      the server refuses in FetchXML* in `pcf-controls/references/lookups-and-fetchxml.md`.

### Controls that ask for full screen

Skip unless the control calls `mode.setFullScreen`. See *Full screen* in
`pcf-controls/references/hosts.md`.

- [ ] The call is feature-detected, and the fallback grows in place rather
      than pinning the control over the page with `position: fixed`.
- [ ] `updateView` corrects the control's own flag from `fullscreen_close` and
      `fullscreen_open` in `updatedProperties`. The host can leave full screen
      without asking — `handle.closeFullScreen()` then `settle()` in the
      rig, and the button must not still read *Collapse*.
- [ ] The focus is still on the button after `settle()`, which is the host's
      re-render and not the control's own.
- [ ] The whole control fits the height the host allocates — title, readout
      and all — and nothing is sized in `vh` where the host gave a box. Open
      the demo on the hub, expand, and look for the last line of the control.
- [ ] `destroy()` calls `setFullScreen(false)` when it is still holding it.
- [ ] No page in `docs/` and no demo limitation says canvas, or the hub's
      demo, has no full screen. Both do.

### Controls that repaint on their own

Skip unless the control owns a timer or an animation loop. See *Timers and
teardown* in `pcf-controls/references/rendering-and-hosts.md`.

- [ ] The interval is armed in `init` and never from `updateView` — which runs
      on every change to any bound value, so a `setInterval` reached from the
      render path adds a timer per render.
- [ ] A control that changes its own cadence clears before re-arming, and the
      guard tests the cadence rather than merely that a timer exists.
- [ ] The tick does **not** call `notifyOutputChanged()`. It makes the platform
      re-run the form's rules at the tick rate. A display-only control should
      notify zero times in its life.
- [ ] The tick does **not** read `context`. `updateView` is handed one for the
      duration of the call; the repaint should work off a plain snapshot taken
      there, including any string or formatted date that needed `context` to
      produce.
- [ ] It stops while `document.hidden` and while `mode.isVisible` is false, and
      repaints *before* re-arming on the way back rather than leaving a stale
      number on screen for a full cadence.

### Controls that render what a user wrote

Skip unless the control turns a record's text into markup — Markdown, HTML, a
rich-text preview. See *Markdown or HTML a user wrote* in
`pcf-controls/references/rendering-and-hosts.md`.

- [ ] It goes through a sanitiser, and the review names which one and what it
      leaves: no `<script>`, no event handler, no `style`, no `<iframe>`, no
      `<form>`, no `javascript:` or `data:` link.
- [ ] **Nothing outside the environment is fetched to render it.** Images and
      other media are decided before the markup reaches the live document —
      sanitising afterwards is too late, an image there is already loading.
      Check the browser's network list with a remote image in the text: it
      should show no request to that host.
- [ ] Links open through `openUrl` with the http/https allow-list, from an
      action handler that prevents the default; a link the control will not
      open renders as text, not as a press that does nothing.
- [ ] A deep import into a library's internals is pinned by the lock and named
      in `SPEC.md`, so the next upgrade re-checks it.

### Controls that compare with a saved value

Skip unless the control shows what changed since the record was saved.
See *What a field control sees when the record is saved* in `pcf-controls/references/properties.md`.

- [ ] The baseline moves only on a pass that names the bound property, carries
      what the control already holds, and arrives when the control has not
      written for a second — not on a resize, not on an echo, not on a
      script's `setValue`.
- [ ] Without a form (no client URL: canvas, the hub demo) a value the host
      hands in moves it, because there is nothing unsaved but what was typed.
- [ ] Every way it can be wrong shows more than changed, never less, and
      `docs/limitations.md` says which.

### Grid customizers

Skip unless the control implements the customizer interface. Each of these is
silent when wrong — nothing fails, the cell just misrepresents something. See
*Grid customizers* in `pcf-controls/references/grid-customizers.md`.

- [ ] The control's surface is in `cellRendererOverrides` / `cellEditorOverrides`
      and **not** in `gridCustomizer`. The shipping grid ignores that key —
      verified against a live environment, see the box in *Grid customizers* in
      `pcf-controls/references/grid-customizers.md`. A control whose only output is
      `GetLoadingRowRenderer` or `GetNoRowsOverlayConfiguration` passes every
      local check, renders correctly in `dev/harness.html`, and does nothing for
      a user. This one is not silent-when-wrong; it is silent-when-wrong on the
      only surface that counts.

- [ ] Every renderer declines (`return undefined`) when
      `props.validationError != null`. Rendering through it replaces the grid's
      error affordance with a cell that looks fine and will not save.
- [ ] Every renderer declines an unset nullable value rather than drawing a
      default for it. `props.value === true` turning `null` into "No" is the
      common one: the grid then disagrees with what the server filters on.
- [ ] Editors decline `props.secured`, and pass `props.isRequired` through.
- [ ] Every renderer returning an element forwards `props.onCellClicked` and
      offers an edit gesture guarded by `props.columnEditable`
      (`onDoubleClick` → `props.startEditing?.()`). An element replaces the
      cell's *interactions* as well as its pixels, and editing is what goes —
      row selection keeps working, so the cell highlights, takes a focus ring
      and looks completely alive while refusing to open an editor. Invisible in
      review, in `dev/harness.html` and in a screenshot. No `tabIndex` or key
      handlers on it: the grid owns cell focus at the row level.
- [ ] No renderer declines because an answer has **not arrived yet**. Declining
      is permanent for that cell — it becomes the grid's own, and nothing a
      customizer holds can ask for a repaint. The symptom is a decoration that
      appears only on cells the user has clicked, which is invisible in review
      and in every local harness. A renderer waiting on async data keeps the
      cell, renders `props.formattedValue` alone, and subscribes.
- [ ] Attribute metadata does **not** come from
      `context.utils.getEntityMetadata`. With no `attributes` argument it
      resolves to an entity with no columns; with them, its attribute metadata
      still carries no `MinValue`/`MaxValue`. Both failures are silent and look
      exactly like a table where nobody declared a range. It must read the Web
      API's typed metadata entities (`Microsoft.Dynamics.CRM.*AttributeMetadata`)
      via `fetch`, resolved from `init`.
- [ ] A range equal to the type's platform default is treated as "no range
      declared" — and the constants match the ones in *Reading attribute
      metadata from a customizer*. `FloatingPoint` is the one usually wrong:
      `0..1000000000`, not ±100 billion.
- [ ] `props.isRightAligned` and `props.rowHeight` are honoured, not dropped.
- [ ] The payload fires from `updateView` as well as `init`, behind a latch —
      the event name is a bound property and may not be populated at `init`.
- [ ] Any editor handling Escape *and* committing on blur shares a one-shot
      `stopEditing` latch, or Escape commits the value it just discarded — and
      that latch is a `useRef` inside the editor **component**, not a closure
      built inside the override function. The grid re-asks for the element
      freely, and a per-call closure resets the flag between the Escape and the
      blur, restoring the bug it was added to prevent.
- [ ] `props.charPress` is **staged**, not only shown. Putting it in
      `defaultValue` seeds the input without telling the grid, so a user who
      types one character and presses Enter commits the old value. Needs a mount
      effect calling `props.onChange(charPress)` — the other reason editors are
      components rather than bare elements.
- [ ] Every editor has an exit that is not a commit. A `Toggle` or `Dropdown`
      calling `stopEditing` only from `onChange` has none — no Escape, and no
      blur either, since nothing focused it. Needs `focus()` on mount plus a
      wrapper carrying both handlers, with the blur guarded by
      `currentTarget.contains(relatedTarget)` and discarding rather than
      committing when nothing was staged.
- [ ] Overrides are pure, cheap, and narrowed by
      `colDefs[columnIndex].name` where they are meant to apply to one column
      rather than every column of that type on the table.
- [ ] Nothing calls `initializeIcons()`.
- [ ] `pcfhub.json` sets `demo.host: "grid"` with a `datasetFixture`, and the
      manifest declares `<platform-library name="React">`.
- [ ] `docs/installation.md` states that importing the solution is not enough
      and names the *Customizer control* assignment step.
- [ ] `docs/installation.md` does not print one hardcoded logical name as if it
      were the only one. `{prefix}_{namespace}.{control}` takes the prefix from
      however the control was *deployed*: import the packed solution and it is
      the solution's publisher prefix, but `pac pcf push --publisher-prefix dev`
      makes it `dev_`. The wrong prefix is not an error — the grid renders its
      own cells, identically to every other way a customizer fails — so the page
      should send the reader to
      `/api/data/v9.2/customcontrols?$select=name&$filter=contains(name,'<Control>')`
      rather than to a string on the page.

Then return to *7. Accessibility and theming* in
[review-checklist.md](review-checklist.md#7-accessibility-and-theming).
