# More than one control in a repository

The layout a second control forces, what the hub publishes when there are two,
and what sharing code between them costs.

- [More than one control in a repository](#more-than-one-control-in-a-repository)
  - [The layout that satisfies all three](#the-layout-that-satisfies-all-three)
  - [Adding a second control: `add-control.mjs`](#adding-a-second-control-add-controlmjs)
  - [What the hub publishes when there are two](#what-the-hub-publishes-when-there-are-two)
  - [`&lt;dependency&gt;` is the element this shape unlocks — and you probably still do not want it](#-is-the-element-this-shape-unlocks--and-you-probably-still-do-not-want-it)
  - [Sharing code duplicates it, so share for consistency and not for size](#sharing-code-duplicates-it-so-share-for-consistency-and-not-for-size)
  - [What breaks, and what to check](#what-breaks-and-what-to-check)

## More than one control in a repository

**One `.pcfproj` holds exactly one control.** This is the rule everything else
follows from, and it is easy to miss because two of the three build paths
tolerate breaking it.

`pcf-toolkit` is the worked example — `LinkField` (field) and `LinkColumn`
(dataset) in one solution, sharing their URL allow-list through a `shared/`
directory that both import.

Microsoft's ALM guidance states it plainly: a solution project references many
component projects, "whereas code component projects may only contain a single
code component". The tooling enforces it unevenly:

| Path | Two controls in one `.pcfproj` |
| --- | --- |
| `npm run build` | **Works.** `pcf-scripts`' `findControlFolders` walks for every manifest and `mapControls` builds each. |
| `msbuild` solution pack | **Works.** Both land in the zip as `CustomControl` root components. |
| `pac pcf push` | **Refuses.** *"Found more than one project source file named 'ControlManifest.Input.xml'. Pcf projects should only contain a single source manifest file."* |

The one that refuses is the inner development loop, so a repository shaped this
way is unusable day to day while looking perfectly healthy in CI. Do not read
`findControlFolders`' recursion as support for many controls — it is a *search
for the one*, and mistaking it for a feature is exactly how this gets built
wrong.

### The layout that satisfies all three

```
<ControlA>/
  <ControlA>.pcfproj
  package.json          the msbuild targets run `npm run build` HERE
  pcfconfig.json        outDir ../out/controls
  tsconfig.json         extends ../tsconfig.json
  <ControlA>/           manifest, index.ts, css/, strings/
<ControlB>/             the same again
shared/                 modules both import — compiled into BOTH bundles
dev/                    the first control's rig; siblings at dev/<Constructor>/
Solution/Solution.cdsproj   one ProjectReference per control project
```

Every project still writes into one `out/controls/<Constructor>/` at the
repository root, so the dev rigs, `pcfhub.json` and both shared workflows are
unaffected.

Three properties carry it, and each has a failure mode worth knowing:

- **`OutputPath` is a controls *root*, one level above the project** —
  `$(MSBuildThisFileDirectory)..\out\controls`. The solution packer enumerates
  the *subfolders* of a referenced project's `OutputPath` as controls, so
  pointing it at the control's own folder makes it read `css/` as a control and
  fail with `ControlManifest.xml not found`.
- **The control nests one level below the project.** `pcf-scripts` writes into
  `outDir/<control path relative to controlsRoot>`. Put the project file beside
  the manifest and that relative path is empty, so every control writes to
  `out/controls/bundle.js` and the last one built wins — silently.
- **`PcfEnableAutoNpmInstall` is `false`.** Otherwise msbuild runs `npm install`
  in each project directory and grows a `node_modules` per control. Dependencies
  are installed once at the repository root; npm puts every ancestor
  `node_modules/.bin` on `PATH`, so `pcf-scripts` resolves from there.

Note that **msbuild overrides `pcfconfig.json`**: the targets pass
`--outDir "$(PcfOutputPath)"`, so under a solution build `outDir` is always
`OutputPath`. Keep the two in step or `npm run build` and the pack will disagree
about where the bundle goes.

The root `package.json` then orchestrates rather than builds —
`npm run build --prefix <ControlA> && …` — and drops `start`, because
`pcf-scripts start` hosts one control.

What is one-per-repository no matter how you arrange the projects is the hub —
see [What the hub publishes when there are two](#what-the-hub-publishes-when-there-are-two).

### Adding a second control: `add-control.mjs`

`setup.mjs` adopts a repository for exactly one control. To add a sibling, use
`add-control.mjs`, and note **where it runs from**:

```bash
node ../_template/scripts/add-control.mjs --into . \
  --control LinkColumn --type dataset --title "Link Column" --tagline "…"
```

It is a **template-side** tool, like `adopt.mjs`, and for the same reason:
`setup.mjs` deletes `variants/` on adoption, so a copy living inside an adopted
repository would have no donor sources left to copy from. `setup.mjs` deletes it
alongside `adopt.mjs` and `verify-adoption.mjs`. Reach it by path from the
template checkout.

**It migrates the first control, so it is not purely additive.** A repository
adopted from the template keeps its control at the root beside a root
`.pcfproj`, which is correct for one control and illegal for two. So the script
moves `<Control>/` down to `<Control>/<Control>/`, writes the four project files
beside it, deletes the root `.pcfproj` and `pcfconfig.json`, and repairs
`pcfhub.json`'s `control.manifestPath` — the one key it touches, because the
move invalidated it and a stale one costs the whole API reference silently.
**It refuses to run against a dirty git tree** so the move is reviewable as its
own diff; `--force` overrides.

Past that migration nothing existing is overwritten, with the protection in two
layers: **an existing control directory is a hard failure** (by the time anyone
re-runs this, `<Control>/index.ts` is the file they have been writing, and
merging a fresh scaffold into it half-way is worse than refusing), while shared
files that already exist are left alone and reported as skipped.

It takes the namespace **out of the target** rather than asking — two controls in
one solution under different namespaces would install, and the mistake surfaces
as two publishers in the maker's control picker. It also refuses a constructor
already declared in the repository, because the logical name is
`{prefix}_{namespace}.{constructor}` and the second would collide at import.

What it writes: `<Control>/<Control>/` (manifest, entry point, CSS, all five
`.resx`), the four project files beside it, a dev rig at `dev/<Control>/`, a
`demo/` fixture if the repository had none, a `ProjectReference` per control in
`Solution.cdsproj`, and root `package.json` scripts that run each project in
turn. The sibling's rig nests while the **first** control's stays flat at `dev/`
— that asymmetry is deliberate: nothing in the platform tooling requires the rig
to move, and those are the files most likely to have been customised, so the
first control keeps the repository's default harness and every sibling is named.

**It writes the sibling at the repository’s current version, not at the `0.1.0`
the donor manifest carries.** Anything else is a release failure waiting:
`release-reusable.yml` checks the tag against **every** manifest in the tree, so
a sibling added to a repo at 0.5.0 and left at 0.1.0 throws on the next tag — on
a Windows runner, on a tag already pushed, naming a file the author had no
reason to connect to the version. A second control in one solution is one
shipped artifact with one version; there is no arrangement in which it has a
number of its own. Confirm with `npm run bump` after adding one.

Two things it deliberately does **not** do, because both are decisions:

- **It does not decide anything in `pcfhub.json`.** It repairs
  `control.manifestPath` after the migration and stops there. The hub publishes
  one component per repository, and the manifest already names the one it
  publishes. Decide which control the API reference and the demo cover, and put
  the other in `docs/` and in `demo.limitations` — `npm run check` warns when a
  repository builds more controls than the hub can publish.
- **It does not rename the solution.** `setup.mjs` generates
  `Solution/src/Other/Solution.xml`'s `<UniqueName>` from the *first control's*
  name, which in a two-control repository names one of two. Rename it **before
  the first release and never after** — changing it afterwards makes the next
  import create a second solution rather than upgrade the first. `pcf-toolkit`
  is `ToolkitSolution` for this reason.

Only `field` and `dataset` compose as siblings. A grid customizer is refused
outright, and the reason is structural: scaffolding one *replaces* `dev/` (a
customizer touches no DOM, so the form-shaped host and `dom.js` would be files
nothing loads) and rewrites `pcfhub.json`'s `control.type`, `framework` and
`demo.host`. Every one of those is destructive, and this script never
overwrites. Scaffold a customizer into its own repository.

### What the hub publishes when there are two

What does *not* scale at all is the hub: one `pcfhub.json` at the repository
root, one `slug`, one `control` block, one demo bundle. **A repository with two
controls publishes one component.** The others ship inside the same solution and
are installed by the same download; they are simply not separately listed.

**One repository publishes one component, and the ceiling is hard.**
`SyncComponentFromRepository` reads `pcfhub.json` from the repository **root
only**, fails outright when `manifest.slug` does not match the component being
synced, and `ManifestValidator` requires a single `control` object whose keys
are `namespace`, `constructor`, `type`, `framework` and `manifestPath`. There
is no `controls` array and adding one produces an unknown-key warning, not a
second component. So a repository holding several controls gets **one** hub
page, **one** API reference and **one** `demo_bundle` — the release workflow's
`control-dir` input is what selects which. Every control still ships in the
solution and is installed by the download, so say which is which in `docs/` and
in `demo.limitations`, or the download page describes half of what it installs.

### `<dependency>` is the element this shape unlocks — and you probably still do not want it

`<dependency>` lives under `<resources>` and its `type` has exactly one legal
value:

```json
"dependencyType": { "type": "string", "enum": ["control"] }
```

`name` and `type` are required; `order` and `load-type` (`order` | `onDemand`)
are optional. It exists to say *this control depends on that control*, which is
why nothing in a one-control-per-repo catalogue ever had a reason to write one.

**It survives the build.** `ManifestProcessor.processResources` explicitly
filters `dependency` (and `platform-library`) out of its resource-path rewriting
and deep-clones the rest through, so the element reaches
`out/controls/<C>/ControlManifest.xml` verbatim. Verified by adding one and
reading the built manifest, not only by reading the source.

**But two sibling controls are usually not a dependency.** Shipping together is
not depending on each other, and `<dependency>` claims the second cannot function
without the first. Sharing a TypeScript module is not this either — that is a
bundling concern, see below. Declaring one you do not have is the same class of
mistake as declaring a `<uses-feature>` nothing calls. `pcf-toolkit` verified the
element works and then shipped **without** it, because its two controls are peers.

### Sharing code duplicates it, so share for consistency and not for size

Each control directory is its own webpack entry. A module in a `shared/`
directory imported by two controls is compiled **into both bundles, once each** —
there is no chunk splitting between controls and no way to ask for one, because a
control is served to the platform as a single web resource.

So what you buy is that the two cannot drift, and what you pay is the bytes,
twice. Right for a page of rules two controls must agree on — a validation
allow-list, a date format; `pcf-toolkit` shares its URL allow-list, which is a
security boundary. Wrong for anything large: two controls that need to
share a charting library are probably one control with two manifests.

Three practical notes:

- `shared/` holds no manifest, so `findControlFolders` ignores it and nothing
  tries to build it as a control.
- It is also missed by a `lint` script written as `eslint <Control1> <Control2>`.
  Add it by hand — `add-control.mjs` only knows about control directories.
- The **5 MB web-resource ceiling is per control**, not per repository, so the
  duplication does not push a repository toward the limit the way it would if
  the bundles were summed.

### What breaks, and what to check

Everything single-control in the tooling was written when one control was the
only shape. In `pcfhub/_template` these are fixed; in a fork or an older
repository, check all four:

| Thing | The single-control assumption |
| --- | --- |
| The repository layout itself | One `.pcfproj` at the root holding one control. Two controls under it build and pack, and `pac pcf push` refuses — see above |
| Release: tag vs manifest | Read only `control-dir`'s manifest, so a sibling's `version` could drift from the tag silently |
| Build + release: bundle size | `Get-ChildItem … -Recurse \| Select-Object -First 1` measured whichever directory sorted first and let the rest ship unmeasured |
| `check-template.mjs` | Derived its control directory from `pcfhub.json`'s `manifestPath`, so a sibling's `.resx` completeness, `<uses-feature>` and `external-service-usage` went unchecked |
| `package.json` | `lint` and `smoke` name control directories one at a time |

The localisation one is the quietest: a sibling missing a key in one language
falls back to the **key name** in that language only, and it ships to the same
customer as the published control.
