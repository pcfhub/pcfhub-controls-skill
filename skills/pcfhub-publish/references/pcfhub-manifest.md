# The PCFHub contract

What the hub reads out of a component repository, and the shapes it expects.
The demo and the media have files of their own.

- [pcfhub.json](#pcfhubjson)
  - [The summary](#the-summary)
- [The demo block](#the-demo-block) — in [hub-demo.md](hub-demo.md)
- [Docs](#docs)
  - [Frontmatter](#frontmatter)
  - [Directives](#directives)
  - [What each page is for](#what-each-page-is-for)
- [Media](#media) — in [hub-media.md](hub-media.md)
- [Release artifacts](#release-artifacts)
- [The webhook](#the-webhook)
- [When things do not appear](#when-things-do-not-appear)

`scripts/check-template.mjs` carries no copy of the hub's schema. PCFHub's own
`ManifestValidator` is the one definition of that contract, and a second copy in
the repository would drift, disagree, and lose — so the script posts
`pcfhub.json` to the hub (`POST /api/v1/manifest/validate`, the validator
ingestion runs) and checks locally only what the hub cannot see: files on disk,
and `pcfhub.json`'s claims against the manifest beside it. **If the hub cannot
be reached, the schema half is skipped with a warning**, so a green run offline
certifies nothing about the file's shape. The same validator is the pcfhub MCP
server's `validate_manifest` tool, which needs no checkout at all — only the
file's text.

The full list of what it covers is *What `npm run check` covers* in
`pcfhub-new-control/references/verification.md`. A repository adopted from an older `_template` still has an older
script; read it rather than assuming.

It does **not** check any of these, all of which are silent failures:

- whether the control's *code* matches `control.type` and `control.framework` —
  only the manifest is compared
- whether `demo.fidelity` is honest
- whether images referenced from the **docs** exist — only `pcfhub.json`'s are
  checked, since guessing at Markdown would produce false failures
- whether `api.md` renders every property the control has

## pcfhub.json

```json
{
  "schemaVersion": 1,

  "slug": "pcf-tag-list",
  "name": "Tag List",
  "tagline": "A many-to-many tag picker rendered as removable chips, bound to a dataset.",
  "summary": "Shows a many-to-many or one-to-many relationship on a model-driven form as chips instead of a subgrid.\n\n- Type to find a record and attach it\n- **Browse** opens the platform's own lookup dialog",
  "category": "data",
  "hosts": ["model-driven"],
  "tags": ["react", "many-to-many", "localised"],
  "supportLevel": "reference",
  "builtWith": "ai",

  "control": {
    "namespace": "PCFHub",
    "constructor": "TagList",
    "type": "dataset",
    "framework": "react_virtual",
    "manifestPath": "TagList/ControlManifest.Input.xml"
  },

  "links": {
    "homepage": "https://github.com/pcfhub/pcf-tag-list",
    "support": "https://github.com/pcfhub/pcf-tag-list/issues",
    "license": "MIT"
  },

  "docs": { "path": "docs" },

  "media": {
    "logo": "media/logo.png",
    "screenshots": ["media/default.png", "media/empty.png"]
  },

  "demo": { "fidelity": "none" }
}
```

Required: `schemaVersion`, `slug`, `name`, and a `control` block carrying at
least `namespace`, `constructor`, and `type`.

| Field | Notes |
| --- | --- |
| `slug` | Must equal the slug registered on the hub — registered by opening an issue on `pcfhub/_template` with the repository URL and this slug; see *The webhook*. A mismatch fails the whole import — which is the safe outcome, but only if somebody reads the ingestion run. Almost always caused by copying `pcfhub.json` from another repository. |
| `name` | Display name, up to 191 characters. Applied on the **first** sync only; a rename after that is made on the hub. |
| `tagline` | One line, up to 255 characters. Rewritten on every sync, unless it was edited in the admin panel and is locked. |
| `summary` | The "Overview" block on the component page — see *The summary* below. Up to 2,000 characters. Rewritten on every sync, unless it was edited in the admin panel and is locked. Missing, the hub keeps what it has and says so as an advisory. |
| `category` | A **suggestion**, never applied: a component is filed by a curator before its first sync, and a run whose `category` differs only notes it. Slugs from `list_taxonomy` with `kind: "categories"`. |
| `tags` | At most 10, from the hub's own vocabulary — `list_taxonomy` with `kind: "tags"`. Applied on the **first** sync only. A tag the hub does not have is dropped, not created, and reported on every sync until it is removed. |
| `hosts` | `canvas`, `model-driven`, or both — where the control runs. Applied on **every** sync, and authoritative: dropping a host removes it on the hub. Missing, the hub keeps what it derived from the `docs/` pages and warns. |
| `supportLevel` | `maintained` or `reference`. A `reference` control gets a notice on its page and a badge on its card — a worked example, not maintained for production — and `get_component` says so to assistants. Applied on **every** sync; missing, the hub keeps what it has and shows nothing. Not `links.support`, which is the issues URL. Every catalogue control except Code Editor is `reference`. |
| `builtWith` | `ai` (an AI assistant wrote the code) or `ai-assisted` (a person wrote it with one's help). Same rules as `supportLevel`. There is no `human` value — absent already means nothing was declared. Every catalogue control is `ai`, Code Editor `ai-assisted`. Pair it with the banner at the top of `README.md` and the callout at the top of `docs/overview.md`, which say in the author's voice what the hub's generic notice cannot: tested on a live form, not reviewed line by line. |
| `control.type` | `field`, `dataset`, `virtual`, or `grid_customizer`. The hub resolves the first three from the manifest as dataset → virtual → field, so a virtual **field** control is recorded as `virtual` and a virtual **dataset** control stays `dataset` — set those to what the parser will conclude. `grid_customizer` is the exception: a customizer's manifest is indistinguishable from a virtual field control, so the repository states it rather than having it derived. |
| `control.framework` | `standard` or `react_virtual`. A control that bundles its own React is `standard` — the hub has no `react` value, and its validator refuses one. |
| `control.manifestPath` | **Declared, not discovered.** A typo costs the entire API reference — every release imports with no properties at all and nothing errors. |
| `docs.path` | Defaults to `docs` |

`control.type` and `control.framework` are metadata: nothing on the hub
validates them against the manifest, so they can silently describe a control
that no longer exists. Check them whenever the control's shape changes —
`npm run check` reads both against the manifest locally, which is the only place
the disagreement surfaces.

### The summary

`summary` is the paragraph or two the component page shows under **Overview**,
above the screenshots: what the control does, for somebody deciding whether to
install it. It is the short version of `docs/overview.md`, so write it once that
page exists — not the tagline again, and not the page pasted in.

Until 2026-10-01 nothing in a repository could supply it. It was typed into the
hub's admin form or it was empty, and it was empty for twenty-seven of
twenty-eight published components. An empty one costs three things: no Overview
on the page, ten points of the hub's quality score (which search ranks by), and
nothing but the tagline for the full-text index and `get_component` to read.

**It is Markdown, but only four things render.** The page builds it with a
small renderer of its own, not the docs compiler:

| Written | Renders as |
| --- | --- |
| Blocks separated by a blank line (`\n\n` in the JSON string) | Paragraphs |
| A block in which **every** line starts with `- ` | A bulleted list |
| `**text**` | Bold |
| `` `text` `` | Code |

Everything else is shown as typed: a link prints its brackets, a heading its
`#`, italics their asterisks. No directives, no images.

- **A list is a block of its own.** A line of prose directly above the first
  `- `, with no blank line between, makes the block a paragraph with hyphens in
  it. Put `\n\n` before the list and after it.
- **A list item is one line.** There is no continuation line: one line in the
  block that does not start with `- ` and the whole block is a paragraph.
- **Say the host limit in it** when there is one — "Model-driven apps only." —
  since this is read before the docs are.

A shape that works: one paragraph saying what it does and where, a list of the
three or four things that make it worth installing, and a closing line for a
requirement or a limit. 300 to 800 characters is typical across the catalogue.

**The mechanics:**

- Read from the **default branch** on every sync, like the tagline, so a
  correction needs no release.
- **Missing is an advisory, not a warning**: `npm run check` and
  `validate_manifest` say `/summary — is missing`, the sync run stays green,
  and the hub keeps whatever it already has.
- **A repository scaffolded from `_template` carries `"summary": "__SUMMARY__"`**,
  and `npm run check` fails until it is replaced — the same gate as the
  README's three hand-written sections, and it says what belongs there.
  `adopt.mjs` writes no placeholder; a missing summary is on its "needs a
  decision" list instead.
- Edited in the hub's admin panel, it is locked there (item 2 under *When
  things do not appear*).

Confirm it with `get_component`: `summaryMd` is the text the hub holds.

## The demo block

Moved to [hub-demo.md](hub-demo.md#the-demo-block): `fidelity`, presets,
fixtures and the stand-in Dataverse a demo queries, and

- **`demo.host`** — [hub-demo.md](hub-demo.md#demohost)

## Docs

Filenames are a closed set. Anything else is skipped by the hub and flagged by
`npm run check`:

`overview.md` · `installation.md` · `canvas.md` · `model-driven.md` · `api.md` ·
`examples.md` · `limitations.md` · `faq.md` · `migration.md`

Never write `docs/changelog.md` — the hub builds the changelog from release
notes and `npm run check` rejects the file outright.

Delete the pages that do not apply rather than shipping them with placeholder
text — an empty section on a public page reads as abandoned, whereas a missing
one reads as deliberate.

`migration.md` is the one whose name misleads. It is for migrating **users
between versions of this control** — what broke in 2.0 and what to change — and
has nothing to do with migrating a repository onto the hub. `setup.mjs` deletes
it on adoption because a first release has nothing to migrate from; write it
when the first breaking change lands, and pin it with `appliesTo`.

### Frontmatter

```yaml
---
title: Overview
description: What the control does, and when to reach for it.
order: 1
appliesTo: ">=1.0.0"
draft: false
---
```

| Key | Effect |
| --- | --- |
| `title` | Page heading and nav label |
| `description` | Meta description and search snippet |
| `order` | Position in the sidebar |
| `appliesTo` | A semver range. The only key that changes how the page is stored. |
| `draft` | `true` keeps the page off the hub entirely |

Without `appliesTo`, a page is unpinned: one row, shown for every version. With
a range, the hub materialises the page once per release the range covers, so a
reader on 0.9.0 never sees a migration note written for 1.0. Ranges look like
`">=1.0.0"`, `"^1.2"`, `"1.x"`, `">=1.0.0 <2.0.0"`.

A range matching no released version is reported on the ingestion run and the
page is skipped — which is what happens if `migration.md` is written before the
release it describes is cut. Delete the file until then.

### Directives

```markdown
::props-table{kind=input}

::image{src=media/screenshot.png alt="On a form" zoom}
::video{src=media/walkthrough.mp4 poster=media/walkthrough-poster.png}

:::callout{type=info}
Body.
:::

:::steps
1. First.
2. Second.
:::
```

**The directives only work under `docs/`.** `README.md` is rendered by GitHub,
which knows nothing about them and prints the raw `::image{…}` line — use plain
`![alt](media/shot.png)` there instead. A screenshot usually wants three homes
and they are not interchangeable: `::image` in `docs/overview.md` for the hub's
page, plain Markdown in `README.md` for GitHub, and a path in `pcfhub.json`'s
`media.screenshots` for the hub's component listing. Only the third is checked
by `npm run check` — a wrong path in either of the other two renders a broken
image and fails nothing.

**Name screenshots for what they show**, not `Screenshot-1.png`. The mirror key
is derived from the repository path, so a rename after a sync strands the old
mirrored object until the next full sweep — which makes the tidy-up cheapest
before the first release and progressively less so after it. A file replaced
under the same name is never fetched again at all, so a new render needs a new
name anyway — see *Media* in `hub-media.md`.

`props-table` renders from the manifest the hub parsed at the release being
viewed, so it cannot drift from the control. `kind` is `input`, `bound`,
`output`, `dataset`, or `dataset_column`; omit it to render every property in
one table. **Do not hand-write property tables** — a hand-written one is wrong
the first time somebody adds a property, and a reader has no way to tell.

The template's `api.md` ships `input`, `bound`, and `output` only, because it
assumes a field control. **A dataset control drops `kind=bound` and adds
`kind=dataset`** — and adds `kind=dataset_column` **only if it declares
`property-set` roles**. Without the first its dataset renders nowhere and the
`bound` section comes out empty, which reads as a control with no bound
properties rather than as a missing directive; with the last and no roles, the
directive renders an empty table, which reads as "this control has no dataset
columns" rather than as a section nobody wrote. `--type dataset` handles both.
Match the sections to the manifest, and delete the ones with nothing to show.

`callout` types: `info`, `warning`, `success`.

Do not hand-link release assets in `installation.md`. The hub serves the managed
and unmanaged downloads for the version the reader is viewing; a hard-coded link
goes stale on the next release.

### What each page is for

- **overview** — what it does, who it is for, what makes it different from doing
  it another way. Name the supported hosts plainly.
- **installation** — import steps and requirements. Managed to production;
  unmanaged only in a dev environment where the control itself will change,
  because unmanaged cannot be cleanly uninstalled.
- **canvas** / **model-driven** — delete the one that does not apply. An empty
  section reads as unfinished; a missing one reads as deliberate.
- **api** — `props-table` directives plus a Notes section for what the manifest
  cannot express: accepted values of a free-text property, the format of a JSON
  input, which combinations conflict.
- **examples** — two or three complete, copyable configurations beat a dozen
  fragments. Show the whole configuration each time, not the diff from the
  previous example — a reader arriving from search has not read it.
- **limitations** — the page that earns trust and stops issues being opened for
  intended behaviour. A limitation is a constraint you decided to accept; say
  which it is, and link the issue if you intend to lift it.
- **faq** — grow it from real questions. Invented ones produce a page nobody
  reads.
- **migration** — pinned with `appliesTo`. What changed in one sentence, then
  what to do. If a change needs a data migration, say so here rather than in the
  release notes, because this is the page a reader lands on.

## Media

Moved to [hub-media.md](hub-media.md#media): what goes in `media/` and how the
hub mirrors it, and

- **Drawing the mark** — [hub-media.md](hub-media.md#drawing-the-mark)
- **Making it, with no new dependency** — the screenshots,
  [hub-media.md](hub-media.md#making-it-with-no-new-dependency)

## Release artifacts

With no `release.artifacts` block, the hub matches `*_managed.zip` and
`*_unmanaged.zip` against the release's assets, and matches the demo bundle
against an asset literally named `bundle.js`.

msbuild produces the managed zip with a matching name but names the unmanaged
one after the solution **project file** — `Solution.cdsproj` gives
`Solution.zip`, whatever the `<UniqueName>` — which matches neither pattern and
would leave the hub's unmanaged download empty. The release workflow renames it — which is why no
artifact patterns are needed. **If you change the workflow's naming, change the
patterns with it.**

The block, when you do need it, names the assets directly. `pcf-code-editor` is
the only live example:

```json
"release": {
  "artifacts": {
    "managed_solution": "CodeEditorSolution_managed.zip",
    "unmanaged_solution": "CodeEditorSolution.zip"
  }
}
```

Prefer renaming in the workflow to declaring patterns here: the workflow finds
its zips by glob, so it keeps working when the solution is renamed, whereas
these names have to be remembered.

The workflow also checks the tag against every `ControlManifest.Input.xml` and
`Solution/src/Other/Solution.xml` before building, because a mismatch produces a
release the hub records under one number and Dataverse installs as another, and
nobody notices until an upgrade silently does nothing.

## The webhook

A repository reaches the hub only once it is **registered**: open an issue on
[`pcfhub/_template`](https://github.com/pcfhub/_template/issues) with the
repository URL — the plain `https://github.com/owner/name` form — and the
`slug` from `pcfhub.json`, which must match the catalog entry exactly. The
reply carries the webhook secret, and it is where category and tags are
settled. <https://pcfhub.dev/publish> walks through the whole of it.

The webhook is configured once per repository, so a tag publishes in seconds
rather than within the hour:

**Settings → Webhooks → Add webhook**

| Field | Value |
| --- | --- |
| Payload URL | `https://pcfhub.dev/webhooks/github` |
| Content type | `application/json` |
| Secret | The one the registration reply carried |
| Events | Releases, Pushes |

The hub authenticates deliveries by HMAC over the raw body, which is why the
release workflow does not simply curl the hub — a curl could not produce that
signature, and a second unauthenticated endpoint would be a worse trade than the
hourly sweep that already backs the webhook up.

**The sweep backs the webhook up for a push, and not for a release.** A sync
asks GitHub whether the repository changed and skips the whole import when it
has not, and publishing a release changes nothing that question reads — only a
push does. So a release whose webhook is missed waits for the next push, or a
forced sync from the hub's admin panel, however many sweeps go by.

Until a hub fix on 2026-10-13 the release's own webhook was
skipped the same way, every time: the tag push arrives as a webhook too, its
sync runs before the release exists and stores the answer the release will not
change. `pcf-choices-picker` v0.1.2 was tagged at 02:49:52Z and published at
02:53:33Z that day; by 03:07Z the hub was serving the branch's new fixture and
still listed 0.1.1, through the release webhook and the 03:00 sweep, until a
forced sync. Since that fix a webhook-triggered sync reads the repository
whatever GitHub answers. **That has not been watched on a real release yet**,
so check the first one that goes out after it.

## When things do not appear

Start with what the hub holds rather than what the repository says. Most of the
failures below leave a mark in `get_component`'s answer (the pcfhub MCP server),
so read it before theorising:

- **"Not found"** — the component is a draft nobody published (item 1 below),
  or the slug is wrong; `search` rather than guessing.
- **`currentVersion.version` behind the latest tag** — the release never
  reached the hub. Read the release workflow's run first: a failed pack
  publishes nothing. **If the run is green and the GitHub release is there,
  the hub skipped it** (*The webhook* above). Give it ten minutes, then ask
  PCFHub for a forced sync of the component — an issue on `pcfhub/_template`,
  where the repository was registered — which is what brought
  `pcf-choices-picker` v0.1.2 in. A push to the repository should do it too,
  since a push does move what a sync asks about; that route was not watched.
  A prerelease never becomes `currentVersion`; pass `version` to see one.
- **`currentVersion.properties` empty** — `control.manifestPath` missed, and
  every release imports with no API reference.
- **`currentVersion.artifacts` missing a solution** — the release's zips
  matched no glob; see *Release artifacts* above.
- **`releaseNotesMd` a lone `Full Changelog` line** — a lightweight tag, or a
  notes file tagged without `--cleanup=verbatim`.
- **`fidelity`, `demoHost` or `demoLimitations` behind the default branch's
  `pcfhub.json`** — no sync has succeeded since the push. A `pcfhub.json` the
  validator refuses fails the whole import, so validate it first.
- **`summaryMd` null** — `pcfhub.json` declares no `summary`, and nobody
  typed one into the admin form. See *The summary*.
- **`tagline`, `summaryMd` or a link different from `pcfhub.json` after a
  sync** — the field was edited in the admin panel and is locked (item 2
  below). `name`,
  `tags` and `category` differing is normal: the first two are applied on the
  first sync only, and the third never.

Then, in the order worth checking:

1. **A sync imports a draft; a person publishes it.** Nothing in the repository
   makes a component public. This is deliberate — a mistake in a repository
   should not become a mistake on the public site.
2. **Fields edited in the hub's admin panel stop being overwritten.** Ingestion
   drops locked fields before writing so an operator's correction survives. If a
   repository change is not showing up, this is the usual reason — and only
   the hub's operators can release a locked field, so ask on the registration
   issue.
3. **Two refs, and knowing which is which saves a wasted release.** The hub
   reads `pcfhub.json`, `docs/`, the media it names, `demo.datasetFixture` and
   each fixture a preset names for itself from the **default branch**; it reads
   the control manifest, the resx files and the `<css>` resources at the
   **release tag**.

   So a property added on `main` will not appear in the API reference until a
   release is tagged — but a tagline, a summary, a limitation, a preset's
   `props` and the demo fixture's rows all go live on the next sweep, with no
   release at all.

   The demo fixture used to be the half that bit: it was read at the tag while
   `pcfhub.json` was read at the branch, so a commit editing both after a tag
   put the prose live over the tag's rows. pcf-data-table 0.3.4 shipped exactly
   that — a page saying a column was marked read-only, over a fixture where it
   wasn't, because the flag was one commit late. The hub reads fixtures at the
   branch now, for that reason, so the two move together. This paragraph said
   "edit demo content before you tag" until 2026-10-13, which no longer
   matters; what still waits for a tag is the manifest, the resx and the CSS.
4. **A misnamed docs file** publishes nowhere and is mentioned only in an
   ingestion run.
5. **A wrong `control.manifestPath`** imports every release with no properties
   at all, silently.
