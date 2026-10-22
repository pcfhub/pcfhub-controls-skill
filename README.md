# pcfhub-controls-skill

A [Claude Code](https://claude.com/claude-code) plugin for building, reviewing,
and shipping Power Apps Component Framework (PCF) code components — and for
publishing them on [PCFHub](https://pcfhub.dev), a catalogue of PCF controls
you can try live in the browser.

PCF controls are cheap to start and expensive to get wrong later: the
publisher, the customization prefix and the solution name are permanent the
moment a customer imports the solution, and the platform and its documentation
disagree more often than either admits. These skills front-load those
decisions, and they carry what was **measured** on real model-driven forms and
canvas apps — dated, with the repository that met each trap — rather than what
the type definitions promise.

PCFHub is an independent project. It is not affiliated with or endorsed by
Microsoft; Power Apps, Power Platform and Dataverse are Microsoft trademarks.

## Who it is for

Anyone writing a PCF control with Claude Code. `pcf-controls` is about the
control itself and is useful wherever the control is published; the other four
assume the PCFHub [`_template`](https://github.com/pcfhub/_template) repository
and the hub's publishing contract.

## The five skills

| Skill | The job | Ask it, for example |
| --- | --- | --- |
| `pcf-controls` | The control itself: `index.ts`, the manifest, properties, datasets, dates, lookups, the Web API, navigation, files, styling, accessibility, grid customizers. | "Add a max-length property to my text control, and stop the caret jumping after a save." · "Why does my dataset control render an empty box in `npm start`?" |
| `pcfhub-new-control` | A new control from `_template`, or an existing repository brought into its shape — the permanent answers first, then the template's dev rig. | "Start a dataset control called TaskBoard from the template, under my publisher Contoso." · "We already have a PCF repo in ../my-control — get it on the hub." |
| `pcfhub-publish` | `pcfhub.json`, the closed set of `docs/` pages, `demo.fidelity`, `media/`, registering the repository, and a release tag the hub reads. | "Cut the 0.4.0 release." · "My control isn't showing on pcfhub.dev — why?" |
| `pcf-review` | An ordered audit, from the permanent identity down to documentation honesty. | "Review this control before I release it." |
| `pcf-next-version` | The next version of a control people already have installed: demand, a probe build, breaking changes, `docs/migration.md`, the bump. | "What should go in the next version of my calendar control?" · "Is renaming this property a breaking change?" |

Claude picks the skill from what you ask; you can also name one —
`/pcfhub-controls:pcf-review`.

## What it does not do

- **Prove a control works on a form.** It runs the checks a repository can run
  — lint, build, the template's assertions, `npm run check` — and then says
  what it verified and what it did not. What only a real environment can
  answer goes under *Not verified* in the control's `SPEC.md`.
- **Touch a Dataverse environment.** Importing, configuring forms and probing a
  live form are yours; the skills say what to measure and where.
- **Publish for you.** A repository reaches the hub once it is registered — an
  issue on `pcfhub/_template` — and a person publishes each new component. See
  <https://pcfhub.dev/publish>.
- **Pack a solution off Windows.** The solution zip is built by msbuild, which
  needs Windows; the template's release workflow packs on `windows-latest`.

## Install

This repository is both a plugin marketplace and the plugin itself. From an
interactive `claude` session:

```
/plugin marketplace add pcfhub/pcfhub-controls-skill
```

```
/plugin install pcfhub-controls@pcfhub
```

The skills are then available in every project on the machine. To pick up new
versions:

```
/plugin marketplace update pcfhub
```

### Without the plugin system

Copy all five skill folders into your personal skills directory. They point
into each other's references, so one on its own has pointers that land nowhere.

```bash
git clone https://github.com/pcfhub/pcfhub-controls-skill.git /tmp/pcfhub-skill
cp -r /tmp/pcfhub-skill/skills/* ~/.claude/skills/
```

Each release also attaches the five folders as one zip.

### The PCFHub MCP server

The plugin installs a read-only [MCP](https://modelcontextprotocol.io) server
at `https://pcfhub.dev/mcp` (see `.mcp.json`), so Claude can ask the hub
instead of guessing: validate a `pcfhub.json` against the hub's own rules, read
what the hub holds for a control, search the catalogue for the nearest
exemplar. Every tool only reads published components. Calls are anonymous and
limited to 60 a minute; an API token from <https://pcfhub.dev/api> raises that
to 600. The skill-only install above does without it.

## What you need

- Claude Code.
- Node 20 or later — the version the template's CI builds with.
- For a release: a GitHub repository, and Windows if you pack the solution
  locally.

## Layout

```
.claude-plugin/        marketplace.json (this repo as a one-plugin marketplace) and plugin.json
.mcp.json              the PCFHub MCP server
scripts/               check-references.mjs — every pointer into a skill's references/ resolves
skills/
├── pcf-controls/      SKILL.md, and references/ — one file per topic, each small enough to read whole
├── pcfhub-new-control/
├── pcfhub-publish/
├── pcf-review/
└── pcf-next-version/
```

Each `SKILL.md` is the route through its job, and sends Claude to a reference
at the point it becomes relevant rather than loading them all up front.
`pcf-controls`'s *Where the detail is* lists which file lives in which skill.

## Contributing

Corrections are the most valuable thing this repository can receive: a
measurement that no longer holds, a host that behaves differently, a trap
nobody wrote down. [CONTRIBUTING.md](CONTRIBUTING.md) has how a reference is
written and the one check every change runs.

## License

[MIT](LICENSE)
