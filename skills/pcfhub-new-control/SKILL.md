---
name: "pcfhub-new-control"
description: "Start a new Power Apps Component Framework (PCF) control from the PCFHub `_template` repository, or bring an existing PCF repository into the template's shape so it can publish on PCFHub (pcfhub.dev). Use it for \"new control\", \"scaffold\", \"start a PCF for X\", `setup.mjs` and its flags, `adopt.mjs`, \"we already have a PCF repo\", \"get it on the hub\", choosing the publisher, customization prefix and solution name, Dataverse solution packaging and msbuild solution zips, the template's `dev/` rig (`npm run smoke`, `npm run harness`, `sync-rig.mjs`), and what a green `npm run check` does and does not prove. It front-loads the three answers that are permanent once a customer imports the solution. Writing the control itself is `pcf-controls`; `pcfhub.json`, docs, the demo and the release are `pcfhub-publish`."
---

# A new PCF control, from `_template`

A control's first hour decides things nobody can change later: three answers
are permanent the moment a customer imports the solution, and a repository
that starts outside the shape PCFHub's ingestion expects spends its first
release catching up. This skill starts one from
[`pcfhub/_template`](https://github.com/pcfhub/_template), or brings an
existing repository into that shape without breaking what already ships.

The control's own code is `pcf-controls`, beside this skill. Read its
*Choose the control's shape* before scaffolding, because three of the flags
below are that choice.

## Where the detail is

| Read | Before |
| --- | --- |
| `references/scaffold-and-adopt.md` | the detail behind each `setup.mjs` flag, adopting an existing repository, and editing `_template` itself |
| `references/verification.md` | trusting a green `smoke`, or changing the dev rig |
| `references/rig-maintenance-and-checks.md` | `sync-rig.mjs`, what a green `npm run check` covers, and a pack worth quoting |

The other skills' references sit beside these, in `../<skill>/references/`,
and a pointer to one names its skill — `pcf-controls/references/exemplars.md`.
`pcf-controls`'s *Where the detail is* lists which file lives where.

## The house layout

**One control per repository by default**, each adopted from `_template`,
checked out beside them so its tools run as `node ../_template/scripts/…` —
the tree and the recommended workspace are *The house layout* in
`references/scaffold-and-adopt.md`. **A `.pcfproj` holds exactly one
control**: read `pcf-controls/references/multiple-controls.md` before a second.
`SPEC.md` is **a queue, not an archive** — a finding true of PCF moves to the
plugin's references, and **Not verified** outlives the rest (*`SPEC.md`: a
queue, not an archive* in `references/scaffold-and-adopt.md`).

## Scaffold a new control

Copy `_template` to a new sibling directory named for the slug, then adopt it.
On Windows, `Copy-Item -Recurse -Exclude` does not filter directories reliably,
so remove `.git` afterwards rather than trying to exclude it:

```bash
cp -r _template pcf-tag-list && rm -rf pcf-tag-list/.git && cd pcf-tag-list && git init
```

`setup.mjs` asks **eleven** questions. Run it interactively when the user is
present; on their behalf use flags plus `--yes`, and show them the resolved
values. **Pass every flag**: `TAGLINE`, `CATEGORY` and `OWNER` have no
default, so under `--yes` a shorter command exits 1 — and `SLUG` derives from
`CONTROL` as `tag-list`, not `pcf-tag-list`:

```bash
node scripts/setup.mjs --yes \
  --control TagList --namespace Contoso --slug pcf-tag-list \
  --title "Tag List" --tagline "A many-to-many tag picker." \
  --category data --hosts model-driven --owner contoso --repo pcf-tag-list \
  --publisher Contoso --prefix contoso
npm install && npm run build
```

**`Contoso` stands for the user's own values — ask for them.** The namespace,
GitHub owner, publisher and prefix are theirs, never another catalogue's. In
particular, **do not use `PCFHub` / `pcfhub` unless the control is published
from the `pcfhub` organisation**: that publisher is the catalogue's, a control
declared under it shares a publisher with the catalogue's own controls in every
environment that installs both, and one whose name the catalogue already uses
is the same component to Dataverse — importing one overwrites the other.

Three flags choose the shape — `references/scaffold-and-adopt.md` has what each
changes: **`--framework react`** for a React (virtual) control; **`--type
dataset`** for a view rather than a column, which composes with `--framework` (a
React dataset control is `type: "dataset"`, `framework: "react_virtual"`) and
scaffolds **a table**; and **`--type grid-customizer`**, which does not — see
*Grid customizers* in [`pcf-controls`](../pcf-controls/SKILL.md#grid-customizers).
A fourth chooses the column a standard field control binds: **`--bind number`**
(a number box over the four number types) or **`--bind yesno`** (a checkbox
with the column's own labels) instead of text.

**Read the nearest exemplar before writing.** `pcf-controls/references/exemplars.md`
names the repository to read for each shape and for the patterns that cut
across them — raising an event, writing to Dataverse, filtering, files, dates
and more.

**Three answers are permanent once a customer has imported the solution** — the
**publisher unique name** and **customization prefix** (2–8 lowercase
characters), which every component carries in its logical name, and the
solution's `<UniqueName>`, a change to which makes the next import create a
*second* solution. Surface all three to the user before running setup.

**And the prefix has to match the publisher the environment already has.** A
publisher carries one prefix, and `setup.mjs` derives the prefix from the
publisher's first five letters when it is not given — `Contoso` → `conto`,
`PCFHub` → `pcfhu` where the catalogue's is `pcfhub` — so pass it explicitly.
*The prefix has to match the publisher the environment already has* in
`references/scaffold-and-adopt.md` has the import failure.

**Commit the `package-lock.json` that `npm install` writes.** The template ships
none and both workflows run `npm ci`, so the first push of a freshly adopted
repository fails for a reason unrelated to the control.

`npm run check` fails while any `__PLACEHOLDER__` remains, and CI runs it
first. **Four are left for the author on purpose** and named by the check: the
README's three hand-written sections and `__SUMMARY__` in `pcfhub.json`. The
docs and the summary are *Write the docs* in
[`pcfhub-publish`](../pcfhub-publish/SKILL.md#write-the-docs).

## Adopt an existing repo

A control that already ships is a different job: customers may already have it
installed, so adoption is **additive** — the hub contract copied in around a
working repository. **`setup.mjs` cannot do this, and running it here is
destructive.** The template is the donor instead, run from its checkout:

```bash
node scripts/adopt.mjs --into ../my-existing-control --dry-run
```

`adopt.mjs` derives what the target can answer for itself, asks for the rest,
**never overwrites an existing file**, and ends with a "needs a decision" list —
work it. A control that bundles its own React is written as
`control.framework: "standard"` — the hub has no value for bundling — and the
list says it bundles, so `SPEC.md` can say why.

**A green `npm run check` means much less on an adopted repo**, because its
weightiest checks pass vacuously. Read `pcfhub.json` against
`pcfhub-publish/references/pcfhub-manifest.md` key by key, and run
`validate_manifest`. `references/scaffold-and-adopt.md` has each adoption step,
the manifest baggage a `pac pcf init` repository carries — `<uses-feature>`
above all — and a worked example.

## Prove it with the dev rig

Every shape ships a `dev/` directory, and it is the only thing in a control
repository that asserts anything:

```bash
npm run lint           # its own step — see below
npm run build
npm run smoke          # assertions, with an exit code
npm run harness        # serves dev/harness.html and opens it
```

- **`pcf-scripts build` exits 0 when ESLint fails**, and emits no bundle — so
  `build && smoke` tests the last successful build. Run `lint` as its own step.
- **Where the platform and the documentation disagree, the rig follows the
  platform**, and a stub models a call's refusals before its successes — a rig
  written from the control's own assumptions certifies its mistakes.
- **`npm start` is for the happy path; the rig is for the states that break
  controls** — denied read, a platform error, no theme, more than one page, a
  missing API. `npm start`'s dataset `sorting` is `undefined`, so a sortable
  header throws there and renders an empty box.
- **Nothing here proves the control works.** What a real form does belongs in
  `SPEC.md` under *Not verified*, and saying so is part of reporting a green run.

`references/verification.md` has what the rig reaches per shape, its Fluent
stub and a bundle that cannot load in Node; `sync-rig.mjs` for an old rig is in
`references/rig-maintenance-and-checks.md`.

## Before saying it's done

- `npm run check` — and read its warnings, not only its exit code: an
  unreachable hub skips the schema half with a warning. *What `npm run check`
  covers* in `references/rig-maintenance-and-checks.md` has what it does and
  does not prove.
- The publisher, prefix and solution name are the user's, and they saw all
  three before setup ran.
- `package-lock.json` is committed.
- `npm run lint && npm run build && npm run smoke`, each on its own.

Then the control itself — `pcf-controls` — and, before the first tag,
`pcfhub-publish`.
