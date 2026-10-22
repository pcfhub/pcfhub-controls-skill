---
name: "pcf-next-version"
description: "Plan and prepare the next version of a Power Apps Component Framework (PCF) control that people already have installed: pick features from its own `docs/limitations.md` and outside demand (PCF Gallery votes, hub downloads, Microsoft's deprecations, the forums), rule out what the platform already does, measure with a probe build before writing, weigh what makes a change breaking (a new `<uses-feature>`, a renamed or retyped property, a new required property, a changed default), write `docs/migration.md`, and bump every version location. Use it for \"the next version\", \"what goes in 0.6.0\", \"it needs grouping\", \"what should we build next\", \"is this a breaking change\", \"bump the version\", or a probe build. Tagging and publishing the release is `pcfhub-publish`."
---

# The next version of a shipped control

Everything before the release, for a control that **somebody already has
installed** — every change is a change *to* something, paid for by a maker who
did not ask for it. Release is the mechanics of one tag, and that is
*Release and the hub contract* in
[`pcfhub-publish`](../pcfhub-publish/SKILL.md#release-and-the-hub-contract);
this is what goes in, what it costs, and what to measure first.

## Where the detail is

| Read | Before |
| --- | --- |
| `references/next-version.md` | planning the next version — demand, the probe, breaking changes, `docs/migration.md`, the bump |

It points into the other skills' references — the rig's
`pcfhub-new-control/references/verification.md`, the canvas host's
`pcf-controls/references/hosts.md` — which sit beside this skill in
`../<skill>/references/`.

## Ship a new version of a shipped control

`references/next-version.md` has all of it; the rules that decide most
releases:

- **Pick the features outward.** Read `docs/limitations.md` as a backlog beside
  the demand sources — the PCF Gallery request board ranked by votes (not its
  front page), Microsoft's deprecations, hub downloads (`list_components` with
  `sort: "popular"`, from the PCFHub MCP server), the forums — and rule out the
  platform first.
- **Sync the rig before the first line**, as a commit of its own.
- **Measure before you write, with a probe build**, answers pasted into
  `SPEC.md` with the date. An answer that goes the wrong way removes the feature
  that depends on it.
- **Breaking, in descending cost:** a new `<uses-feature>` (declare it
  `required="false"`), a renamed or retyped property, a new `required="true"`
  property, a changed default. A new feature arrives switched off.
- **`docs/migration.md` pins `appliesTo` to the version being cut** — the
  template's `>=1.0.0` matches nothing on a 0.x control.
- **A canvas app runs its own copy of the control.** An import updates forms
  and no published canvas app, and Studio can show the new build while
  publishing the old one — see that title in `pcf-controls/references/hosts.md`.
- **Bump by anchor, never by pattern** — `npm run bump -- --minor`. There is no
  `CHANGELOG.md`; the tag message is the changelog. **In PowerShell the `--`
  is swallowed and the flag never arrives**: quote it (`'--'`) or run
  `node scripts/version.mjs --minor` — *Bump every version location* in
  `references/next-version.md`.
- **At the bump, reread `docs/limitations.md` for the gaps this release
  closes.** Delete each refusal it no longer earns and write the new feature's
  own limits in its place, in the bump commit — the hub publishes docs from the
  branch, so a stale refusal is live beside the release notes contradicting it.

Then the tag, the notes and the hub: `pcfhub-publish`.
