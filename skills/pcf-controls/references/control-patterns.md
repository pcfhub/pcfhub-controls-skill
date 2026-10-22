# Control patterns — index

Everything about the control itself — the manifest, the code, and the
behaviour differences between hosts — used to be this one file. It is now one
file per topic, so each can be read whole. This page maps every section title
to the file that holds it: find the title here, then read that file.

## [manifest.md](manifest.md) — The manifest

- **The manifest** — External service usage · Feature usage · Resources · Platform library versions
- **"Could not find/invoke &lt;Namespace&gt;.&lt;Control&gt;'s constructor"** — Dataverse will not replace a component at the same version · And pack clean, because the pack is incremental
- **One export per control file**

## [properties.md](properties.md) — Properties

Split out of `manifest.md` on 2 Oct 2026.

- **Property types** — The wrong `of-type` does not fail — it empties the column picker · A `TwoOptions` input cannot default to on · `of-type-group` costs more than it looks · An output that reports a verdict
- **The bound property is more than `raw`** — A bound number column · Three more things `context` gives you for free

## [rendering-and-hosts.md](rendering-and-hosts.md) — Standard and React controls, teardown, and text a user wrote

- **Standard controls** — The caret, and what actually moves it · A value the control reformats as you type · A drag is one write
- **React (virtual) controls**
- **Timers and teardown** — What `destroy` owes · Four rules, and each is a bug somebody shipped · Testing it
- **Markdown or HTML a user wrote**

## [bundle-size.md](bundle-size.md) — Bundle size

Split out of `rendering-and-hosts.md` on 15 Oct 2026.

- **Bundle size** — `standard` versus `react_virtual` is not a bundle-size decision · A library that is most of the bundle · Language features without a worker

## [hosts.md](hosts.md) — The hosts a control runs in

- **Canvas vs model-driven vs Power Pages** — A canvas app runs its own copy of the control
- **Full screen**

## [dates.md](dates.md) — Dates

- **Dates, and the day that moves** — `Behavior` decides the shape of the value you are handed · Format and Behavior are different fields, and the manifest gates on Format · Anchor a whole day at midday · A time is written by its components, and read by its behaviour · The shift is in serialising, not reading · Subtracting timestamps is an hour out across DST · Formatting

## [dates-in-a-dataset.md](dates-in-a-dataset.md) — Dates in a dataset

Split out of `dates.md` on 15 Oct 2026.

- **A date read through a dataset**
- **The timeline, and a drag with nothing to drop on**
- **Demo presets**

## [dataset.md](dataset.md) — Dataset controls

- **Dataset controls** — Roles, or the view's own columns · The subgrid's own chrome · Finding columns through a role · Working with the dataset · Paging · Write the pager against the platform you have · Sorting · Selection · Dataset controls in canvas

## [dataset-filtering.md](dataset-filtering.md) — Filtering a dataset

Split out of `dataset.md` on 15 Oct 2026.

- **Filtering**

## [dataset-writing.md](dataset-writing.md) — Dataset controls: writing

Split out of `dataset-writing-and-layout.md` on 10 Oct 2026.

- **Writing from a dataset control** — The dataset record can write, and the typings do not say so · Two routes, chosen per record · Writing a Status Reason · Writing through the Web API instead · Writing a lookup through the Web API

## [layout.md](layout.md) — Fitting the host, and narrow widths

Split out of `dataset-writing-and-layout.md` and `styling-and-accessibility.md`
on 10 Oct 2026.

- **Fitting the host: height, width and columns** — The height a main grid never gives you · Scrolling wider than the container · Pinning a column while the rest scrolls · Resizing a column · A width measured from your own box is a loop
- **Narrow widths** — A viewport-relative cap has a lower end, and something will find it · A narrow layout is measured, not queried — and never contained
- **A drawing wider than a field's column**

## [lookups-and-fetchxml.md](lookups-and-fetchxml.md) — Lookups, hierarchies and aggregates

- **Lookup columns**
- **Reading a hierarchy through FetchXML** — The Web API takes FetchXML, and in one place · Ask whether the relationship is hierarchical before querying · Two routes, one interface · Load what is looked at · The record's picture · The rig
- **Aggregating a view through FetchXML** — The view already knows which records it means · A subgrid's relationship is not on the dataset · The runtime filter speaks in numbers · Two routes, one interface, and a caption · Generate the aliases; do not freeze them · Expanding a group is a filter, not a scroll · A date bucketed by the user's calendar · What the rows look like · The primary key

## [context-apis.md](context-apis.md) — Context APIs and their limits

- **Context APIs and their limits** — Linking records over a many-to-many · Reading configuration from a web resource · Reading the table definitions · Restoring an audited value — writing back what a function read · The current record's identity, from a field control · Escaping a `$filter`, in the right order · A platform rejection is not an `Error` · A privilege before the button

## [web-api-messages.md](web-api-messages.md) — Web API messages: functions and actions

Split out of `context-apis.md` on 15 Oct 2026.

- **Calling a Web API function `context.webAPI` cannot**
- **Calling a Web API action**

## [files-and-device.md](files-and-device.md) — Files, and the device

- **Files and binary content** — Reading the file · Writing a file to Dataverse as a Note · Handing the user a file the control generated · An icon that has to follow the theme must be inline SVG
- **Device APIs** — Availability is per method and per host, and narrower than it reads · Absence and refusal are different, and `required="false"` is about absence · A device rejection arrives in three shapes and only one is an `Error` · Three traps in the types · `captureImage` resolves with one file; `pickFile` resolves with many · What a device API costs the demo, and the maker · Testing it

## [navigation-and-events.md](navigation-and-events.md) — Navigation, dialogs and events

- **Navigation and dialogs** — Presence is per method, not per bag · Two routes to opening a record, and they are not interchangeable · Creating a record through the quick create form · `openUrl` has no failure channel, so validate before calling · The dialogs, and the cancel that arrives as a resolve · Confirm, then destroy · A destructive command over a selection · `deleteRecord`, beyond the N:N trap
- **Events** — `&lt;event&gt;` and `&lt;common-event&gt;` are two elements, and the tooling enforces it · `refreshTypes` emits nothing for an event · The model-driven payload can carry functions · Two channels, and the double fire · A counter, not just a state · `pfx-default-value` is a Power Fx expression, not a value · Testing it

## [grid-customizers.md](grid-customizers.md) — Grid customizers

- **Grid customizers** — Assigned to a grid, and what decides whether it works at all · The types are vendored, because there is nothing to install · Returning `undefined` is the contract, not the fallback · What a renderer can see, and what it therefore cannot draw · Reading attribute metadata from a customizer · The `gridCustomizer` half behaves differently · There is a local harness, and it is the only way to see this shape work · The latches and lifetimes the shape needs · The rules the platform actually enforces · Fluent 8, and no icons · What is not configurable

## [styling-and-accessibility.md](styling-and-accessibility.md) — Styling

- **Styling, or looking like the form it is on** — A standard control cannot mount a `FluentProvider`, and does not need to · Get the values from the packages, not from a screenshot · The palette worth starting from · Dark: the host's theme, never the OS's · The field surface is one box, not two · The animated focus underline, and why it is a pseudo-element · Disabled is a different surface, not a dimmer one · Icons: Fluent's path data, at the size it was drawn for · A native range, styled as Fluent's Slider · Tables get the same treatment, with different numbers · Target size, and the honest version of the trade · Two media queries that are not optional · Verify it, because none of this is type-checked · Scoping, restated because the blast radius is real · A Fluent surface's own class competes with yours

## [accessibility.md](accessibility.md) — Accessibility

Split out of `styling-and-accessibility.md` on 15 Oct 2026.

- **Accessibility** — A model-driven form keeps Tab · A tree or a list of your own: one tab stop, arrows inside · Live regions: announce the change, not the value

## [multiple-controls.md](multiple-controls.md) — More than one control in a repository

- **More than one control in a repository** — The layout that satisfies all three · Adding a second control: `add-control.mjs` · What the hub publishes when there are two · `&lt;dependency&gt;` is the element this shape unlocks — and you probably still do not want it · Sharing code duplicates it, so share for consistency and not for size · What breaks, and what to check

## [rig-maintenance-and-checks.md](../../pcfhub-new-control/references/rig-maintenance-and-checks.md) — Keeping the rig current, and what the checks prove

Split out of `verification.md` on 15 Oct 2026.

- **Keeping the rig current: `sync-rig.mjs`**
- **What `npm run check` covers**
- **A local pack, and a clean one**

## [hub-demo-dataverse.md](../../pcfhub-publish/references/hub-demo-dataverse.md) — The demo's Dataverse, and the real harness locally

Split out of `hub-demo.md` on 15 Oct 2026.

- **A `dataverse` section: a small Dataverse behind the demo**
- **Refusing a write**
- **File and Image columns**
- **Running the real harness before the hub has it**
- **A choice: its number in the record, its label in the metadata**
