---
name: "pcf-controls"
description: "Write and fix Power Apps Component Framework (PCF) code components: `index.ts`, `ControlManifest.Input.xml`, properties and outputs, datasets, dates, lookups, FetchXML, the Web API, navigation and events, files and the device, styling, accessibility and Power Apps grid customizers, using what was measured on real model-driven forms and canvas apps. Use this whenever the work is the control itself, wherever it will be published. Trigger it even when the user only says \"PCF\", \"code component\", \"pcfproj\", \"pac pcf\", \"control manifest\", \"dataset control\", \"virtual control\", \"grid customizer\", \"cell renderer\" or \"editable grid\", when a caret jumps, a control will not load or a bundle is too big, and when they want a control on a Dataverse form or view that filters, searches, charts, counts, groups or uploads files. It routes the other jobs to the sibling skills: a new or adopted repository, publishing on PCFHub, a review, and the next version of a shipped control."
---

# PCF controls

PCF components are cheap to start and expensive to get wrong later, because
several decisions are permanent the moment a customer imports the solution, and
because the platform and its documentation disagree more often than either
admits. This skill is the control itself: what each part of the platform
actually does, measured on real forms and apps, and the repository that has
already met each trap.

It does not assume where the control is published. The jobs around the code —
starting a repository, publishing on [PCFHub](https://pcfhub.dev), reviewing,
planning the next version — are four sibling skills in this plugin.

This file is the route. The detail lives in `references/`, one file per topic,
each small enough to read whole — read the one a step names before that step,
not all of them up front.

## Orient before doing anything

Work out which job this is. They share vocabulary and almost nothing else.

| The ask sounds like | Go to |
| --- | --- |
| "new control", "scaffold", "start a PCF for X" | [Scaffold](../pcfhub-new-control/SKILL.md#scaffold-a-new-control), in `pcfhub-new-control` |
| "we already have a PCF repo", "get it on the hub" | [Adopt](../pcfhub-new-control/SKILL.md#adopt-an-existing-repo), in `pcfhub-new-control` |
| "add a property", "make it do Y", "why does the caret jump" | [Build](#build-the-control), here |
| "review this", "why won't it load", "bundle is huge" | [Review](../pcf-review/SKILL.md#review-an-existing-control), in `pcf-review` |
| "the next version", "what goes in 0.6.0", "it needs grouping" | [New version](../pcf-next-version/SKILL.md#ship-a-new-version-of-a-shipped-control), in `pcf-next-version` |
| "ship it", "cut a release", "it isn't showing on the hub" | [Release](../pcfhub-publish/SKILL.md#release-and-the-hub-contract), in `pcfhub-publish` |

If the repository already exists, read `<Control>/ControlManifest.Input.xml` —
and `pcfhub.json`, if it has one — before anything else. Between them they tell
you the control's type, framework, bound properties and identity, which is most
of what you would otherwise ask the user for.

## Where the detail is

| Read | Before |
| --- | --- |
| `references/exemplars.md` | writing any shape or cross-cutting pattern — it names the repository that has already met the traps |
| `references/manifest.md` | editing `ControlManifest.Input.xml`: features, resources, platform libraries, load failures |
| `references/properties.md` | choosing a property's `of-type` or a type group, an output, reading what a bound property carries besides `raw`, and telling a save from an echo |
| `references/rendering-and-hosts.md` | writing `index.ts`: standard vs React, `destroy()` and timers, rendering Markdown or HTML a user wrote |
| `references/bundle-size.md` | a bundle that is bigger than it should be, or choosing a framework by size |
| `references/hosts.md` | canvas vs model-driven vs Power Pages, updating a control a canvas app already has, full screen |
| `references/dataset.md` | reading a view: roles, the subgrid's chrome, paging, sorting, selection |
| `references/dataset-filtering.md` | filtering the view a dataset control is bound to |
| `references/dataset-writing.md` | writing a record from a dataset control — a Status Reason, a lookup, two routes, re-reading in place, rows in your own order |
| `references/layout.md` | fitting a table to its host, or laying anything out in a width you measured, narrow included |
| `references/dates.md` | binding or reading any date column on a field |
| `references/dates-in-a-dataset.md` | a date read through a view, a timeline, a date control's demo presets |
| `references/lookups-and-fetchxml.md` | lookup columns, a hierarchy, an aggregate over a view, FetchXML a person types |
| `references/context-apis.md` | `context` beyond the bound value: many-to-many links, web resources, table definitions, privileges |
| `references/web-api-messages.md` | calling a Web API function or action `context.webAPI` cannot |
| `references/navigation-and-events.md` | opening forms and URLs, platform dialogs, destructive commands, raising events |
| `references/files-and-device.md` | files, attachments, `context.device` |
| `references/grid-customizers.md` | anything that renders cells for the Power Apps grid |
| `references/styling-and-accessibility.md` | writing `css/<Control>.css` |
| `references/accessibility.md` | keyboard and screen reader: the Tab a form keeps, a tree or list of your own, live regions |
| `references/multiple-controls.md` | a second control in one repository |

`references/control-patterns.md` and `references/dataset-writing-and-layout.md`
are indexes mapping each section title that used to live in them to its file —
an older `SPEC.md` pointer to either still resolves.

**The other skills' references** sit beside this skill's, in
`../<skill>/references/`. A pointer written `pcfhub-publish/references/x.md`
names the skill; one in a control's `SPEC.md` written `references/x.md`
predates the split, and since every file name is unique across the five, it is
in whichever skill this table says:

| Skill | Its references |
| --- | --- |
| `pcfhub-new-control` | `scaffold-and-adopt.md`, `verification.md`, `rig-maintenance-and-checks.md` |
| `pcfhub-publish` | `pcfhub-manifest.md`, `hub-demo.md`, `hub-demo-dataverse.md`, `hub-media.md`, `releasing.md` |
| `pcf-review` | `review-checklist.md`, `review-checklist-behaviour.md` |
| `pcf-next-version` | `next-version.md` |

## Ask the hub for a model

This plugin ships the PCFHub MCP server, a read-only view of a catalogue of
published controls, each with its repository. Before writing a shape for the
first time, `search` — or `list_components` with `control_type` — finds the
nearest published control of that shape, and `get_component` returns its
`repositoryUrl` to read. `references/exemplars.md` names the one to read for
each pattern. The hub's other answers — what it holds for a control of yours,
and why it does not show — are in `pcfhub-publish`.

## Choose the control's shape

Decide once what the control binds to and how it renders. If it publishes on
PCFHub, `pcfhub.json`'s `control.type` and `control.framework` have to agree
with the manifest, so set both from this.

**type** — what the control binds to. Four values:

| | Use when |
| --- | --- |
| `field` | A **standard** control reading and writing one column. `<property usage="bound">`. |
| `dataset` | The control renders a collection — a view, a grid, a set of related records. `<data-set>`, with `property-set` roles **only if** specific columns play specific parts. A control that renders whatever the view supplies declares none and reads `dataset.columns`. |
| `virtual` | A React control that is *not* a dataset control and *not* a grid customizer, whatever it binds. |
| `grid_customizer` | A customizer for the Power Apps grid — it binds nothing and returns renderers. |

The hub derives the first three from the manifest at every release, reading
`dataset` → `virtual` → `field`, so set `control.type` to what it will conclude.
`grid_customizer` is the one it cannot derive — a customizer's manifest looks
exactly like a React virtual field control's — so the repository has to state
it. *How the hub derives `control.type`* in
`pcfhub-new-control/references/scaffold-and-adopt.md` has the detail.

**framework** — how it renders:

| | Trade |
| --- | --- |
| `react_virtual` | `control-type="virtual"`, React and Fluent UI come from the platform rather than the bundle. Styling that matches the host, current Microsoft guidance. Default choice for anything with real UI. |
| `standard` | No framework, direct DOM. Right for small controls and for anything that must run on older platform versions. The template ships this. |
| React, bundled | React packaged into the bundle of a `control-type="standard"` control. Only when a platform-provided React is unavailable or the control needs a version the platform doesn't offer. Say why in `SPEC.md`. It is `framework: "standard"` on the hub — `"react"` fails the validator. |

Reach for `standard` more often than instinct suggests — **but not on bundle
size** (`react_virtual` never bundled React; *Standard, React, and bundled
React* in `pcfhub-new-control/references/scaffold-and-adopt.md` has the
numbers). And **`standard` does not mean unlike Fluent**: a form mounts a
`FluentProvider` above every control, so read its tokens —
`references/styling-and-accessibility.md`.

### Grid customizers

The shape that breaks the assumptions above: `updateView` returns an empty
fragment, and the contribution is one `context.factory.fireEvent` handing the
Power Apps grid its cell overrides. It is assigned to a **table's grid** (one
never assigned is silently inert), and **never** through `gridCustomizer`. Read
`references/grid-customizers.md` first.

## Build the control

**Read the nearest exemplar before writing.** `references/exemplars.md` names
the repository to read for each shape and for the patterns that cut across them
— raising an event, writing to Dataverse, filtering, files, dates and more.

The four lifecycle methods are the entire contract with the platform:

```ts
init(context, notifyOutputChanged, state, container)  // set up DOM, store callbacks
updateView(context)                                    // re-render from context
getOutputs(): IOutputs                                 // hand bound/output values back
destroy()                                              // remove listeners, release memory
```

The thing worth internalising: **`updateView` runs on every change to any bound
value, including ones this control caused itself.** Two consequences show up in
almost every control:

- Anything expensive belongs behind a comparison, not at the top of the method.
- A browser moves the caret to the end whenever an input's `value` is assigned
  something **different** from what the box holds — and the platform echoes
  writes back late and out of order, so a guard comparing against one value
  takes an earlier keystroke's echo, loses what was typed after it, and jumps
  the caret. Remember the recent writes and ignore an incoming value among
  them; both of the template's scaffolds do. A control that reformats as the
  user types puts the caret back itself — *A value the control reformats as
  you type* in `references/rendering-and-hosts.md`.

Run `npm run refreshTypes` after every manifest edit. It regenerates
`generated/ManifestTypes.d.ts`, and until you do, `context.parameters` is typed
from the old manifest and `tsc` will accept code that cannot work.

**`getOutputs()` returns every bound property, and a clear is `null`, not
`undefined`** — `undefined` means "no change", and a canvas field given it
refuses to empty. The generated type only allows `undefined`, so cast:

```ts
return { value: this.value === null ? (null as unknown as undefined) : this.value };
```

*A clear is `null`, never `undefined`* in `references/properties.md` has why.

Compile against the real type definitions rather than assuming an API exists.
`ComponentFramework.WebApi` has the five CRUD methods and no `execute`, but a
Web API **function** or **action** and a many-to-many **link** are one
same-origin `fetch` away, all measured on a real form — `references/web-api-messages.md` and
`references/context-apis.md`.

**A bound property is not just `raw`.** It carries `error`/`errorMessage` (the
platform's own validation), `security` (field-level access — a user denied read
gets `raw === null`, which is *not* an empty column), and `attributes` (the
column's metadata on a form), none needing a declared feature. **A canvas app
hands over an `attributes` too, about no column** — `MaxLength: 100`, a date
`Behavior`, a default range — so believe it only when `EntityLogicalName` names
a table. *The bound property is more than `raw`* in `references/properties.md`
has the code and the measurement.

### Prove it

**`npm start` is for the happy path.** The platform's test harness renders the
control with every API answering, so it never shows the states that break
controls — denied read, a platform error, no theme, more than one page, a
missing API — and its dataset `sorting` is `undefined`, so a sortable header
throws there and renders an empty box.

A repository made from the PCFHub `_template` ships a `dev/` rig for exactly
those states — `npm run smoke` asserts against the built bundle, `npm run
harness` shows it — and **`pcf-scripts build` exits 0 when ESLint fails**, so
run `npm run lint` as its own step. *Prove it with the dev rig* in
[`pcfhub-new-control`](../pcfhub-new-control/SKILL.md#prove-it-with-the-dev-rig)
has the rig, and `pcfhub-new-control/references/verification.md` what it
reaches per shape.

**Nothing local proves the control works on a form.** What a real form does
belongs in `SPEC.md` under *Not verified*, and saying so is part of reporting a
green run.

## Before saying it's done

Claims about a PCF control are cheap to check and embarrassing to get wrong, so
check them:

- `npm run lint && npm run build` — a real `out/controls/<Control>/bundle.js`
- The rig's assertions, where there is a rig (`npm run smoke`). A repository
  whose `dev/` predates the rig has no assertions at all, which is worth saying
  rather than reporting as a pass.
- `npm run refreshTypes` if the manifest changed
- **Retake the screenshots, every interesting state in one, and look at
  them** — the only step that finds correct markup drawn wrongly
  (`pcf-data-table` 0.6.0's pass found three). Keep the recipes in a script;
  *Making it, with no new dependency* in `pcfhub-publish/references/hub-media.md`.
- If `external-service-usage` is `enabled="true"`: **the user was asked and
  agreed**, every domain is listed, and `docs/limitations.md` discloses it.
  Premium is a cost the installer pays — never flip it to make a `fetch` work.
- Every `Device.*` feature is `required="false"` unless the control is only
  that feature, and each unavailability path has an assertion behind it
- Versions agree across `package.json`, **every** `*/ControlManifest.Input.xml`
  and `Solution.xml` — `npm run bump` with no argument reports them
- The stylesheet was *looked at*, not just compiled — a selector that matches
  nothing renders quietly. *Verify it* in
  `references/styling-and-accessibility.md`.

A control that publishes on PCFHub has a few more, in *Before saying it's done*
in [`pcfhub-publish`](../pcfhub-publish/SKILL.md#before-saying-its-done).

Then say what you verified and what you did not, and keep the two apart. "Builds
and lints; the `PcfBuildMode` problem is a read finding, not an observed one —
the solution pack needs Windows msbuild" is a useful sentence. "Done" is not.
