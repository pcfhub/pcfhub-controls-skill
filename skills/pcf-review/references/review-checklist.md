# Review checklist

Ordered by how expensive the mistake is to fix later, not by where it lives in
the repository. The first section covers things that cannot be undone once a
customer has imported the solution; the last covers things a follow-up commit
fixes.

Run the checks rather than reading for them where you can — `npm run check`,
`npm run lint`, and `npm run build` are fast and catch most of section 4
outright. Report what you verified by running versus what you assessed by
reading; they are not the same claim.

But do not over-read a green `npm run check`. It sends `pcfhub.json` to the
hub's own validator for the schema, and checks locally only what the hub cannot
see: placeholders, `control.manifestPath`, the control shape against the
manifest, the docs filename set, the media and fixture paths, the versions, the
`.resx` files and the declared features. The full list is *What `npm run check`
covers* in `pcfhub-new-control/references/verification.md`. **An unreachable hub is only a warning**, so read the
warnings as well as the exit code — a green run offline has not validated the
schema at all.

It still does not judge whether `demo.fidelity` is *honest*, it does not look at
images referenced from the docs, it does not check that a fixture's columns
match what the control reads, and it compares `control.type` and
`control.framework` with the manifest, not with the code. Those stay
review-enforced.

**Check which version of the script the repository has.** `scripts/` is copied
at adoption, not linked, so a repo adopted from an older `_template` silently
has weaker coverage. Run `node ../_template/scripts/sync-rig.mjs --into .
--dry-run` from the repository: anything it reports as `update` is a stale copy
the sync can replace safely, and anything `modified` was edited here and needs
reading. Sync before trusting the green, not after.

## 0. Where the change actually lives

Do this first when the complaint is "X isn't showing up", because the hub reads
docs from the default branch and the API reference from a release tag, and the
answer is usually neither.

- [ ] `git status` — what is uncommitted?
- [ ] `git log` and `git tag` — what is committed, and what tag does the hub's
      current API reference come from?
- [ ] **Read the actual `git diff` of the manifest, not a summary of it.**
      Reporting "the working tree only adds a `<platform-library>` line" when
      the diff also adds a property sends the user hunting for an edit sitting
      in front of them, and every conclusion after that inherits the error.
- [ ] Check the built `out/controls/<Control>/ControlManifest.xml` against the
      source manifest if the two might disagree.
- [ ] For a control already on the hub, `get_component` (pcfhub MCP) — what the
      hub holds, against the latest tag and the default branch. *When things
      do not appear* in `pcfhub-publish/references/pcfhub-manifest.md` maps each difference to its cause.

## 1. Permanent identity

Wrong here means orphaned installs, not a rebuild.

- [ ] **No property is named after a FormXML element.** `labels` breaks
      publishing a classic-designer form outright (measured 2026-09-19; see
      *The manifest* in `pcf-controls/references/manifest.md`); `npm run check` refuses it and
      warns on the rest. Cheap before the first release, a breaking rename after.
- [ ] **Publisher unique name** and **customization prefix** in
      `Solution/src/Other/Solution.xml` are the intended ones. Every component
      carries the prefix in its logical name; changing either later orphans
      everything already installed in a customer environment. They are the
      author's own — `PCFHub` / `pcfhub` only for a control published from the
      `pcfhub` organisation (*And the publisher is the author's own* in
      `pcfhub-new-control/references/scaffold-and-adopt.md`).
- [ ] **Solution `<UniqueName>`** is final. Changing it after a release makes
      the next import create a second solution rather than upgrade the first.
- [ ] **`pcfhub.json` slug** equals the slug registered on the hub. A copied
      `pcfhub.json` is the usual cause of a mismatch.
- [ ] **Namespace and constructor** agree between the manifest, `pcfhub.json`,
      and the exported class name.

## 2. Versioning

- [ ] The version matches in all three: `<Control>/ControlManifest.Input.xml`,
      `Solution/src/Other/Solution.xml`, `package.json`.
- [ ] **Every** control manifest, not just the published one. A repository may
      hold several controls, and they all ship in the one solution under the one
      tag — a sibling left at the old version installs as a version nobody cut.
      `ls */ControlManifest.Input.xml` and check each.
- [ ] Any tag being cut matches those — CI checks this, but catching it
      before pushing saves a Windows build.
- [ ] The bump is in the same commit as the tag.

## 3. The hub contract

- [ ] `validate_manifest` (pcfhub MCP) on `pcfhub.json` answers `valid: true`,
      and its warnings have been read. Every `tags` entry is in the hub's
      vocabulary (`list_taxonomy`), since an unknown one is dropped, and
      `hosts` is declared.
- [ ] **`summary` is declared, and says what the control does today.** It is
      the Overview block on the component page and ten points of the quality
      score. Read it against `docs/overview.md` after a release that changed
      what the control does — it is prose nothing checks, and Code Editor's
      went on saying "there is no IntelliSense" after completion from a JSON
      Schema had shipped. Lists are blocks of their own (a blank line either side), and it
      uses nothing but paragraphs, `- ` lists, bold and code. `get_component`'s
      `summaryMd` is what the hub holds.
- [ ] `control.manifestPath` in `pcfhub.json` resolves to a real file. A typo
      costs the whole API reference silently.
- [ ] The three versions agree — `<control version>`, `Solution.xml`'s
      `<Version>`, `package.json` — **and one of them moved** if this is a
      redeploy. Dataverse accepts an import at the same version, reports
      success, and leaves the existing web resource in place, which is the usual
      cause of "Could not find/invoke <Namespace>.<Control>'s constructor" on a
      repository that is otherwise correct.
- [ ] `control.type` and `control.framework` still describe what the manifest
      and the code actually do. A current `npm run check` validates the manifest
      half of this; that the *code* matches — that a `react_virtual` control
      really implements `ReactControl` — is still yours to confirm.
- [ ] A grid customizer says `"type": "grid_customizer"`, not `"virtual"`. It is
      the one type the hub cannot derive from the manifest — a customizer looks
      exactly like a React virtual field control there — so nothing corrects a
      stale value at release, and both customizers in this catalogue carried
      `virtual` until the category existed.
- [ ] Every file in `docs/` is one of: `overview.md`, `installation.md`,
      `canvas.md`, `model-driven.md`, `api.md`, `examples.md`, `limitations.md`,
      `faq.md`, `migration.md`.
- [ ] No `docs/changelog.md`.
- [ ] `api.md` uses `::props-table` rather than hand-written property tables.
- [ ] **Every code sample in `docs/` has been run**, not just read. Power Fx and
      JavaScript in a fenced block are untested code shipped to a maker: nothing
      in `npm run check`, the build, or the hub's Markdown compiler looks inside
      a fence. `pcf-date-range-picker` published `DateAdd(Today(), 7, Days)` in
      three places — the unit has to be `TimeUnit.Days`, and a bare `Days` does
      not resolve — and it took a maker pasting it to find out. A wrong snippet
      costs more than wrong prose, because the error message blames their app.
- [ ] Canvas instructions say **where** to bind, not only what to bind. A code
      component's properties appear under their manifest names in the formula-bar
      dropdown and under their display names in the Advanced pane, and a maker who
      types a value where a variable belongs gets a control that looks locked.
- [ ] `api.md`'s `kind=` sections match the control: a dataset control has
      `kind=dataset`, and `kind=dataset_column` exactly when it declares
      `property-set` roles. See *Directives* in `pcfhub-publish/references/pcfhub-manifest.md`. Delete
      sections with nothing to show.
- [ ] `installation.md` does not hard-link release assets.
- [ ] Pages that do not apply are deleted, not left as template placeholder
      text.
- [ ] `migration.md`, if present, has an `appliesTo` range that matches at least
      one released version.
- [ ] `demo.fidelity` is honest. `full` requires that no user-visible path
      reaches WebAPI, `context.device`, or anything else outside the browser.
      `mocked` requires that every interaction still works against the fixture.
      Any interaction the harness cannot feed — a search over records the
      fixture's `dataverse` section does not hold, a FetchXML query, a Web API
      function, a device call no preset simulates — makes it `limited`, or a
      named entry in `demo.limitations`.
- [ ] `demo.limitations` describe the harness as it is, not as it was. An
      entry saying that paging, sorting, selection, a dialog, a refused write,
      a read-only form or a choice's labels cannot be shown predates the
      harness answering it (2026-09-26 to 2026-10-02), and is now a published
      sentence that is false. Each is in *The demo block* in
      `pcfhub-publish/references/hub-demo.md`, with the date it changed.
- [ ] Paging is shown rather than avoided: a preset whose `pageSize` is below
      the fixture's row count pages for real. This item said the opposite
      while the harness served every row on one page.
- [ ] `demo.bundle` is `out/controls/<Constructor>/bundle.js` — constructor
      only, **no namespace prefix**. A namespaced path never exists, nothing
      validates it, and the demo just fails to load. Same shape for
      `demo.styles`.
- [ ] Media referenced **from the docs** actually exists. A current
      `npm run check` covers the paths named in `pcfhub.json`, but nothing checks
      an `::image{src=media/…}` in a Markdown page — the hub drops the file and
      the page renders without it, with nothing in the repository to suggest a
      problem. Either ship the image or delete the directive; a page pointing at
      a file that was never added is the usual outcome of writing docs before
      taking screenshots. Files must also be small enough for the hub to mirror,
      and videos need posters.
- [ ] The release's commits are on the default branch before its tag is
      pushed. The tag gives the hub the notes and the API reference; the
      docs, `pcfhub.json`, its media and the fixture come from the branch, so
      a tag pushed alone publishes a new version beside the old pages — *Push
      the branch before the tag* in `pcfhub-publish/references/releasing.md`.

## 4. Build health

- [ ] `npm run check` passes — no placeholders, `pcfhub.json` readable, docs
      named correctly.
- [ ] `npm run lint` passes.
- [ ] **Each control has a `.pcfproj` of its own.** A project holding two
      manifests builds and packs fine and then fails `pac pcf push` — "Pcf
      projects should only contain a single source manifest file" — so CI stays
      green while the inner development loop is broken. Count them:
      `ls */*.pcfproj` should match the number of controls.
- [ ] Each project's `OutputPath` is the controls **root**
      (`..\out\controls`), not the control's own folder. Pointed one level
      deeper, the solution packer reads `css/` as a control and fails the pack.
- [ ] `npm run build` produces `out/controls/<Control>/bundle.js` — **one per
      control**. Two controls collapsing onto a single `out/controls/bundle.js`
      means a project file is sitting beside its manifest instead of one level
      above it.
- [ ] **Every** bundle is under the 5 MB Dataverse web-resource ceiling, not
      just the first. The limit is per control, because each is served as its
      own web resource. A size gate written as
      `Get-ChildItem … -Recurse | Select-Object -First 1` checks whichever
      directory sorted first and lets the rest ship unmeasured.
- [ ] `lint` and `smoke` in `package.json` name every control directory, plus
      any `shared/` directory. Both are written one directory at a time, and a
      smoke suite nothing runs is worse than none — the repository looks covered.
- [ ] `npm run refreshTypes` has been run since the last manifest change.
      Otherwise `context.parameters` is typed from the old manifest and `tsc`
      will accept code that cannot work.
- [ ] `tsconfig` has `strict: true` and it is not being defeated by `any` or
      `@ts-ignore` in the control code.
- [ ] Bundle size is proportionate. React or Fluent inside the bundle of a
      `react_virtual` control means the platform libraries are not actually
      external. Confirm by grepping the built bundle for `external "React` or by
      its size, not by reading `package.json`.
- [ ] `<PcfBuildMode>production</PcfBuildMode>` is live in the `.pcfproj` and not
      swallowed by the comment above it. The template ships a comment
      immediately before it, and a stray `-->` silently ships a debug bundle
      that nothing in CI complains about.
- [ ] For a `react_virtual` control, `<platform-library>` entries exist and
      react/react-dom are devDependencies at the matching version — not runtime
      dependencies. If Fluent 9 is declared, react must be **16.14.0**, not
      16.8.6: both resolve to the same platform build, but
      `@fluentui/react-components` peers on `>=16.14.0` and npm refuses the
      pair. Note `pcf-scripts` validates neither the name nor the version of a
      platform library, so a green build proves nothing here.
- [ ] `package-lock.json` is committed. Both workflows run `npm ci`, which fails
      outright without it, and `_template` ships none — so this bites every
      freshly adopted repository on its first push.

## 5. Manifest correctness

- [ ] Every `bound` property's `of-type` was checked against the **real column**
      it is meant for, in the table reference — not inferred from what the value
      looks like. A mismatch does not fail: the form designer offers only
      matching columns, so the control is simply unselectable, which is
      invisible from the repository. Dataverse's coordinate columns
      (`address1_latitude` and friends) are `Double` — PCF's `FP` — and not
      `Decimal`, which is the one that catches people.
- [ ] `external-service-usage` is enabled only if the control really calls a
      third-party service — it makes the control premium and requires every
      domain to be listed.
- [ ] If it **is** enabled: every domain is listed, the user was asked and
      agreed to the licensing cost, and `docs/limitations.md` says so where an
      installer will read it. Premium is a cost the installer pays, not the
      author — end users need Power Apps licences rather than Office 365 ones,
      and it follows the declaration whether or not the feature is switched on.
- [ ] Every `Device.*` feature is `required="false"`, unless the control is
      *only* that feature. `required="true"` on a host without the bridge is
      component load failure, not degradation — and Power Pages forbids `true`
      outright while supporting no Device API at all.
- [ ] `feature-usage` declares only features actually used. Each one is a
      permission prompt for the maker. Note `openDatasetItem()` needs none — it
      is a method on the dataset, not on `context.navigation`.
- [ ] `cds-data-set-options` is on `<data-set>` (not `<control>`), and its
      presence matches the control: a control calling `setSelectedRecordIds()`
      wants `displayCommandBar:true` or nothing acts on the selection, while a
      control with fixed `property-set` roles usually wants `displayViewSelector`
      off, since its layout does not survive a different view. Read the option
      names character by character — the value is typed as a plain string, so a
      typo compiles clean and silently does nothing.
- [ ] A dataset control's `property-set` roles, if any, are roles the control
      genuinely assigns meaning to. One that renders whatever the view supplies
      should declare none and read `dataset.columns`: roles are fixed-arity and
      cannot express "however many columns the view has", and they carry none of
      the `order`, `visualSizeFactor`, `isPrimary` or `disableSorting` a layout
      needs.
- [ ] Every `display-name-key` and `description-key` exists in the `.resx`.
- [ ] Those keys are readable, or the hub's admin panel has been used to correct
      them — the hub records the key verbatim and does not read the `.resx`.
- [ ] Every `.resx` on disk is listed in `<resources>`, and every listed path
      exists. An unlisted file is never packed: that locale silently falls back
      to English while the repository looks translated. `npm run check` covers
      this, along with key parity and dropped `{0}` placeholders — so the real
      question here is whether `check` was run at all.
- [ ] No user-visible sentence is assembled from pieces in code.
      `label + ' ' + getString('Copy')` cannot be translated into German or
      Japanese, where the verb goes last — the fix is one key holding
      `"Copy {0}"`, which each language is then free to reorder.
- [ ] A translation that is no longer maintained has been **deleted**, not left
      to drift. A stale translation is worse than an honest fallback to English,
      because the fallback is at least current.
- [ ] `1033` is the **last** `<resx>` line, and any language added since was
      inserted above it rather than appended. `pcf-start` renders whichever file
      is listed last, so an appended sixth language quietly makes `npm start`
      speak it — a symptom that shows up in a dev session nobody connects back
      to a manifest edit. The platform ignores the order entirely, so this
      costs nothing to get right and is invisible when got wrong.
- [ ] Every `bound` property is returned from `getOutputs()`.
- [ ] Nothing substring-matches `property.type`. For a type-grouped property the
      platform may report the group's accepted types rather than the resolved
      member, so a loose test matches every binding. Compare exactly, and let
      the value's own shape (`Array.isArray`, `typeof`) answer first. Where
      only the type string is left, point the exact comparison at the case to
      *forbid*, so an unrecognised string falls back to the maker's intent
      rather than to a guess.
- [ ] The bound property's state is honoured, not just its `raw`:
      `error` marking the field, and `errorMessage` printed in canvas only —
      a model-driven form draws it under the field itself, so printing it
      there shows it twice; `security.readable` checked before
      treating a null as empty, `security.editable` checked alongside
      `mode.isControlDisabled`, and `attributes?.…` treated as optional because
      canvas has none.
- [ ] `mode.isVisible` is honoured, and `userSettings.isRTL` sets `dir` — with
      the horizontal arrow keys and any left/right hit test inverted to match.
- [ ] A **field** control declares one `usage="bound"` property **per logical
      column** — usually one. The first one binds to the column the control is
      placed on; each extra one becomes another column picker in the maker's
      configuration pane. That is correct only when the control genuinely spans
      several columns, as a date range does. Otherwise the
      maker is asked to choose a second column for a control that uses one.
      `required="false"` does not suppress it. To accept several column types,
      use one property with a `type-group`, not several properties.
- [ ] Input property defaults are sensible for a maker who configures nothing.
- [ ] A `Lookup.Simple` control clears with `[]` from `getOutputs()`, not `null`,
      and resyncs on `raw[0]?.id` — the array and the object in it are new on
      every pass. `name` and `entityType` are optional and have a fallback
      wherever they are read.
- [ ] `getTargetEntityType()` and `getViewId()` are called guarded
      (`typeof … === 'function'`) despite being typed, falling back to
      `raw[0]?.entityType`. Both are absent from the demo harness, and a control
      that assumes them shows nothing there. Nothing *depends* on
      `getViewId()` on a field control: it names no view there, set or not.
- [ ] A list built from a view **keeps the view's filter and order** and does
      not re-sort; a view that cannot be read lists **nothing** (the control
      says so and degrades), never the bare table; a view the maker named is
      never silently replaced by another.
- [ ] An **output** (`usage="output"`) is notified when *it* changes, not only
      when the bound value does; `getOutputs()` then hands an untouched bound
      column back as it came (`null`, not `""`); a verdict output fails closed
      while its check is incomplete; and `docs/` says outputs are for canvas —
      binding one in the classic form designer breaks the form's save. See
      *An output that reports a verdict* in `pcf-controls/references/properties.md`.
- [ ] Anything longer than a name comes from a web resource, not a static
      input value: the modern designer refuses more than 100 characters. See
      *Reading configuration from a web resource*.

## 6. Control behaviour

In [review-checklist-behaviour.md](review-checklist-behaviour.md#6-control-behaviour)
— the longest section, kept in a file of its own: `updateView`, the echo of
a write, the caret, timers and teardown, full screen, repainting, and grid
customizers. Work through it here, in order, then continue with section 7.

## 7. Accessibility and theming

- [ ] Every mouse interaction has a keyboard equivalent.
- [ ] A widget of many choosable things — a tree, a list, a grid the control
  draws — is **one** tab stop with the arrows inside, `preventDefault` on the
  keys it takes and on nothing else; windowed rows use
  `aria-activedescendant` with ids unique per instance, and carry
  `aria-level`/`aria-setsize`/`aria-posinset`; the keys are pressed for real
  (`dev/keys.js`) — *A tree or a list of your own* in
  `pcf-controls/references/styling-and-accessibility.md`.
- [ ] A grid laid out on one CSS grid has rows for a screen reader: each row's
      cells sit in a `role="row"` wrapper with `display: contents`; a nesting
      grid is a `treegrid` with `aria-level` only while the rows on screen
      nest; and anything drawn over the grid (arrows, links) is `aria-hidden`
      with the same fact written in the row's header — *Rows on a CSS grid: a
      `role="row"` wrapper with `display: contents`* in
      `pcf-controls/references/accessibility.md`.
- [ ] Focus is managed when the control changes what is on screen.
- [ ] A pressed control is never `disabled` while its own work runs: it is
      `aria-disabled` (Fluent: `disabledFocusable`; a text box `readOnly`)
      with the press refused by state. Chrome blurs a focused element that
      becomes disabled at the next frame and gives nothing back when it is
      enabled again (measured in Chrome 152, 2026-10-29). A control removed by
      its own action — a chip's remove, a row's delete — hands focus to a
      neighbour. `grep -n "disabled={\(busy\|loading\|adding\|working\)"` finds
      the first kind (`check-template` warns on it). A rig answers
      inside one frame and hides the second, so slow its writes before you
      press: *A button that is working keeps focus* in
      `pcf-controls/references/accessibility.md`.
- [ ] Real semantics — `button`, `input`, `role`, `aria-label` — rather than
      clickable `div`s.
- [ ] Colours come from the host theme rather than being hard-coded, so the
      control survives dark mode and themed environments.
- [ ] Dark mode is not keyed off `@media (prefers-color-scheme: dark)`. A
      model-driven app carries its own theme and the OS setting says nothing
      about it, so the media query hands an OS-dark machine on a light app the
      dark palette — light grey text on a white surface, for exactly the values
      a light palette had raised to 4.5:1. The signal is
      `context.fluentDesignLanguage?.isDarkTheme`. Where the elements have no
      context of their own (cell renderers, anything mounted by a host), the
      control publishes it as a `:root` attribute and the CSS keys off that,
      with the media query kept only as the fallback for hosts that publish
      nothing. Note no single palette avoids the problem: nothing clears 4.5:1
      against both `#ffffff` and Fluent's dark `#292827`.
- [ ] Fluent v9 portal components (dialog, popover, tooltip, menu, and a
      `Combobox`'s listbox) are wrapped in a `FluentProvider`, or they render
      unstyled.
- [ ] Rules for anything *inside* a portal do not lead with the control's root
      class. A portalled surface is not a descendant of it, so
      `.Control .Control-thing` silently matches nothing — put the class on the
      slot and lead with that, or opt into `inlinePopup` and accept the
      clipping.
- [ ] An open portalled surface — combobox list, popover, menu, a list in a
      `<body>` layer — closes when the form scrolls its field or trigger out
      of view (`lib/close-when-hidden`), or it rides up over the form's
      header with nothing beneath it. Scroll the form with it open and look,
      and check the form **stays** scrolled after the close: a surface that
      held focus hands it back to its trigger, which scrolls it into view.
- [ ] An icon-only control has `aria-label` **and** `title`, and any decorative
      `<svg>` inside it is `aria-hidden="true" focusable="false"`.
- [ ] Anything that means something by colour also means it by word, icon or
      shape. Three coloured states with no labels are three identical states
      under `forced-colors: active`.
- [ ] `aria-live="polite"` is not on a value that changes by itself. A ticking
      number wired that way is read aloud on every change. A self-updating value
      belongs in `role="timer"` (a live region whose implicit `aria-live` is
      `off`); only the *transition between states* goes in a polite region, and
      not on the first render — a control appearing on a form is not a change to
      anything.
- [ ] A visually-hidden live region is hidden with the clip-rect idiom, not with
      `display: none` or `visibility: hidden`. Both remove it from the
      accessibility tree along with the layout, which is the usual reason a live
      region turns out to be silent.
- [ ] A live region that carries the platform's own error text is **visible**,
      not clipped. An "sr-only" status is the right idiom for a confirmation
      the browser already shows another way, and the wrong one for the only
      account of why a request failed: `pcf-attachment-list` 0.1.x rendered a
      refused download to assistive technology alone, and a sighted user saw
      nothing happen. If the text would help someone who can see, let them.

## 7b. Fluent fidelity

Cosmetic in the sense that nothing breaks, and the first thing a maker notices.
*Styling* in `pcf-controls/references/styling-and-accessibility.md` has the values and the reasoning.

- [ ] Colours, radii, fonts and durations are `var(--fluentToken, literal)`
      rather than bare literals. The token is how the control follows the app's
      theme and brand; the fallback is for hosts that publish nothing. Check a
      few token *names* against `@fluentui/tokens` — a misspelled one renders
      the fallback forever and looks fine on every host you would test on.
- [ ] The fallbacks are Fluent's actual values, not hand-picked neighbours:
      `#f5f5f5` / `#141414` for a filled field, `#0f6cbd` / `#479ef5` for the
      focus stroke.
- [ ] A field-shaped control renders **one** filled surface holding its input
      and any trailing button, 32px tall, with the border and the focus state
      belonging to that surface — not an input beside a separate bordered
      button.
- [ ] The focus underline is a scaled `::after`, not a `border-bottom` that
      appears on focus. The border version relayouts the form under the user
      every time they tab.
- [ ] Disabled removes the fill and reveals the border rather than reaching for
      `opacity`, which drags the text below contrast along with the chrome.
- [ ] `@media (forced-colors: active)` restates anything whose meaning was
      carried by colour, and `prefers-reduced-motion` *shortens* the transitions
      rather than deleting the rules that hold the focus indicator.
- [ ] The forced-colors block was checked against the file, not written from
      memory. Grep the stylesheet for `background-color`: forced colours replace
      every one of them with `Canvas`, so anything that was only a tint goes
      invisible — a loading skeleton being the usual casualty. Give placeholders
      a border and a transparent fill. An empty block with a comment saying
      nothing depends on colour is the specific thing to distrust.
- [ ] A **grid customizer** has *not* been converted to Fluent tokens. It is the
      one variant where literals are correct — the cells sit in a Fluent 8 grid
      and the tokens are Fluent 9, so `var(--colorNeutralForeground2)` (#424242)
      makes a customized cell disagree with the plain cell beside it (#605e5c).
- [ ] Any glyph is Fluent's own path data at the size cut matching its box — not
      a 20px icon scaled to 16px, and not something hand-drawn.
- [ ] A documented touch-target size still matches the code. A button that moved
      inside a 32px field is ~28px, which is WCAG 2.1 AA (2.5.8) and not AAA
      (2.5.5); a `docs/` page still claiming 44px is the failure here, not the
      trade.
- [ ] Every rule that **sizes a Fluent component** — a `Button`'s `min-width`, a
      surface's `padding` — is two classes deep, and the size was read back
      with `getComputedStyle` in the hub's harness at phone width. One class
      ties with Fluent's own, the winner is load order, and the order is not
      the same on a form and on the hub; the stub has no Fluent styles to
      lose to — *A Fluent surface's own class competes with yours* in
      `pcf-controls/references/styling-and-accessibility.md`.

## 8. Documentation honesty

- [ ] `docs/overview.md` names the supported hosts plainly — model-driven,
      canvas, custom pages — and which are not supported.
- [ ] `docs/limitations.md` records real constraints, including any platform
      limitation discovered while building — and nothing this release closes
      is still listed there. *Reread `docs/limitations.md` for what the
      release closes* in `pcfhub-publish/references/releasing.md`.
- [ ] `SPEC.md` records anything the next person would otherwise rediscover: a
      manifest shape that turned out wrong, an API that does not exist, a
      behaviour that differs from the original plan.
- [ ] Claims in the docs match what the code does. A control documented as
      searching existing records but actually creating new ones is worse than
      one with no docs.
- [ ] `demo.presets` do not contradict the docs. A preset seeding `"value": 0`
      under an `api.md` insisting the control never writes `0` puts the
      contradiction on the public page, side by side.
- [ ] A preset that names a `datasetFixture` of its own has a whole fixture
      behind it, something that fails when that file drifts from the demo's,
      and a `demo.limitations` entry saying its edits do not cross to the
      other presets. See *A preset can name a fixture of its own* in
      `pcfhub-publish/references/hub-demo.md`.
- [ ] `SPEC.md` and the comments in `release.yml` still describe the current
      state. A `SPEC.md` claiming the docs are unwritten stubs, or a comment
      saying fidelity is `none` when it is `mocked`, misleads the next reader
      more than silence would.
