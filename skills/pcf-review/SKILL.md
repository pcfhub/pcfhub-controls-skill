---
name: "pcf-review"
description: "Review a Power Apps Component Framework (PCF) control repository before it ships, or diagnose one that misbehaves, with an ordered audit that starts from the decisions that are permanent once a customer imports the solution (publisher, prefix, solution name, slug) and works through versions, the PCFHub contract, build health, manifest correctness, control behaviour, accessibility, Fluent fidelity and documentation honesty. Use it for \"review this control\", \"audit the repo\", \"is it ready to release\", \"check this PR\", \"why won't it load\", \"the upgrade did nothing\", \"why isn't it on the hub\", or a pull request that touches a PCF control. It establishes where the change actually lives in git before diagnosing anything, and proves claims by running the checks rather than reading them."
---

# Reviewing a PCF control

A review of a PCF control is mostly a review of things that are expensive to
change later, so the order matters more than the coverage: the permanent
identity first, the code quality last. The checklist this skill walks is in
that order.

## Where the detail is

| Read | Before |
| --- | --- |
| `references/review-checklist.md` | reviewing — the whole list, in order |
| `references/review-checklist-behaviour.md` | its section 6, control behaviour, which the list sends you to and back from |

The checklist points into the other skills' references for the why behind each
item — `pcf-controls/references/properties.md`,
`pcfhub-publish/references/pcfhub-manifest.md` and the rest — which sit beside
this skill in `../<skill>/references/`.

## Review an existing control

Work through `references/review-checklist.md`, whose section 6 is
`references/review-checklist-behaviour.md`. It is ordered by how expensive
the mistake is to fix later, so the permanent-identity items come before the
code-quality ones.

**Establish the git state before diagnosing anything.** Because the hub reads
docs from the default branch and the API reference from a release tag, "it isn't
showing up" almost always resolves to *where the change currently lives*. Read
`git status`, `git log`, the tags, and the actual `git diff` of the manifest —
a summary of a diff is not a diff — then what the hub holds, with
`get_component` from the PCFHub MCP server this plugin ships.

Three failures are common and silent: **versions that disagree** across the
manifest, `Solution.xml` and `package.json` (an upgrade that silently does
nothing); **a slug copied from another repository's `pcfhub.json`** (the whole
import fails, seen only by whoever reads the ingestion run); and **a `docs/`
file outside the closed set** (published nowhere).

Prove claims by running things — `lint`, `build` and `check` are fast. The
solution pack is the only local production compile, and evidence only from a
clean tree: *A local pack, and a clean one* in
`pcfhub-new-control/references/rig-maintenance-and-checks.md`.

## Report it

Lead with what blocks a release, in the checklist's order, and say for each
finding whether it was **observed** — a command run, a diff read, a page
looked at — or **read** from the code and not run. "The `PcfBuildMode` problem
is a read finding, not an observed one — the solution pack needs Windows
msbuild" is a useful sentence. Then what you did not check, and why.
