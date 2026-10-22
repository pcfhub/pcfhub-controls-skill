# Releasing a control on PCFHub

The mechanics of tagging a release, and what happens between the tag and the
hub. `SKILL.md` has the short form. Deciding what goes into the release —
features, breaking changes, `docs/migration.md`, the version bump — is
[`next-version.md`](../../pcf-next-version/references/next-version.md), in the
`pcf-next-version` skill beside this one.

- [Ship a new version of a shipped control](#ship-a-new-version-of-a-shipped-control)
- [Release, in detail](#release-in-detail)

## Ship a new version of a shipped control

Moved to [`pcf-next-version/references/next-version.md`](../../pcf-next-version/references/next-version.md),
with every section under it:

- **Ship a new version of a shipped control** — Pick the features outward, not inward · Measure before you write, with a probe build · What makes a change breaking · `docs/migration.md`, and the trap in `appliesTo` · Bump every version location, before the tag · Reread `docs/limitations.md` for what the release closes · What does not change

## Release, in detail

By hand, which is still fine, the whole of it is one command and one flag that
cannot be forgotten:

```bash
git tag -a --cleanup=verbatim v1.2.3 -F notes.md && git push origin v1.2.3
```

**The tag message is the release notes, and the release notes are the
component's changelog on the hub.** The shared workflow reads the annotated
tag's message and publishes it as the release body; the hub imports that body
verbatim onto the component page. A lightweight tag gets GitHub's generated
notes instead, which are a list of merged pull requests plus a compare link —
and these repositories push commits directly, so that list is empty and the
page shows one line, `Full Changelog: …`, for every version. The workflow warns
when a tag arrives without a message.

Write the notes the way the commit messages here are written, for a reader who
is deciding whether to upgrade: what changed for the user first, then what
was fixed, then anything they must do (a renamed property, a migration page).
Not a commit list — the compare link is still appended for that. `-F` takes a
Markdown file — **but pass `--cleanup=verbatim`, or every `## Heading` is
silently dropped.** `git tag` strips lines beginning with `#` as comments by
default, so a notes file with Markdown headings tags as its paragraphs alone,
and nothing warns. `pcf-attachment-list` v0.2.0 was tagged that way first and
re-tagged; check with `git tag -l --format='%(contents)' vX.Y.Z` before
pushing. `-m` works for a one-paragraph patch.

A tag pushed with the wrong message can be fixed: delete it locally and
remotely, re-tag with the right one, and re-dispatch the workflow on that tag
— the body is replaced, not appended.

**That corrects GitHub, not the hub.** The hub keeps the notes it imported
the first time. `pcf-date-range-picker` v0.3.2 was re-tagged on the same
commit, the workflow ran again and the release body changed, and ten minutes
later the hub's changelog still read the old text — until a forced sync
brought it in. Whether the hourly sweep would have caught it was not measured.
After a re-tag, read `get_doc_page` with section `changelog`, and ask for a
forced sync rather than waiting.

The workflow builds on `windows-latest` — the solution is packed by msbuild
through `Microsoft.PowerApps.MSBuild.Solution`, a .NET Framework toolchain with
no Linux equivalent — checks the tag against every control manifest and
`Solution.xml` before building, packs managed and unmanaged solutions, and
attaches them plus `bundle.js` to a GitHub Release.

**A green workflow is not the release on the hub, so look.** The pack takes
between a minute and a half and four; then read `get_component` and expect
`currentVersion.version` to be the new one within about ten more.
`pcf-choices-picker` v0.1.2 (2026-10-13) was published and never arrived by
itself: the hub had synced on the tag push, and a release does not move what a
sync asks GitHub about. A hub fix the same day reads the repository on the
release's own webhook, and has not been watched on a real release yet. Until
one goes through, and whenever a version is still missing after ten minutes,
ask PCFHub for a forced sync of the component — an issue on `pcfhub/_template`,
where the repository was registered. *The webhook* and *When things
do not appear* in `pcfhub-manifest.md` have the mechanism.

How the hub matches the release's zips, and why a released change may still
not appear — a draft nobody published, a field locked in the admin panel — are
*Release artifacts* and *When things do not appear* in `pcfhub-manifest.md`.
