# Keeping the rig current, and what the checks prove

`sync-rig.mjs` for an adopted repository's copies, what a green `npm run check`
does and does not cover, and the local pack that is the only production
compile.

Split out of `verification.md` on 15 Oct 2026, so each file can be read whole.

- [Keeping the rig current: `sync-rig.mjs`](#keeping-the-rig-current-sync-rigmjs)
- [What `npm run check` covers](#what-npm-run-check-covers)
- [A local pack, and a clean one](#a-local-pack-and-a-clean-one)

## Keeping the rig current: `sync-rig.mjs`

A repository's `scripts/` and `dev/` are **copies**, and they stop moving the
day it is adopted — so picking up an old repository starts with a sync, run from
the template like `add-control.mjs`:

```bash
node ../_template/scripts/sync-rig.mjs --report ..          # every repo, writes nothing
node ../_template/scripts/sync-rig.mjs --into . --dry-run
node ../_template/scripts/sync-rig.mjs --into . --add-missing
```

It replaces a shared file only when that file equals **some past version** of
the template's copy (searched in the template's git history, after this
repository's token substitution, line endings normalised). Equal to none, it
was edited on purpose: reported, kept, and replaced only by `--force <path>`.
`host.js`, `fixture.js`, `smoke.js` and the harness pages are the control's own
and are never written — every repository has edited its host, so bringing a
newer one in is a reading job: take the template's `variants/<shape>/dev/host.js`
and port the control's changes onto it, not the other way round. It refuses a
dirty tree so the sync is its own commit; run `npm run check` and
`npm run smoke` before committing it, since the newer check can fail a
repository the old one passed. That is the point of running it.

`--report` takes the directory that **holds** the repositories — `..` from
inside one, `.` from the workspace. Pointed one level off, it fails naming
the directory rather than printing an empty table that reads as "nothing is
stale".

**After a template change, sweep every repository at once** (template
30c0d2c, 2026-10-13):

```bash
node ../_template/scripts/sync-rig.mjs --sweep .. --dry-run
node ../_template/scripts/sync-rig.mjs --sweep .. --commit
```

It writes **stale files only**: a modified copy is kept and named, nothing
missing is added, `package.json` is not touched, `--force` is refused, and a
repository with uncommitted changes is skipped rather than stopping the run.
`--commit` makes one commit per repository holding just those files, and
nothing is pushed — run `npm run check` and `npm run smoke` in each, then push.
Its first run took 29 repositories from stale to current (check-template.mjs
in 29, dom.js and hub-demo.html in 25) with every suite green.

**`npm run check` now says when the copies fall behind** (template f95cb76,
2026-10-08). With a sibling `../_template` it runs `sync-rig.mjs --status .` —
one line, never a failure — and passes it on as a warning naming the stale,
missing and locally edited files and the command to fix them. It exists
because a stale `check-template.mjs` cannot report itself: 25 of 31
repositories carried one that day, and all 25 passed. CI has no sibling
template, so CI stays quiet; a warning there would be about the runner, not
the repository.

**A dataset host gains a surface by hand.** When the template's
`variants/dataset/dev/host.js` grows one — `events` and `webResources` on
2026-10-08, for `pcf-row-commands` 0.3.0 — a control that needs it merges just
those hunks into its own host, by anchor, and commits that before the feature.
Taking the whole template host is the port described below, and a larger job.

**Porting a host is where the rig earns its keep.** `pcf-lookup-search`'s own
host answered `lookupObjects` in the shape the control expected; moved onto the
template's, which answers in the measured one, the first run failed on a Browse
pick written back braced and upper-case. The control had shipped that way.
`pcf-kanban-board`'s port (2026-09-29) did it again: the template's host
answers a Choice's `getValue` as the string a form sends, the board's own
answered a number, and two assertions failed on a reconcile that had never
retired an override against data on any form. Commit the port with the
failures showing and the fix after it, so the history says which found which.

**Control code is shared the same way.** `sync-rig.mjs` also keeps
`<Control>/lib/<name>/*.ts` current from `_template/variants/lib/<name>/`, but
only in a control that has made that folder. None of them is ever scaffolded.

| Library | What it does | Where it is documented |
|---|---|---|
| `view-aggregate` | Aggregating a view through FetchXML | `lookups-and-fetchxml.md` |
| `close-when-hidden` | Closing a portalled list when its anchor scrolls out | — |
| `tree-keys` | A tree's keyboard | `accessibility.md` |
| `related-rows` (2026-10-17) | A FetchXML link fragment with `{id}`, parsed for `dataset.linking` and back into FetchXML | *Rows related through another table* in `pcf-controls/references/dataset-filtering.md` |
| `config-source` (2026-10-17) | A property that is inline or names a web resource | `context-apis.md` |

`verify-adoption.mjs` checks each library's behaviour, and it checks
view-aggregate's operator table too: a dataset's 75–79 are not the SDK's.

**`dev/linked.js` is the dataset rig's linking**, shared like `dom.js` and
added only where `dev/host.js` requires it. A harness page loads it before
`host.js`, and a host without it has no `linking`. `verify-adoption.mjs`
drives it through an adopted copy (the only place `host.js` and `linked.js`
share a folder).

**`loadedBy` can name a folder.** `dev/keys.js` is loaded by a walk of its own
(`dev/keys-walk.js`), never by the suite, so its `loadedBy` is `dev/`: any file
there that requires it. Until 2026-10-17 it read as *missing* in the twenty
repositories that press no key.

**On a dirty tree, `--allow-dirty`, never a bare `--force`.** `--into` refuses
uncommitted changes so a sync lands as its own diff. `--allow-dirty` runs
anyway and changes nothing else. A bare `--force` runs too, **and replaces
every locally modified file**. Passed on 2026-10-17 just to get past a dirty
tree, it overwrote `pcf-data-table`'s own `dev/modules.js` and `dev/serve.js`.
Making a `lib/` folder dirties nothing, because git does not track empty
folders.

**Editing a template variant's rig? `verify-adoption.mjs` does not run its
suite.** It adopts and asserts the files, and never builds; the dataset
variant's `smoke.js` — where the rig's self-checks live — only runs in CI. To
run it locally: copy `_template` to the scratchpad, `node scripts/setup.mjs
--yes … --type dataset`, junction a sibling repository's `node_modules` in
(`New-Item -ItemType Junction`; the dataset toolchain is the same), then
`npm run build && npm run smoke`. Copy a changed `dev/host.js` over and
substitute `__CONTROL__` to re-run without re-adopting.

`--add-missing` follows the shape rather than the template's file list: a
**grid customizer**
gets no `dom.js`, `clock.js` or `serve.js` (setup replaces its `dev/` with a
harness and a suite, because nothing a customizer runs loads them);
`dom.js`, `clock.js` and `modules.js` arrive only where **`dev/smoke.js`
requires them** — matched as a `require`, since `Code-Editor-PCF`'s suite
*mentions* `dom.js` in the comment explaining why it never loads the bundle, and
requires `./modules` and nothing else of the rig; `fluent-stub.js` and
`virtual-bundle.js` only where there is a **`dev/harness.html`** for them to
serve; and a `package.json` script only when its file is there or arriving.
The browser tools follow the same rule (from 4 Oct 2026): `dev/cdp.js`,
`dev/hub-demo.html` and `dev/demo-check.js` are the template's, kept current
and added by `--add-missing` to every shape but a customizer; `dev/shots.js`
is the control's own recipes and is never written, so its `shots` script
arrives only where the repository already has one. From 11 Oct 2026
`dev/keys.js` joins them: real key presses over `cdp.js` (`press`, `type`,
and `focused` for where focus is and what its `aria-activedescendant` names),
because `dom.js` models no `keydown` and no bubbling. The walk that uses it is
the control's own, like `shots.js` — `pcf-code-editor`'s `dev/keys-walk.js`
(`npm run keys`) is the first; *A tree or a list of your own* in
`pcf-controls/references/styling-and-accessibility.md` says what it has to assert.

**The history search needs history.** A shallow clone holds one version of
every file, so nothing is ever "stale" in it — only current or edited. Run
the tool from a full clone of `_template` — and in CI, remember that
`actions/checkout` fetches a single commit unless told otherwise.

**A locally edited copy can be one the template later took in.** Both grid
customizers carried a `check-template.mjs` edit from 2026-08-30 that had since
landed in the template unchanged; the tool cannot know that and reports them as
edited. Read the diff, and `--force` when the edit is already upstream.

## What `npm run check` covers

Know what `npm run check` covers, because it is easy to read a green check as
either broader or narrower than it is. This is the one full list; the reference
files point here.

**The `pcfhub.json` schema is the hub's, asked rather than copied.** The script
posts the file to `https://pcfhub.dev/api/v1/manifest/validate` — the same
`ManifestValidator` ingestion runs — and reports its errors as failures and its
warnings as warnings, each by JSON Pointer. That covers the required keys, the
`control.type`, `control.framework`, `demo.fidelity` and `demo.host`
vocabularies, a `limited` demo listing its `demo.limitations`, and the grid-host
rules (no fixture warns; `fidelity: "full"` fails). **An unreachable hub is a
warning, not a failure**, so a green check run offline has not verified the
schema at all — read the warnings, not just the exit code. `PCFHUB_URL` points
it at another hub.

**Everything the hub cannot see is checked locally:**

- placeholders gone — including the four left for the author: the README's
  three sections and `__SUMMARY__` in `pcfhub.json` — `pcfhub.json` parses,
  `control.manifestPath` resolves
- `control.type` and `control.framework` agree with the manifest that path names
  (`dataset` > `virtual` > `field`; a `grid_customizer` must be virtual with no
  `<data-set>`)
- `docs/` exists, every page is in the closed set, there is no `changelog.md`;
  a `hosts` entry with no `docs/<host>.md`, or the page with no host, warns
- every media path `pcfhub.json` names exists — logo, screenshots, video,
  poster, captions
- `demo.datasetFixture` exists, parses, and has the shape its reader expects:
  `columns` and `records` arrays for a dataset control or a grid host, a
  `dataverse` object for anything else (see *The demo block* in
  `pcfhub-publish/references/hub-demo.md`) — and, from 12 Oct 2026, so does each fixture a
  preset names for itself, once per path and under the key that first names
  it. A copy of the script from before that passes a preset whose file is not
  there
- a grid host's manifest declares `<platform-library name="React" />`, because
  the harness refuses to boot one without it
- once a build has run and `fidelity` is not `none`, `demo.bundle` and
  `demo.styles` exist
- the version agrees across `package.json`, every `*/ControlManifest.Input.xml`
  and `Solution.xml`
- a repository building more than one control warns that the hub publishes one
- `out/controls/*/bundle.js` against the 5 MB web-resource limit, **failing only
  on a production bundle**. `npm run build` always writes the development one
  (webpack's "neither made for production" banner is in its first lines), and
  an over-limit development bundle warns and points at the pack —
  `Code-Editor-PCF`'s Monaco development bundle is 12.5 MB while its packed
  bundle fits.

And across **every** control in the repository, not just the published one:

- a declared `<uses-feature>` that nothing in the control's sources appears to
  call warns, and so does a `Device.*` feature declared `required="true"`.
  Comments are stripped first, so the stock commented-out block does not trip it.
- `external-service-usage` enabled with no `<domain>` fails; enabled at all
  warns, because it makes the control premium.
- **A property named `labels` fails**, and one named after any other FormXML
  element (`label`, `parameters`, `tabs`, `sections`, `cell`, `events`…) warns.
  The classic form designer writes a configured property under the cell's
  `<parameters>` by its name, and publishing the form then fails on `<labels>`
  with *…don't recognize as having a valid LabelTypeCode* — measured
  2026-09-19; see *The manifest* in `pcf-controls/references/manifest.md`.
- The `.resx` files agree with the manifest and with each other: a `.resx` on
  disk that the manifest does not list (never packed, so that locale falls back
  to English while the repo looks translated), a `<resx path=>` pointing at a
  file that is not there, a key present in 1033 and missing from another
  language (renders as the key name, in that language only), and a `{0}`
  dropped in translation all fail. An extra key that 1033 does not have is a
  warning rather than a failure — dead weight, but usually the trace of a
  rename that landed in one file only.
- **The rig's English table** — `var STRINGS = { … }` in `dev/host.js`, what
  the harness page and the screenshots read — warns when it lacks a key the
  control's source names, or words one differently from the 1033 `.resx`
  (from 16 Oct 2026). It is a hand copy, the suite never reads it by design
  (its own `getString` answers `resx:<key>`), and `pcf-row-commands` 0.4.0's
  new strings showed as raw keys in a screenshot before anything noticed. A
  property's display name and description are the manifest's, never drawn by
  the harness, so they are not compared. Its first run found Tag List 24 keys
  behind and Lookup Search 10.

Placeholders are compared as a **set**, deliberately: German and Japanese move
`{0}` to the other end of the sentence, and the dataset template's
`"{0}–{1} of {2}"` reorders all three in Japanese. Flagging that would teach
people to write worse translations. A control shipping one language skips the
comparison entirely — shipping only English is a choice, not a mistake.

It does **not** validate images referenced from the docs, whether
`demo.fidelity` is *honest* — only that it is spelled correctly — whether a
fixture's columns match what the control reads, or whether the *code* matches
`control.type` and `control.framework`. Those stay review-enforced.

**Read the script rather than assuming its coverage.** A repository adopted from
an older `_template` carries the older `check-template.mjs` — its `scripts/`
directory is a copy, not a link — and may predate any of the above, the call to
the hub included. Run `node ../_template/scripts/sync-rig.mjs --into . --dry-run`
before trusting a green check; see
[Keeping the rig current](#keeping-the-rig-current-sync-rigmjs).

## A local pack, and a clean one

The solution pack needs Windows and msbuild — but on a Windows machine with
Visual Studio or the Build Tools installed, that is available locally, so check
before assuming it is CI-only:

```bash
"C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe" -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe"
```

Run it from `Solution/` as `msbuild /t:build /restore /p:configuration=Release`.
Worth doing: it is the only local step that compiles in **production** mode, so
a green `npm run build` is not evidence the shipping bundle compiles. From Git
Bash, the `/t:` and `/restore` switches get mangled into paths — use PowerShell,
or prefix `MSYS_NO_PATHCONV=1`.

**A green msbuild is not evidence either, unless the tree was clean.** The pack
is incremental: with `obj/` up to date from an earlier run it skips the PCF
build and reports both packs complete, leaving whatever `npm run build` last
wrote sitting in `out/`. That is how a *development* bundle — eval-wrapped,
twice the size, carrying webpack's own "neither made for production" banner —
ends up being measured and reported as the shipping one.

Delete `obj/`, `out/`, `Solution/obj/` and `Solution/bin/` before a pack you
intend to quote a number from, and confirm by looking:

```bash
head -c 200 out/controls/<Control>/bundle.js
```

A production bundle is one long minified line with no banner. This is worth the
ten seconds because bundle size is the number people cite when choosing between
`standard` and `react_virtual`, and the development figure is roughly double.
