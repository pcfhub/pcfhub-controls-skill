# Contributing

The most useful thing anyone can send this repository is a correction: a
measurement that no longer holds, a host that behaves differently from what a
reference says, a trap a control met that nothing here warns about. The skills
are only worth reading because what they say was watched happening, so that is
the bar for a change too.

## What a reference says, and how

**Measured, not inferred.** A claim about what the platform does comes from
running it — a probe build on a real form, a canvas app's published player, the
dev rig — not from the type definitions, the documentation or another
control's comment. Where the platform and Microsoft Learn disagree, the
reference follows the platform and says that they disagree.

**Dated, and placed.** Say when it was measured and where: the host (a
model-driven form, a canvas app, a Power Apps grid, Power Pages), and the
control or probe that measured it. "Measured 2026-10-03 on an account's
Information form" lets the next reader tell a regression from a mistake.

**What nobody has watched is said out loud.** A claim that rests on reading
rather than running is written as one — *not measured*, *not watched on a
real release* — and stays apart from the measured ones. That line is what
stops someone shipping on an assumption.

**Write for the person about to make the mistake.** Lead with the rule, in
bold, then why — usually the failure it prevents and the repository that met
it. The skills name rules by those bold lead-ins, so keep them short and
stable.

**One topic per file, each small enough to read whole.** A reference past 700
lines is a candidate to split along a topic seam; a `SKILL.md` past 500 lines
has detail that belongs in a reference.

**The catalogue's own state stays out.** What the catalogue picked to build
next, download counts on a given day, which of its repositories owe a release —
none of that belongs in a public reference. The method does.

## Pointers, and the check that keeps them honest

The skills route by pointer, and so do the `SPEC.md` files of the controls
built with them:

- Within a skill: *Title* in `references/x.md`.
- Across skills, naming the sibling: *Title* in `pcfhub-publish/references/x.md`.
- Markdown links are paths, resolved from the file they are in, and may point
  at a `SKILL.md` section as well as a reference.

Every reference's file name is unique across the five skills, because a
control repository's older pointers name the file alone. So:

- **Do not rename a reference**, and do not give a new one a name another
  skill already uses.
- **When a section moves to another file, leave its heading behind** with a
  line pointing on, and a bold list of the subsections that went with it. The
  pointers out in the control repositories then still resolve without anyone
  touching them.
- **Name each new reference in its skill's *Where the detail is* table**, or
  no step routes a reader to it.

Then run the check — CI runs it on every pull request:

```bash
node scripts/check-references.mjs
```

It fails on a pointer or link that no longer lands, on a file name two skills
share, on a reference missing from its skill's table, and on a skill whose
frontmatter `name` is not its folder's or whose `description` passes 1,024
characters. If you have control repositories checked out beside this one, add
`--scan ../<folder>` to check their pointers as well.

## A skill's description

The `description` in a `SKILL.md`'s frontmatter decides whether the skill is
read at all. Keep each one about its own job, with the words people actually
use for it, and name the sibling that owns the job next door — five skills that
all claim "PCF" leave the choice between them to chance.

## Pull requests

- One topic per pull request, and the evidence in its description: what you
  measured, on which host and when, and what you did not.
- Keep the voice of the file you are editing. The references are dense on
  purpose; a sentence that only restates the one before it is the first to go.
- Do not bump `plugin.json`'s version. A release does that, with its tag.

## Releases

A release is a version in `.claude-plugin/plugin.json`, committed, and an
annotated tag `vX.Y.Z` on that commit whose message is the release notes. The
release workflow checks the tag against `plugin.json`, runs the reference
check, and attaches the five skill folders as one zip to the GitHub Release.

```bash
git tag -a --cleanup=verbatim v1.0.0 -F notes.md && git push origin v1.0.0
```

`--cleanup=verbatim` keeps the notes' `## Headings`, which `git tag` otherwise
strips as comments. Plugin users get the new version with
`/plugin marketplace update pcfhub`.

## Conduct and security

This project follows the PCFHub organisation's
[code of conduct](https://github.com/pcfhub/.github/blob/main/CODE_OF_CONDUCT.md).
A security problem — in the MCP server, the hub, or anything a skill tells
someone to run — goes privately, as the
[security policy](https://github.com/pcfhub/.github/blob/main/SECURITY.md)
describes, not in an issue.
