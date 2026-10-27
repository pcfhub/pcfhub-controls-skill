---
name: "pcfhub-publish"
description: "Publish a Power Apps Component Framework (PCF) control on PCFHub (pcfhub.dev) and keep its listing right: `pcfhub.json` (slug, `control.type` and `framework`, summary, tags, hosts, `supportLevel`, `builtWith`), the closed set of `docs/` pages and their directives, `demo.fidelity`, presets and fixtures, `media/` and the logo, registering the repository and its webhook, and cutting a release tag whose notes become the hub's changelog. Use it for \"ship it\", \"cut a release\", \"tag v0.3.0\", \"release notes\", \"it isn't showing on the hub\", \"the docs didn't update\", \"set up the demo\", or any edit to `pcfhub.json` or `docs/` — and ask the hub through the PCFHub MCP server (`validate_manifest`, `get_component`, `get_doc_page`) rather than inferring from the repository. Deciding what goes into a version is `pcf-next-version`; the control's code is `pcf-controls`."
---

# Publishing on PCFHub

A control reaches [PCFHub](https://pcfhub.dev) by living in a GitHub repository
with a `pcfhub.json` in its root and a tagged release — nothing is uploaded by
hand. This skill keeps a repository in the shape the hub's ingestion expects,
so that tagging a release is the only publish step anyone has to remember, and
reads the hub's own answer instead of guessing at it.

**Release is the mechanics of one tag; the next version is everything before
it** — what goes in, what it costs a maker who already has it installed, and
the version bump. That is `pcf-next-version`, beside this skill.

## Where the detail is

| Read | Before |
| --- | --- |
| `references/pcfhub-manifest.md` | touching `pcfhub.json` or `docs/` — and when something does not appear on the hub |
| `references/hub-demo.md` | setting `demo.fidelity`, writing presets or a demo fixture |
| `references/hub-demo-dataverse.md` | a demo fixture's `dataverse` section, or running the real harness locally |
| `references/hub-media.md` | `media/`: the logo, the screenshots, and how the hub mirrors them |
| `references/releasing.md` | the release mechanics: the tag, its notes, and what happens between the tag and the hub |

The other skills' references sit beside these, in `../<skill>/references/`,
and a pointer to one names its skill — `pcf-controls/references/hosts.md`.
`pcf-controls`'s *Where the detail is* lists which file lives where.

## Ask the hub what it has

This plugin ships the PCFHub MCP server, so the hub's own view of a control is
one call away. Every tool only reads, anonymously, at 60 calls a minute — and it
sees **published** components only: a draft nobody published answers "not
found", which is itself the answer to "why isn't it on the hub".

| When | Call | What it settles |
| --- | --- | --- |
| Writing or reviewing `pcfhub.json` | `validate_manifest`, with the file's full text | The hub's own rules — the validator ingestion runs and `npm run check` posts to — as errors and warnings by JSON Pointer. `valid: false` is a result: read it rather than retrying. If the call itself fails, `npm run check` reaches the same validator. |
| "It isn't showing on the hub" | `get_component` | What the hub actually holds. *When things do not appear* in `references/pcfhub-manifest.md` maps each symptom in its answer to a cause. |
| A docs change that has not appeared | `list_doc_sections`, then `get_doc_page` | Which pages the hub published from the default branch, and their text as it has them |
| Choosing `tags` or `category` | `list_taxonomy` | The hub's vocabulary. A tag it does not have is dropped, and `category` is only a suggestion — see `references/pcfhub-manifest.md` |
| Before scaffolding, or picking an exemplar | `search`, or `list_components` with `control_type` | Whether the catalogue already has this control, and the nearest published one of the same shape |

## Write the docs

`docs/` filenames are a closed set — `overview.md`, `installation.md`,
`canvas.md`, `model-driven.md`, `api.md`, `examples.md`, `limitations.md`,
`faq.md`, `migration.md` — and anything else is silently skipped by the hub.
Delete the pages that do not apply rather than shipping placeholder text, and
never write `docs/changelog.md`. `migration.md` is for users moving between
**versions of this control**; write it when the first breaking change lands.
Do not hand-write property tables: `::props-table` renders from the manifest at
the release's tag, with `kind=dataset_column` **only if** the control declares
`property-set` roles. `references/pcfhub-manifest.md` has the rest.

**Then write `summary` in `pcfhub.json`** — the short version of `overview.md`
the component page shows under Overview, up to 2,000 characters. Without it the
control is ten points down on the score search ranks by. *The summary* in
`references/pcfhub-manifest.md` has what renders and the list trap.

**And say how it was made.** `builtWith` is `ai` when an AI assistant wrote the
code and `ai-assisted` when a person wrote it with one's help; `supportLevel`
is `reference` for a worked example nobody maintains for production. The hub
shows both on the page and hands them to assistants — `references/pcfhub-manifest.md`.

## Release and the hub contract

Releasing is: bump every version location in one commit, write the release
notes, tag with them, push.

```bash
npm run bump -- --minor      # every version location, in one edit
# reread docs/limitations.md for what this release closes
npm run release -- --draft   # .release-notes.md, from the commits since the last tag
# rewrite the notes, commit the bump and the limitations edit, then:
git push origin main         # the branch first: the hub reads docs and pcfhub.json there
npm run release -- --push
```

**`--push` pushes the tag and nothing else.** The docs, `pcfhub.json`, the
media it names and the demo fixture are read from the default branch, so a
release whose commits are only on the tag reaches the hub with its notes and
API reference and the last release's pages — *Push the branch before the tag*
in `references/releasing.md`.

**In PowerShell the `--` is swallowed and the flag never arrives**: quote it
(`'--'`) or run the script directly — *Bump every version location* in
`pcf-next-version/references/next-version.md`, which also has what the bump
touches and the limitations reread.

**The tag message is the release notes, and the release notes are the
component's changelog on the hub.** Tag annotated, from a Markdown file, with
**`--cleanup=verbatim`** — `git tag` otherwise strips every `## Heading` as a
comment, and nothing warns — and check with
`git tag -l --format='%(contents)' vX.Y.Z` before pushing. The workflow checks
the tag against every manifest and `Solution.xml`, then packs and attaches the
solutions and `bundle.js` to a GitHub Release.

What the hub reads, and when, is the part that surprises people:

| What | From | When |
| --- | --- | --- |
| Identity, links, docs path | `pcfhub.json` | Every sync, from the default branch |
| API reference | `ControlManifest.Input.xml` | Once per release, **at that release's tag** |
| Doc pages | `docs/*.md` | Every sync, from the default branch |
| Versions, notes, downloads | GitHub Releases | Every sync |

Docs come from the branch so a typo fix ships without a release. The API
reference comes from the tag so an old version is not described by the current
control's property list.

- **A repository reaches the hub only once it is registered** — an issue on
  `pcfhub/_template` with the repository URL and the slug, whose reply carries
  the webhook secret. <https://pcfhub.dev/publish> walks through it.
- **A sync imports a draft; a person publishes it.** Nothing in the repository
  makes a component public. Do not tell the user their control is live because
  the workflow went green — `get_component` answering with the new
  `currentVersion` is the evidence that it is. A version still missing ten
  minutes after its release was published was skipped, and needs a forced
  sync: *The webhook* in `references/pcfhub-manifest.md`.
- **One repository publishes one component**, however many controls its
  solution installs — see `pcf-controls/references/multiple-controls.md`.

`references/releasing.md` has writing the notes and fixing a mistagged release.

### The demo

`demo.fidelity` in `pcfhub.json` decides whether the hub runs the control at
all. It starts at `none`, and only the author knows which value is true. Two
questions settle it: **does any user-visible path leave the browser** —
`WebAPI`, `context.device`, a navigation that opens something — then not
`full`; and **can the harness answer every remaining path truthfully** — if
not, `limited`, with `demo.limitations` naming each gap. More is answered than
older `limitations` entries assume: the harness pages, sorts and filters a
fixture, draws the dialogs, and answers or refuses the Web API from the
fixture's `dataverse` section, and a preset can set the form's state or name
rows of its own. Guessing
`full` is the expensive mistake. *The demo block* in
`references/hub-demo.md` has the rest — and `npm run demo-check` runs every
preset in the hub's own harness before publishing, `--live` after.

## Before saying it's done

The control's own checks are *Before saying it's done* in
[`pcf-controls`](../pcf-controls/SKILL.md#before-saying-its-done). For the
hub, as well:

- `npm run check`, and `validate_manifest` with the file's full text — read
  the warnings, not only the result. *What `npm run check` covers* in
  `pcfhub-new-control/references/rig-maintenance-and-checks.md` has what it
  does and does not prove.
- `pcfhub.json`'s `control.type` / `control.framework` match what the manifest
  and the code actually do
- Every `docs/` file is in the closed set, and `docs/limitations.md` no longer
  refuses what this release does
- **The logo is the control's own mark, not the template's placeholder** — see
  *Drawing the mark* in `references/hub-media.md`.
- After the release: `get_component` lists the new `currentVersion`. Until it
  does, the release is not on the hub, however green the workflow.
