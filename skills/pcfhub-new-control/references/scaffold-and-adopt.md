# Scaffolding and adopting, in detail

What `SKILL.md` summarises about starting a control: the layout every
repository shares, what each `setup.mjs` flag does, how the hub derives the
control's shape, and adopting an existing repository step by step.

- [The house layout](#the-house-layout)
- [What each scaffold flag does](#what-each-scaffold-flag-does)
- [`SPEC.md`: a queue, not an archive](#specmd-a-queue-not-an-archive)
- [How the hub derives `control.type`](#how-the-hub-derives-controltype)
- [Standard, React, and bundled React](#standard-react-and-bundled-react)
- [Editing `_template` itself](#editing-_template-itself)
- [Adopt an existing repo, step by step](#adopt-an-existing-repo-step-by-step)
  - [What `npm run check` will not tell you here](#what-npm-run-check-will-not-tell-you-here)
  - [Inherited manifest baggage](#inherited-manifest-baggage)
  - [Worked example](#worked-example)

## The house layout

Controls live **one per repository by default**, each adopted from `_template`
(<https://github.com/pcfhub/_template>). A repository that came from the
template looks like this:

```
<Control>/          ControlManifest.Input.xml, index.ts, css/, strings/
Solution/           the Dataverse solution that packages it (msbuild)
docs/               the pages PCFHub publishes — a closed set of filenames
media/              images and video the docs and pcfhub.json reference
demo/               dataset fixtures for the hub's demo harness — dataset controls only
dev/                a stand-in host: smoke.js asserts, harness.html shows — every shape
pcfhub.json         hub identity: slug, control shape, links, docs path, demo
scripts/            setup.mjs (adopt), check-template.mjs (CI guard), version.mjs, release.mjs
SPEC.md             what this control does and what building it taught us
.github/workflows/  build.yml and release.yml
.gitattributes      LF in every working tree, whatever core.autocrlf says
<Control>.pcfproj   the msbuild project; carries <PcfBuildMode>production</PcfBuildMode>
```

A **field** control's demo data comes from `demo.presets[].props` — **unless
its demo has to query**, in which case it has a `demo/` holding a fixture with
only a `dataverse` section: a stand-in Dataverse the harness answers its Web API
calls from. See *The demo block* in `pcfhub-publish/references/hub-demo.md`.

**"By default" rather than "always", and the exception has a shape you do not
get to choose.** A repository may hold several controls, but **a `.pcfproj` may
hold exactly one** — so a second control nests each in a project of its own, and
the repository still publishes **one** component on the hub. Read
`references/multiple-controls.md` before adding one.

**The recommended workspace** is `_template` and the control
repositories side by side, so template tools run as `node ../_template/scripts/…`
— elsewhere, `git clone https://github.com/pcfhub/_template ../_template` first,
with full history.

## What each scaffold flag does

`setup.mjs` asks **eleven** questions and generates the two project GUIDs and the
option-value prefix itself. Run it interactively when the user is present; use
flags plus `--yes` when scaffolding on their behalf, and show them the resolved
values afterwards.

**Pass every flag.** Only `SLUG`, `TITLE`, `HOSTS`, `REPO`, `PUBLISHER` and
`PREFIX` have a `derive`; `TAGLINE`, `CATEGORY` and `OWNER` have none, so under `--yes` a
shorter command does not fall back to defaults — it calls `fail()` and exits 1.
And `SLUG` derives from `CONTROL` as `tag-list`, not `pcf-tag-list`.

**The prefix has to match the publisher the environment already has.** A
publisher carries one prefix, and a solution that declares an existing
publisher with any other prefix fails to import into an environment that has
it — the publisher already exists with a different prefix. `--prefix` derives
from the publisher's first five letters when not given: the catalogue's
`PCFHub` carries `pcfhub`, the derived default is `pcfhu`, and
`pcf-geo-stamp` shipped with `pcfhb` the same way. Before the first pack, read
the publisher's `<CustomizationPrefix>` out of a neighbouring repository's
`Solution.xml`, or off the publisher in the target environment, and pass it
explicitly.

**And the publisher is the author's own.** `PCFHub` is the catalogue's: a
control from anyone else declared under it shares a publisher with the
catalogue's controls in every environment that installs both, and one whose
name the catalogue already uses is the same component to Dataverse, so
importing one overwrites the other. The namespace, publisher, prefix and GitHub
owner all come from whoever publishes the control — ask.

Add `--framework react` for a React (virtual) control. It switches
`control-type` to `virtual`, adds the React and Fluent `<platform-library>`
entries, sets `pcfhub.json`'s `control.framework`, swaps in a `ReactControl`
entry point with a `components/` directory, and adds the React devDependencies
plus `eslint-plugin-react-hooks`. Doing that by hand is five files, and the
missing ESLint plugin fails the build with "Definition for rule was not found",
which reads as a config error rather than a missing dependency.

Add `--type dataset` for a control that binds a view rather than a column. It
swaps in a `<data-set>` manifest and a dataset entry point, sets `pcfhub.json`'s
`control.type` to `dataset`, replaces `docs/api.md` with one carrying
`kind=dataset` instead of `kind=bound`, and drops a starter fixture in `demo/`.

It composes with `--framework`, and all four combinations are supported — a plain
DOM table is a perfectly reasonable dataset control. **The two flags are not two
ways of asking the same question**, and the pairing people get wrong is the React
one: a React *dataset* control is `type: "dataset"` with
`framework: "react_virtual"`, because the hub resolves dataset ahead of virtual.
`npm run check` enforces it.

Add `--type grid-customizer` for the third shape, which binds nothing and
renders nothing: a control that hands the Power Apps grid a table of cell
renderers and editors and lets the grid call them per cell. It does **not**
compose with `--framework` and rejects `--framework standard`, because the
overrides return React elements by contract. See
[Grid customizers](../../pcf-controls/references/grid-customizers.md#grid-customizers) below — the shape has enough of its own
rules that treating it as "a virtual control with an odd manifest" gets it
wrong.

Add `--bind number` or `--bind yesno` for a **standard field** control bound
to something other than text — setup refuses either beside `--type dataset`,
`--type grid-customizer` or `--framework react`:

- **`--bind number`** binds the four-type group a number column can be
  (`Whole.None`, `Decimal`, `FP`, `Currency`) and swaps in a number box that is
  typed in the user's format, commits on Enter or blur rather than per
  keystroke, refuses text, an out-of-range value and a fraction in a
  whole-number column, rounds to `Precision`, and clears to `null`. It reads
  the column's kind from `attributes` and uses `type` only as a veto — see
  *`of-type-group` costs more than it looks* in `pcf-controls/references/properties.md`.
- **`--bind yesno`** binds `TwoOptions`, drops the placeholder input, and swaps
  in a native checkbox beside the column's own label for its state. Rule out
  the platform first: a model-driven form already has a Toggle and a Checkbox
  for a yes/no column. Its echo guard is a time window, not the text
  scaffold's list — after two clicks both values are "recent", and a list
  would take a business rule's change for an echo for ever.

Each replaces the entry point, adds its strings to all five resx files in
place, and rewrites one `COLUMN` line at the top of `dev/smoke.js` and
`dev/harness.js`, so every mount in the suite runs on the right kind of column.
The rig's typed columns serve any shape without the flag: `dev/host.js` takes
`valueType`, `minValue`, `maxValue`, `precision`, `typeGroup`, `typeReport`
(`'member'`, `'group'`, `'wrong-member'`) and `locale` (`'en-US'`, `'de-DE'`),
and `context.formatting` is real `Intl` formatting with every call logged.

Note what `--type dataset` actually scaffolds: **a table**, with sortable
headers, a pager and an open-record button. That is the right default and its
comments are the traps a dataset control hits — but a dataset control that is not
a table replaces most of `index.ts` rather than adjusting it. Say so up front
rather than letting someone discover it after adopting.

The one decision the flag cannot make for you is whether to declare
`property-set` roles; the scaffolded manifest declares none. See
[the control's shape](../../pcf-controls/SKILL.md#choose-the-controls-shape).

Note that `setup.mjs` **deletes `TEMPLATE.md`** on adoption, so an adopted repo
carries none of the hub-contract documentation the template shipped with. That
knowledge lives here instead. It also deletes `variants/` and
`docs/migration.md` — a first release has nothing to migrate from — so neither
is a leftover to clean up by hand.

## `SPEC.md`: a queue, not an archive

`SPEC.md` ships in the template as a skeleton. It is where findings that outlive
a commit message go — a platform limitation discovered by compiling against the
real type definitions, a manifest shape that turned out to be wrong. Write to it
when you learn something the next person would otherwise rediscover.

**It is a queue, not an archive, and the difference is what keeps it worth
reading.** Three things do not belong in it, and each looks like diligence:

- **Measurements a build reproduces** — bundle sizes, zip sizes, whether lint
  passed. Stale the moment anyone builds, and a number sitting in git that
  nobody re-runs reads as authoritative while being wrong. Quote those in the
  release notes or the pull request, where they are dated by construction.
- **Anything already explained in a comment beside the code.** The comment is
  better placed: it is read by whoever is about to change the thing.
- **Anything already promoted to this skill.** When a finding turns out to be
  true of PCF rather than true of one control, move it into the topic file under
  `references/` that it belongs to and leave a line in `SPEC.md` naming where it
  went. Keeping both copies is how the two drift, and the copy nothing executes
  always loses.

What survives that is usually short, and short is the point — a `SPEC.md`
nobody maintains is one nobody trusts. The section that earns its keep longest
is **Not verified**: the claims a control rests on that nothing has proven. It
is what stops a release going out on an assumption, so it outranks everything
above it.

## How the hub derives `control.type`

Three of those the hub resolves from the manifest itself:
`ControlManifestParser::controlType()` reads `dataset` → `virtual` → `field`,
in that order, so a virtual **field** control is recorded as `virtual` and a
virtual **dataset** control stays `dataset` — dataset wins because "does it work
over a view or a column" is what a visitor filters on, while "is it virtual" is
already recorded in `framework`.

**`grid_customizer` is the one the manifest cannot be read back to**, and that
is structural rather than an oversight. A customizer's manifest is
`control-type="virtual"`, no `<data-set>`, one bound property — character for
character what a React virtual field control looks like. So this is the single
shape whose type the repository has to *state* rather than have derived, and
`npm run check` treats it accordingly: it validates that the manifest is virtual
and declares no dataset, and does not compare against the three-way resolution,
which would flag every customizer in the catalogue.

If the hub's parser gains a rule that separates the two, mirror it in
`scripts/check-template.mjs` — that file agreeing with the hub is the only thing
that keeps the repository's claim honest.

For the other three, the hub derives from the manifest at each release
regardless of what `pcfhub.json` says, so set `control.type` to match what the
parser will conclude. A disagreement changes nothing on the hub and quietly
misleads every reader of the repository.

## Standard, React, and bundled React

**Bundled React has no repository behind it, deliberately, and no `framework`
value on the hub.** The hub's vocabulary is `standard` and `react_virtual`, and
`"react"` fails its validator — even though `check-template.mjs`'s local list
still names it. Such a control declares `standard`, which is also what the hub
derives from its manifest at each release. Do not write a control to fill the
gap — the conditions that justify it are rare, and a manufactured exemplar would
recommend it by existing.

Reach for `standard` more often than instinct suggests: a control that is one
input and a button does not earn a React tree, and the template's `index.ts` is
already a working example of the pattern — including the platform state most
first controls forget, which is covered under
*The bound property is more than `raw`* in `pcf-controls/references/properties.md`.

**But do not sell it on bundle size.** Measured on two comparable dataset
controls, the plain-DOM one packs 7,472 bytes against the React one's 9,262 —
under 2 KB, because `react_virtual` was never bundling React and Fluent in the
first place. The real difference is whether this control is the reason the host
has to fetch the platform libraries at all, and on a form that already has a
React control it is not. See *Bundle size* in
`pcf-controls/references/rendering-and-hosts.md`; a recommendation resting on bundle bytes will
not survive someone checking.

## Editing `_template` itself

**If you are editing `_template` itself rather than a control, run
`node scripts/verify-adoption.mjs`.** The template cannot run its own
`check-template.mjs` — that script exists to fail while placeholders remain, so
it exits 1 by design — which means the template's CI has to adopt into a scratch
directory and check the result instead. That is what `verify-adoption.mjs` does,
three times over: field/standard, dataset, and React. It is the only thing that
catches a `setup.mjs` change that deletes the wrong file. It is deleted on adoption, so it is
never present in a control repo.

**`.gitattributes` (`* text=auto eol=lf`) is a shared file like the rig**
(2026-10-09). Git stores LF either way; the file makes every working tree
agree, so a repository's copy of a shared script is byte-equal to the
template's. Before it, `core.autocrlf` left some copies CRLF, and a plain
`cmp` across the catalogue's repositories called `release.mjs` drifted in
27 of 31 where no line differed. `sync-rig.mjs --add-missing` delivers it,
`--status` (and so `npm run check`) names it when it is absent, `adopt.mjs`
writes it, and `verify-adoption.mjs` asserts a scaffold keeps it. A tree that
predates it keeps its old endings until each file is next checked out:
`git checkout-index --force --all` does **not** rewrite them, because the files
look up to date by stat. On a clean tree, delete the files `git ls-files --eol`
lists as `w/crlf` or `w/mixed` and `git checkout -- .` them back.

## Adopt an existing repo, step by step

A control that already exists and already ships is a different job from
scaffolding one. The build works, the solution packs, customers may already have
it installed — so adoption is **additive**: you are copying the hub contract in
around a working repository, not reshaping the repository to match the template.

**`setup.mjs` cannot do this, and running it here is destructive.** It rewrites
`__PLACEHOLDER__` tokens across the tree and renames the `__CONTROL__` paths,
which assumes template-shaped filenames that an existing repo does not have. It
also deletes `TEMPLATE.md`, `variants/` and `docs/migration.md` on the way
through. An existing repo has no placeholders for it to fill and files it would
remove, so there is nothing for it to do and something for it to break.

So adoption runs the other way round — the template is the donor, the existing
repo is the target:

```bash
node scripts/adopt.mjs --into ../my-existing-control --dry-run
```

`adopt.mjs` derives what the target can answer for itself (namespace,
constructor, control type, framework, solution directory, git remote), asks for
what it cannot (tagline, category), and **never overwrites an existing file** —
so it is safe to re-run as gaps get filled in. `--dry-run` prints the plan
without writing. It ends with a "needs a decision" list: unused
`<uses-feature>` entries, the `release.artifacts` question, version
disagreements across the three files, a missing `PcfBuildMode`, and a
`pcfhub.json` with no `summary`.

Run it, then work that list. What it is doing, and why each step matters:

1. **Read `ControlManifest.Input.xml` and the `.pcfproj` first.** Between them
   they decide most of `pcfhub.json`: namespace, constructor, control type,
   framework, and whether `<PcfBuildMode>production</PcfBuildMode>` is already
   set. Do not ask the user for what the manifest already says.

2. **`pcfhub.json` is composed, not copied.** `control.type` and
   `control.framework` come from the manifest, applying the `dataset` >
   `virtual` > `field` precedence from
   [Choose the control's shape](../../pcf-controls/SKILL.md#choose-the-controls-shape), and
   `control.manifestPath` points at the real directory name — an adopted repo's
   control folder is named for the control, not `__CONTROL__`. For a control
   that bundles its own React — a runtime `react` dependency and no
   `control-type="virtual"` — the script writes `control.framework:
   "standard"`, the only value the hub accepts for it, and says in the "needs a
   decision" list that the control bundles React. Say why in `SPEC.md`.

3. **Decide `release.artifacts` from what the workflow attaches**, not from
   what msbuild names. The hub's defaults are `*_managed.zip` and
   `*_unmanaged.zip`; msbuild names the unmanaged zip after the **solution
   project file**, which matches neither. The template's `release.yml` closes
   that gap by renaming it to `<BaseName>_unmanaged.zip` — **found by glob, so
   it normalises any project name**. The rule is therefore not about the project
   name at all: copy the template's workflow in and you need no
   `release.artifacts` block; keep an existing workflow and you need one unless
   it already attaches something matching `*_unmanaged.zip`. `Code-Editor-PCF`
   keeps its own workflow, which copies `CodeEditorSolution.zip` by literal
   name, so its explicit block is required.

4. **`scripts/check-template.mjs` comes in with a `check` and a `lint` script**,
   because a repo scaffolded by `pac pcf init` has neither and the script is
   inert without the first. The `lint` glob is repointed at the real control
   directory — the template's is `eslint __CONTROL__ --ext .ts,.tsx`, which in
   an adopted repo lints nothing and exits green. `setup.mjs` is not copied;
   there is nothing left for it to adopt.

5. **The `docs/` closed set, `media/`, `SPEC.md` and the workflows are copied
   with the placeholders substituted.** Workflows only into a repo that has
   none — one that already releases has a pipeline that works, and the
   template's hardcodes both the control and the solution directory. When they
   are copied, `working-directory: Solution` is rewritten to the real solution
   directory, which is otherwise wrong in every adopted repo.

Then fill in the docs, write the `summary` from the overview, replace the
placeholder logo, and set `demo.fidelity` deliberately — the script writes
`none`, because nothing it can read tells it whether the control can run in the
harness. It writes no `summary` at all, and no placeholder for one: its promise
is that `npm run check` passes on the result, so the missing summary is an
advisory from the hub rather than a failure — which is easy to leave. *The
summary* in `pcfhub-publish/references/pcfhub-manifest.md` has what it may contain. *Drawing the mark* in
`pcfhub-publish/references/hub-media.md` has the scaffold every logo in the catalogue
shares, and a table of the readings that have already been tried and failed.

### What `npm run check` will not tell you here

On a fresh adoption a green check means the template was filled in. On an
adopted repo it means considerably less, because the checks that carry the most
weight pass **vacuously**:

- The placeholder scan finds nothing, because there were never any placeholders.
- Only `schemaVersion`, `slug`, `name` and `control` are required keys. A
  `pcfhub.json` with no `links`, no `docs`, no `media` and no `demo` block is
  structurally valid.
- **No `summary` is an advisory, not a failure** — unlike a repository
  scaffolded from the template, which carries a `__SUMMARY__` placeholder the
  check fails on. An adopted control can stay green with nothing under
  Overview on its page.
- The media check reads only the paths `manifest.media` names.
  **A missing `media` block is not a failure — it is an empty list**, so a
  control with no logo passes the same check as one with a logo.

So on an adopted repo, read `pcfhub.json` against
`references/pcfhub-manifest.md` key by key rather than trusting the exit code.

### Inherited manifest baggage

The other half of adoption is subtracting. A repo scaffolded by `pac pcf init`
carries defaults the pcfhub template does not, and they survive the migration
because nothing complains about them.

**`<uses-feature>` is the one that costs the customer.** Every declared entry
becomes an install-time permission prompt, so a control that declares features
it never calls is asking for consent it does not need. `npm run check`
warns about this — it is a warning rather than a failure because the test is a
regex over source, and a feature reached through a destructured `context` would
slip past it.

**Read the block before believing it, and mind the comment markers.** Both this
template and `pac pcf init` ship the feature list inside an
`<!-- UNCOMMENT TO ENABLE THE SPECIFIED API -->` block. Commented-out entries
are not declared, cost nothing, and are the normal state of a stock manifest —
so a grep for `uses-feature` reports eight findings on a repository that has no
problem at all. `Code-Editor-PCF` looks exactly like this: eight entries, all
of them inside the comment, none of them declared. The check strips comments
first for the same reason.

The real finding is narrower: a `<feature-usage>` block somebody actually
enabled and then stopped using. That happens, and it is worth deleting — but it
is a different thing from the stock block, and the two are one `<!--` apart.

This does not change the fidelity rule in [The demo](../../pcfhub-publish/SKILL.md#the-demo). A declared
`<uses-feature name="WebAPI">` is still evidence that a user-visible path leaves
the browser. A commented-out one is not evidence of anything.

While you are in there, check the `external-service-usage` node. Left enabled
without cause it marks the control premium.

### Worked example

`Code-Editor-PCF` is a migration that got the hard parts right — explicit
`release.artifacts`, `PcfBuildMode` already production, versions agreeing across
manifest, `Solution.xml` and `package.json` — and for a year stopped short of
the rest: no `scripts/`, no `check` or `lint` script, no `SPEC.md`, no
`demo.styles`, and a `build.yml` switching three shared steps off. 1.2.0
closed all of it, and how is worth reading before adopting the next one:
`check-template.mjs` and `serve.js` copied in as-is; the stock `pac pcf init`
ESLint config — which fails on `ComponentFramework` itself, and is why the
repository never had a lint script — replaced with the template's, along with
the toolchain versions the template pins (`pcf-scripts` 1.14 could not run
`refreshTypes` under TypeScript 5); and a smoke suite that could not load the
bundle, resolved as described under
[When the bundle cannot load in Node](verification.md#when-the-bundle-cannot-load-in-node).
What it keeps of its own is the release workflow, for the reason its comment
gives.

Its manifest is worth reading too, for the opposite reason — it is the textbook
case of the commented-out feature block that looks like a finding and is not.
