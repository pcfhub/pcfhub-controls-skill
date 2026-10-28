# Shipping a new version of a shipped control

The job that starts with "what should the next version do" and ends where
[Release](../../pcfhub-publish/SKILL.md#release-and-the-hub-contract) begins. It is different from
[Build](../../pcf-controls/SKILL.md#build-the-control) in one way that decides most of it: **somebody
already has this installed.** Every change is now a change *to* something,
paid for by a maker who did not ask for it.

- [Pick the features outward, not inward](#pick-the-features-outward-not-inward)
- [Measure before you write, with a probe build](#measure-before-you-write-with-a-probe-build)
- [What makes a change breaking](#what-makes-a-change-breaking)
- [`docs/migration.md`, and the trap in `appliesTo`](#docsmigrationmd-and-the-trap-in-appliesto)
- [Bump every version location, before the tag](#bump-every-version-location-before-the-tag)
- [Reread `docs/limitations.md` for what the release closes](#reread-docslimitationsmd-for-what-the-release-closes)
- [What does not change](#what-does-not-change)

## Pick the features outward, not inward

The catalogue's releases that landed picked from what the control could not do
and readers could see: `pcf-data-table` 0.4.0 came from an audit of what the
community asks an editable grid for, and found all three answers sitting in its
own `docs/limitations.md` **as refusals**. 0.5.0 came from the same place.

So read `docs/limitations.md` first, and read it as a backlog rather than as
documentation. A limitation that is there because the platform refuses is a
fact; one that is there because nobody wrote it yet is the next release. The
file rarely distinguishes them, which is why reading it is a job rather than a
lookup.

`pcf-tag-list` 0.3.0 is the other half of the method: its limitations page
named the gap (no attach, removal that deletes), and the community's most
repeated model-driven request — a multi-select lookup over a many-to-many —
named the same gap from outside. When the backlog and the demand agree, that
is the release. `pcf-lookup-search` 0.2.0 was chosen the same way: "No
filtering beyond the columns you name" on one side, the cascading-lookup
question the forums answer with `addPreSearch` script on the other.

**First, what the repository already owes.** Commits since the last tag that
change the control reach no maker until a release, and `git status` calls the
tree clean all the same: `git log $(git describe --tags --abbrev=0)..HEAD`
lists them. Across a workspace of several repositories,
`node _template/scripts/workspace-status.mjs` sorts each one's commits since
its last tag into **release** (only a tag reaches a maker), **live** (the hub
reads the branch) and **tooling**, and lists the release ones by subject.

**Where "the demand" comes from.** Read every source, every time — the ones
that move a reading are rarely the ones expected to:

| Source | What it answers | How to read it |
| --- | --- | --- |
| GitHub topics `powerappscomponentframework`, `pcf-controls`, `pcf` (each `?o=desc&s=stars`; filter Cloud Foundry out of the last) | which *kinds* of control the community stars | A floor, not a signal of change: the top of the list — editable grid, upload, calendar, timeline — barely moves, so a quick look is enough and only a *change* is worth reporting |
| The PCF Gallery request board **ranked by votes** — `pcfgallery.userecho.com/communities/1-general/topics?order=top&type=0&status=0&tag=all` (WebFetch is refused there; read it in a browser) | what people asked for by name, with votes | **Not the front page**: that lists *recently updated* topics, and read alone it once hid the board's two most-voted requests (30 and 28 votes) while showing a 9-vote one. **And not page 1 alone**: read page 2 by clicking the pager's **2** — `?page=2` in the address is ignored and lands on page 1 again. Page 2 went unread for twenty-seven runs while it held a 7-vote request (a button that runs a flow) that a second board also carried, and that became a release |
| Microsoft's *Important changes (deprecations) coming*, on Learn — **and its canvas page**, `learn.microsoft.com/power-apps/maker/canvas-apps/important-changes-deprecations`, which the main page only links to | what the platform is **taking away** — and, for a probe, what it is taking away from *you*: see [the environment has to outlive the probe](#measure-before-you-write-with-a-probe-build) | **Read the whole page, not only what is new since you last looked.** The platform's Input Mask, deprecated in January 2023, sat far down it and became `pcf-input-mask`; the hierarchy control removed in October 2025 became `pcf-hierarchy-view` |
| Hub downloads — `list_components` with `sort: "popular"` | which shipped controls people actually install | **Report the movement, not only the order**, and over a week as well as a day — a day is too short to read, and on a quiet one every control moved by 0. The tool has no memory, so keep each reading, dated, for the next one to compare against. The version it lists is **the hub's**, not the repository's: compare it with the tag before calling a release unpublished |
| The control's own `docs/limitations.md` | the gaps already written down as refusals | Nearly every *improve* comes from here |
| A web search for the gap in the user's words, not the platform's ("filter lookup by another field", not "dependent lookup"), plus the community forums and `ideas.powerapps.com` | whether the gap is a repeated question | A question asked again and again, answered with a script, is a control |
| Microsoft's own `/pcf` skill backlog — `microsoft/power-platform-skills`, the issue titled *[pcf][Enhancement] /pcf backlog* | what Microsoft's own tooling plans to generate | A recipe listed there is a control a maker may soon get from Microsoft's skill, and one it does not list is still open — read it for competition as much as for demand. WebFetch reads the issue's own edit date: quote that, not the day it was read |
| A vendor's vote board — Resco's *vote for the next PCF control*, `wpt.resco.net/pcf` | what one vendor's own audience asks for next | The counts are small and undated, so it breaks a tie between two other sources rather than ranking anything on its own |

PCF Gallery's own listing is for breadth — it has no popularity order — and a
gap three competing controls already fill is a smaller release than it looks.
A pick is strongest where two sources agree: Row Commands 0.2.0 was the #2
download *and* named both of its gaps on its own limitations page. Form Action
Button 0.2.0 had three: the same request on two vote boards (a button that
runs a flow — 7 on PCF Gallery's page 2, 3 on Resco's), the control among the
week's download movers, and *It does not talk to Dataverse* on its own
limitations page. Read the boards against each other, not one at a time — a
request that is mid-table on each can be the only one both carry.

**Before any of it, rule out the platform.** Read Microsoft
Learn's *List of controls available for model-driven apps* and the form
designer's own column settings: a signature pad duplicates the native pen
input control, and single-relationship lookup filtering is the designer's
*Filter by related rows*. Both surfaced as "requested" in a demand search on
2026-09-23 and neither is a release; what the platform does *not* cover — a
filter it has no setting for, a shape it has no control for — is. The same
page decided `pcf-number-slider` (2 Oct 2026): its input controls list a
**Toggle** and a **Checkbox** for Yes/No columns, so a toggle was dropped from
the plan, and nothing for a number column at all — the Linear Slider, Linear
Gauge, Arc and Radial Knob went in the 2021 deprecation wave and Number Input
in 2023, with no replacement listed. Read the list and the deprecations page
side by side: a deprecated control the list does not replace is a gap the
platform made.

**And the command bar, for anything that is a button.** Modern commanding runs
Power Fx on the selected rows, so check what it cannot do before building a
command: Learn's *Using Power Fx with commands* lists the `Environment` object
among the unsupported areas, and *Connect to Dataverse* says Dataverse actions
with parameters are "not fully supported in Power Fx commanding" — so a button
that calls a Custom API with arguments has no platform route, and nor does any
button **on the row** (the command bar has no per-row location). That decided
`pcf-row-commands` 0.4.0 (16 Oct 2026), taken once the rule-out and the
download figures agreed.

**The platform also gives back, and the grid is where it is doing it.**
Learn's *Custom column visualizations for grids* (preview, first read 4 Oct
2026) is a setting on the **column** — Radial Dial, Line Chart (a text column
of comma-separated numbers), Heat Map (green → amber → red over a range, a
choice by its value) and Star Rating — that every grid and view showing the
column then draws, with no control assigned. That is the grid half of
`pcf-sparkline`, `pcf-grid-data-bars` and `pcf-star-rating`, and all of a
red/amber/green status request *in a grid*. Forms are untouched, so a
by-demand pick in that territory is a forms release, and a shipped control
whose docs do not say why it rather than the column setting owes its
`overview.md` a sentence. Read that page with the controls list every run:
a preview is where the next encroachment shows first.

**Sync the rig before the first line.** An old repository's `check-template.mjs`
and rig predate everything the template has learned since; run
[`sync-rig.mjs`](../../pcfhub-new-control/references/verification.md#keeping-the-rig-current-sync-rigmjs) and commit the result on
its own, so the release's diff is the release's.

## Measure before you write, with a probe build

**The pattern worth copying from `pcf-data-table`, three releases running.**

Cut a throwaway build whose only job is to ask the platform the questions the
release rests on — `<Control>/probe.ts`, parked on
`window.__pcfDataTableProbe` from `updateView`, imported from `index.ts` with a
comment saying the import is throwaway too. Bump it a patch above the current
version so it imports as an upgrade. **A new repository probes below its first
release instead** — 0.0.1, 0.0.2 — so 0.1.0 stays free; `npm run bump -- 0.0.1
--allow-lower` sets it, and the flag is only right while no environment has
imported a build. **And confirm the page runs it — the version on the record
is not the code in the page.** `pcf-input-mask` 0.0.3 answered `0.0.3` in
`customcontrols` while the form still ran 0.0.2's `bundle.js`, and a probe
answer taken then would have described the wrong build (2026-09-28). **Ask the
running code, not the network:** have the build expose something only it has —
a version string, or the probe's own global — and read it from the console
(`Object.keys(window.__pcfNumberSliderProbe ?? {})`). Don't look the bundle up
in `performance.getEntriesByType('resource')`: on an account's Information form
(2026-10-03) a running Number Slider left **no** resource entry with its name,
and the `fetch` of the `undefined` URL crashed inside the app's own fetch
wrapper. **In a canvas app the gap is wider still**: the published app runs a
copy of the bundle inside its own package, and importing the probe changes
nothing there until the app is saved and published again in Studio — see [A
canvas app runs its own copy of the
control](../../pcf-controls/references/hosts.md#a-canvas-app-runs-its-own-copy-of-the-control).
Then, on a real form, call it from the
browser console and paste the answers into `SPEC.md` **verbatim, with the
date**.

**And the environment has to outlive the probe.** A probe is answered on a
form somebody keeps, and the walkthrough comes back to the same form weeks
later. Microsoft has deprecated **unmanaged developer environments** — the
kind the free Power Apps Developer Plan creates — and the deprecations page
(first read on it 17 Oct 2026) sets the dates: none can be created from
15 Nov 2026, and existing ones are **suspended from 15 Dec 2026 and deleted
from 15 Jan 2027**, apps, forms and data with them.
Default, sandbox, production and trial environments are untouched, and so
is a developer environment that is a *managed* one. So before the first
probe build, check which kind the test form lives in: `pac env list` names
the environments, and the admin centre's environment list filtered on
**Type = Developer, Managed = No** names the ones at risk.

Two rules make it worth the round trip, and without them it is just a slower
way to start:

- **An answer that goes the wrong way removes the feature that depends on it**,
  rather than being worked around. 0.4.0 probed the Lookup editor and cut it;
  0.5.0 probed it again and shipped it. A feature that survives a probe is one
  whose design is known rather than hoped for.
- **Every answer lands before a line of the feature exists.** Writing first and
  probing after produces a probe that confirms what was already built, which is
  a different and much less useful activity.

What to probe: anything the release rests on that this repository has not
watched. That includes things a *sibling control* measured — a sibling
measuring something is not the same as this control measuring it, because the
hosts differ (a bound lookup's dataset answers `getViewId()` differently from a
subgrid's) and because the repository's own `SPEC.md` already records one case
of trusting a sibling and being right for the wrong reason.

And probe the type definitions hardest of all. **A required member is a claim
about the typings, not about the host.** `dataset.sorting` is declared
`SortStatus[]`; `npm start` supplies `undefined`. `mode.trackContainerResize`
is declared present; a control that does not call it reads `allocatedWidth` as
`-1` forever. Each of those shipped.

## What makes a change breaking

Semver on a 0.x control is a weaker promise than it looks, and the useful
question is not "which number moves" but **"what does an existing installation
do differently after the upgrade, that nobody asked for".** Four things, in
descending order of how much they cost:

- **A new `<uses-feature>`.** The most expensive change available, and the one
  that looks free. It adds an item to the import prompt in every environment,
  which means somebody with change control has to approve an upgrade they were
  expecting to be routine. Declare it `required="false"` so declining costs
  only what that feature buys, say in the release notes exactly what it buys,
  and if a release can avoid one, say *that* in the notes too — it is a
  genuinely good line.
- **A renamed or retyped property.** The manifest is the API. A renamed
  property silently reverts to its default on every form it was configured on,
  because the old name is not there to read. This is what `docs/migration.md`
  exists for.
- **A new `required="true"` property**, which is the same failure with a
  louder symptom.
- **A changed default.** `pcf-data-table` adds `exportScope` defaulting to
  `loaded` rather than making the new behaviour the default, so an existing
  installation is byte-identical after the upgrade. That is the shape to copy:
  **a new feature arrives switched off.**

An output is permanent in a way an input is not — a canvas app may already
bind it — so "an output nothing needs is API surface that cannot be taken
back" is a real rule and not caution.

## `docs/migration.md`, and the trap in `appliesTo`

The page for "what broke and what to change". It is **deleted on adoption**
because the template's copy ships `appliesTo: ">=1.0.0"`, which matches no
release of a control starting at 0.1.0 — the hub reports the range as matching
nothing and **skips the page silently**, and `npm run check` cannot catch it
because it validates filenames and not frontmatter.

So write it when the first breaking change lands, and pin `appliesTo` to the
version actually being cut. `npm run bump` offers the page on a bump that looks
breaking, already pinned, from `scripts/templates/migration.md` — **and a minor
bump of a 0.x control looks breaking whether it is or not.** It *writes* the
page, unfilled; `pcf-kanban-board` 0.4.0 broke nothing, `git add docs` took the
page into the bump commit, and `npm run check` passed it. `check-template.mjs`
now refuses the unfilled page (2026-09-29): fill it in, or delete it when
nothing broke — and stage `docs/` by name after a bump, not by directory.

What belongs there rather than in the release notes: anything a reader has to
*do*, especially anything needing a data migration. The notes are read once by
somebody deciding whether to upgrade; this page is what they land on afterwards.

**One thing to do belongs there whenever a release changes what a canvas app
shows: open the app in Studio, save and publish.** The import alone leaves
every published canvas app on the old build — see [A canvas app runs its own
copy of the
control](../../pcf-controls/references/hosts.md#a-canvas-app-runs-its-own-copy-of-the-control).
`pcf-date-range-picker`'s 0.3.2 section says it.

## Bump every version location, before the tag

```bash
npm run bump                 # report; exits 1 if they disagree
npm run bump -- --minor      # set them all
```

🔴 **From PowerShell the flag never arrives.** There `npm` is `npm.ps1`, and
PowerShell's parameter binder takes a bare `--` for itself. So `npm run bump
-- --minor` runs the script with no flag, and it prints the version report and
changes nothing. It was measured on 2026-10-17 with a script that printed its
own arguments: `[]`. Positional arguments survive (`npm run bump -- 0.8.1`).
Quote the separator, `npm run bump '--' --minor`, call `npm.cmd`, or run the
script directly: `node scripts/version.mjs --minor`. The same goes for `npm
run release -- --draft` and `--push`. Read the report line afterwards:
*All 3 in agreement at* the **old** version means the bump did not happen.

The version lives in `package.json`, in **every**
`*/ControlManifest.Input.xml` in the tree, and in
`Solution/src/Other/Solution.xml`. `release-reusable.yml` checks the tag
against every manifest and `Solution.xml` — not `package.json`, which only
`npm run check` compares. The workflow runs on a tag already pushed, where a
mismatch means deleting the tag locally and remotely, fixing, and retagging;
`npm run check` runs the same comparison, `package.json` included, before
anything is pushed.

Do it **by anchor, never by pattern**, if doing it by hand. A manifest carries
three kinds of `version=` attribute — the control's, a `<resx>` schema version,
and one per `<platform-library>` — and a `s/version="[\d.]+"/…/` corrupts all
three while the repository still builds. `Solution.xml` has the same trap one
element apart, in `<ImportExportXml version="9.1.0.643">`.

**`package-lock.json` is a fourth copy and is left alone**: npm rewrites it on
the next install, and a hand-edited lock is worse than a stale one.

## Reread `docs/limitations.md` for what the release closes

The release was picked by reading `docs/limitations.md` as a backlog; the bump
is where that reading is closed. **Before committing the bump, read the page
against the release notes, line by line**, and for every gap this release
closes:

- **Delete the refusal.** The hub publishes `docs/` from the default branch,
  not from the tag, so a line saying the control cannot do what it now does is
  live on the component page from the next sync — beside release notes saying
  the opposite. It also misleads the next backlog read into proposing the same
  feature again.
- **Write the new feature's own limits in its place.** A shipped feature does
  not close a gap; it moves it. What the feature does not cover, which host it
  degrades on, and what nobody has measured belong on this page — usually as a
  section of their own, the way *What filtering covers* sits beside *Not in this
  release*. `SPEC.md` is where to look: every "document rather than fix" and
  every *Not verified* line the release wrote is a candidate.
- **Check the pages that repeat it.** The *Canvas apps* and *In the hub's demo*
  sections of the same page, `demo.limitations` in `pcfhub.json`, and any FAQ
  answer that says "not yet".

Put the edit **in the bump commit**, so the page and the tag reach the hub
together. Edited before the bump, the page describes a release that does not
exist yet; edited after, it is the miss this step exists to catch.

`pcf-data-table` is why this step exists. 0.6.0 was picked from the line *"No
grouping and no aggregate row"*. 0.6.19 shipped grouping with totals, and that
line stayed on the published page. Its `SPEC.md` even deferred one of
grouping's rough edges — a group larger than a page pages within itself — to
`docs/limitations.md`, and the page never said it. `npm run bump` now ends by
naming the page; the reading is still yours.

## What does not change

**There is no `CHANGELOG.md`, and adding one is a mistake with three separate
statements against it.** The hub builds the changelog from release notes;
`docs/changelog.md` is a hard failure in `check-template.mjs`. The tag message
is the changelog. See [Release](../../pcfhub-publish/SKILL.md#release-and-the-hub-contract).
