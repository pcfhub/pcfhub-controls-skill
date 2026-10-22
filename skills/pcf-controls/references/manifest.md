# The manifest

What goes in `ControlManifest.Input.xml` besides the properties — external
service usage, features, resources, platform libraries — and the load
failures a manifest or an entry file causes. The properties, and everything
a bound property carries besides `raw`, are in [properties.md](properties.md).

- [The manifest](#the-manifest)
  - [External service usage](#external-service-usage)
  - [Feature usage](#feature-usage)
  - [Resources](#resources)
  - [Platform library versions](#platform-library-versions)
- [Property types](#property-types) — in [properties.md](properties.md)
- [The bound property is more than `raw`](#the-bound-property-is-more-than-raw) — in [properties.md](properties.md)
- ["Could not find/invoke &lt;Namespace&gt;.&lt;Control&gt;'s constructor"](#could-not-findinvoke-s-constructor)
  - [Dataverse will not replace a component at the same version](#dataverse-will-not-replace-a-component-at-the-same-version)
  - [And pack clean, because the pack is incremental](#and-pack-clean-because-the-pack-is-incremental)
- [One export per control file](#one-export-per-control-file)

## The manifest

`<Control>/ControlManifest.Input.xml` is the source of truth for three separate
audiences: the platform (which resolves properties and features), the maker
(who sees the properties pane), and PCFHub (which generates the API reference
from it at each release tag).

```xml
<control namespace="PCFHub"
         constructor="ColorPicker"
         version="0.1.0"
         display-name-key="ColorPicker_Name"
         description-key="ColorPicker_Desc"
         control-type="standard">
```

- `control-type` is `standard` or `virtual`. `virtual` is the React path.
- `version` is what the platform upgrades on, and what CI checks the tag
  against. Bump it in the same commit as the tag.
- The `*-key` attributes name entries in `strings/<Control>.1033.resx`.

**A property's `name` must not be a FormXML element name, and `labels` is
the one measured to break a form.** The classic form designer writes every
configured property under the cell's `<parameters>` as an element named
after the property — `<labels>auto</labels>` — and the publish step scans
the form's XML for `<labels>` elements to publish their translations. It
takes the property for a label owner, walks up to the nearest id (the
cell's GUID) and finds `parameters` is not a node it knows, and publishing
fails with *XML node parameters is one that has an id of <guid> but is one
that we don't recognize as having a valid LabelTypeCode*. Measured on the
Accounts form 2026-09-19 (`pcf-chart-view` 0.0.1): the same control
configured on the **entity view** published fine, because a view has no
FormXML — so the failure looks like a subgrid problem and is a naming one.
`npm run check` refuses `labels` and warns on the other FormXML element
names (`label`, `parameters`, `tabs`, `sections`, `rows`, `cell`,
`control`, `events`, `header`, `footer`…); `label` ships on two controls and
publishes, so only `labels` is a failure. A rename before the first release
is free; after it, it is a breaking change for every form that set the
property.

**PCFHub records `display-name-key` and `description-key` verbatim.** It does
not read the `.resx`, so a reader sees the key itself unless something changes
it. Two ways out: keep the keys readable, or correct them once in the hub's
admin panel — editing a property there locks that field so later syncs leave it
alone. The platform still resolves the keys against the `.resx` for the maker's
properties pane, so they must exist there either way.

### External service usage

```xml
<external-service-usage enabled="false" />
```

Leave it disabled unless the control calls a third-party service. Declaring
external usage makes the control **premium**, and every domain it talks to has
to be listed. This is a licensing consequence, not a technical one, so it is
worth confirming with the user rather than flipping it to make a fetch work.

**Premium is a cost somebody else pays**, which is what makes this different
from every other manifest decision. Microsoft's licensing note is explicit: a
component connecting to an external service directly through the browser is
premium, and an app containing one requires its end users to hold **Power Apps**
licences rather than Office 365 ones. Nothing fails to build, nothing warns at
install, and the person who finds out is not the person who typed it. So the
rule is not "prefer disabled" — it is **ask, and record the answer where an
installer will read it**, meaning `docs/limitations.md` rather than a commit
message.

The element is scoped to **canvas apps** in the schema reference, and the
consequence follows the declaration rather than the configuration: a maker who
leaves the external feature switched off still has a premium component.

When it is genuinely enabled, list every domain:

```xml
<external-service-usage enabled="true">
  <domain>tile.openstreetmap.org</domain>
</external-service-usage>
```

`<domain>` children are declarative and may appear under `enabled="false"` too
— that is the schema's own second example. It is the `enabled` attribute alone
that carries the licensing consequence, so a domain list is not evidence either
way about what the control costs.

`npm run check` fails on `enabled="true"` with no `<domain>`, and warns on
`enabled="true"` at all.

**`pcf-geo-stamp` is the catalogue's only premium control, and how it took the
trade is the pattern worth copying.** The external service buys one optional
feature — a map thumbnail — so the property that switches it on is a
`TwoOptions` input, which [cannot be defaulted to on](properties.md#a-twooptions-input-cannot-default-to-on).
That is normally an irritation and is exactly right here: the shipped default
makes no external request, the licensing is disclosed on the component's
limitations page, and the maker who wants the map opts into it deliberately.
Structural, rather than a promise in a README.

A third option is worth offering before the second: `pcf-geo-stamp`'s tile URL
is a maker-supplied template, so pointing it at a tile server inside the tenant
means nothing leaves it. That does not change the licensing, and saying so is
part of the disclosure.

**The second premium control, `pcf-address-autocomplete-azure`, is the other
shape: the external service *is* the control**, so there is no switch to leave
off and the disclosure leads `docs/limitations.md`. It is the catalogue's
only browser `fetch` to a third party, and what it measured (a real Accounts
form, 2026-09-13) is the checklist for the next one:

- **The key is a maker input, and it goes in a header, never the URL.** Azure
  Maps accepts `subscription-key` either way; a query string lands in browser
  history and every proxy log between the form and the service, a header in
  none of them. Assert it in the rig — log the header *names* and whether the
  key header carried a value, never the value — and break it on purpose once.
- **A non-simple request means a CORS preflight, and it passed** on a
  `*.crm.dynamics.com` origin with the account's default CORS: 204, then the
  200, 84–270 ms. Azure documents that preflights and refusals (401, 403, 429,
  5xx) are not billed. The docs tell the maker to restrict the account's
  allowed origins to the organisation URL, which is the vendor's own guidance
  for a key a browser holds; there is no way to keep the key off the client.
- **The `endpoint` is an enum over the declared `<domain>`s**, never free text:
  a host a maker could type but the list omits is a request the declaration
  does not cover. Azure has six (`atlas.microsoft.com`, `us.`/`eu.`/`kr.`/
  `br.` for geographic scope, `atlas.azure.us`); all six are declared.
- **Cancel superseded requests for real.** `webAPI` returns a bare promise, so
  `pcf-lookup-search` could only retire the handler; a `fetch` takes an
  `AbortSignal`, and the superseded request shows in the network panel as
  `(canceled)`. Keep the retired-handler guard as well, and tell the control's
  own timeout apart from its own abort so only the first is reported.
- **A second transaction is a switch, not a consequence of binding.** The
  autocomplete answer carries `geometry: null` (measured on every suggestion),
  so coordinates cost a `geocode` call per pick; that is behind a `TwoOptions`
  the maker turns on, off by default — geo-stamp's shape, for the same reason.
- **Read the response defensively and sparsely.** Azure's address object is
  documented sparse; a Mexican pick arrived with `adminDistricts` carrying
  `name` only and no `shortName`, and a town-level pick with no `addressLine`
  at all. A control that fills address columns writes the street as the
  street *or nothing* — the first build wrote the whole formatted address
  into the street beside the same town in City.

### Feature usage

```xml
<feature-usage>
  <uses-feature name="WebAPI" required="true" />
  <uses-feature name="Utility" required="true" />
  <uses-feature name="Device.captureImage" required="false" />
</feature-usage>
```

Each entry becomes a permission prompt for the maker installing the control, so
declare only what is used. A declared `WebAPI` also means the control can never
be a `full`-fidelity demo on the hub — the harness cannot fake a real Dataverse
call.

**Declare only what you call, not what you nearly called.** `Utility` gates
`context.utils`; `WebAPI` gates `context.webAPI`. Neither gates a plain
same-origin `fetch` against `/api/data/v9.2/`, which is the only route to
Dataverse *metadata* — `context.webAPI` addresses records by entity logical name
and cannot reach `EntityDefinitions`. A control that ends up reading metadata
that way should declare nothing, and `pcf-grid-data-bars` removed its `Utility`
entry on exactly those grounds. Leaving a declaration for an API you stopped
calling is a permission prompt for nothing, in the one file an administrator
reads to find out what a control touches.

**`required` is not a hint, and getting it wrong on a feature the host lacks
does not degrade the control — it stops it loading.** The documented behaviour:

| Manifest | Host supports it | Host does not |
| --- | --- | --- |
| `required="true"` | API present, no check needed | Design-time warning, and **component load fails at runtime** |
| `required="false"` | API present | API absent; the control checks and adapts |
| not declared | API absent | API absent |

That middle cell is the one that costs a day. `WebAPI` is a Dataverse-dependent
API and is **not available in canvas apps at all**, so a control that declares it
`required="true"` renders nothing whatsoever in a canvas app — a blank space,
whose cause is one XML attribute and whose symptom points nowhere near it.

So the rule is about how much of the control survives without the feature. A
control that is *only* the feature — a barcode scanner without
`Device.getBarcodeValue` — may as well fail loudly, and `required="true"` is
honest. A control that mostly does something else and writes occasionally should
declare `required="false"` and feature-detect, so the host leaves the API out
instead of refusing the component. `pcf-kanban-board` reads a view and writes
on a drag; it declares `required="false"` and renders a read-only board in
canvas rather than nothing.

Feature-detect even where the types promise the API is there:

```ts
private canWrite(context: ComponentFramework.Context<IInputs>): boolean {
    return typeof context.webAPI?.updateRecord === 'function';
}
```

`context.webAPI` is typed as always present. That is a claim about the type
definitions, not about the host.

Custom pages are the exception worth knowing before concluding a control is
broken: they have runtime `WebAPI` support, but the **studio preview** reports
"Method not implemented". Dismiss it and publish — the call works in the
published app.

### Resources

```xml
<resources>
  <code path="index.ts" order="1" />
  <css path="css/ColorPicker.css" order="1" />
  <!-- 1033 last, and new languages go above it. See the ordering note below. -->
  <resx path="strings/ColorPicker.3082.resx" version="1.0.0" />
  <resx path="strings/ColorPicker.1036.resx" version="1.0.0" />
  <resx path="strings/ColorPicker.1031.resx" version="1.0.0" />
  <resx path="strings/ColorPicker.1041.resx" version="1.0.0" />
  <resx path="strings/ColorPicker.1033.resx" version="1.0.0" />
</resources>
```

**`_template` scaffolds five languages, not one.** English (1033), Spanish
(3082), French (1036), German (1031) and Japanese (1041), for every variant —
field, dataset and grid-customizer. That is the default because the alternative
default was never revisited: a control that ships English-only is one somebody
has to retrofit, and retrofitting means finding every user-visible string that
was hard-coded in the interim rather than put in the `.resx`. Starting with five
makes the `.resx` the obvious place to put a string on day one.

Drop the ones the project will not maintain, and say so rather than letting them
rot. A stale translation is worse than an honest fallback to English.

Every file must carry the **same key set**: a key missing from one language
falls back to the key name in that language only, which nobody notices until a
customer does. Generate the files from one list rather than copying and editing
by hand.

**`npm run check` now enforces all of this**, which it did not before P6:

- a `.resx` on disk that no `<resx path=…>` lists — never packed, so that locale
  silently falls back to English while the repository looks translated
- a key present in 1033 and missing from another language
- a key present in a language and not in 1033 (a warning — usually a rename that
  landed in one file only)
- a `{0}` that was dropped in translation

**Placeholders are compared as a set, not by position**, and that is the whole
reason the strings are templates rather than concatenations. German and Japanese
both move the placeholder: `"Copy {0}"` becomes `"{0} kopieren"` and
`"{0} をコピー"`, and the dataset variant's `"{0}–{1} of {2}"` becomes
`"{2} 件中 {0}–{1} 件"` — all three tokens reordered. A check that compared
position would flag every one of those, and the lesson people would take from it
is to write worse translations.

Say this out loud when a control's own code builds a sentence from pieces:
`label + ' ' + resources.getString('Copy')` is unfixable in German no matter how
good the translation is, because the verb has to go last. One key with a
placeholder in it is the only shape that survives.

**`pcf-start` picks the `.resx` by manifest order, not by language.** It reads
whichever file is listed **last** and ignores LCID and browser locale entirely.
Verified on `pcf-lookup-search` by reordering the block and rebuilding three
times: with `3082` last the whole control renders in Spanish, with `1033` last
it renders in English, same machine and same browser. It is invisible until a
control ships a second language and then reads as a bug in the control.

**So list `1033` last, and `_template` does.** The order is
`3082, 1036, 1031, 1041, 1033`.

The tempting alternative is to keep `1033`
first and leave a comment explaining why `npm start` looked wrong, on the
grounds that reordering "puts a development detail in a manifest that outlives
the reason for it". That argument does not survive its own premise: the platform
ignores the order **entirely** — a real app resolves from the user's provisioned
language — so `pcf-start` is the only thing in the world that reads it. There is
no platform-facing meaning being traded away, because there is no
platform-facing meaning at all. `1033`-first was itself a convention with
nothing behind it, and it cost every developer a confusing first `npm start`.

It stopped being a defensible default when the template went to five languages:
`1033` first means the last file is `1041`, so a freshly scaffolded control
renders entirely in Japanese the first time anyone runs it. That reads as a
broken build, and the fix people reach for — editing the strings — is aimed at
the wrong file.

**The cost of this choice, which is the thing to actually remember: a new
language must be added *above* `1033`, not appended.** Appending a sixth file
silently hands the harness to that language, and the symptom appears in an
`npm start` session nobody connects to a manifest edit. Every scaffolded
manifest carries that warning in capitals directly above the block, because
appending is what the shape of the list invites.

Virtual controls additionally declare platform libraries:

```xml
<platform-library name="React" version="16.14.0" />
<platform-library name="Fluent" version="9.46.2" />
```

### Platform library versions

A declared version is a **floor mapped onto a platform build**, not an exact
request. `node_modules/pcf-scripts/PlatformLibraryVersions.json` is the
authority, and it is worth reading once:

| Declared | The host actually serves | Bundle alias |
| --- | --- | --- |
| React `16.8` – `16.14.0` | 16.14.0 | `Reactv16` |
| React `18` – `18.3.1` | 18.3.1 | `Reactv18` |
| Fluent 8 `8.0` – `8.29.0` | 8.29.0 | `FluentUIReactv8290` |
| Fluent 8 `8.29.1` – `8.121.1` | 8.121.1 | `FluentUIReactv81211` |
| Fluent 9 `9.0.0` – `9.68.0` | 9.68.0 | `FluentUIReactv940` |

Two consequences that cost real time:

- **`React 16.8.6` and Fluent 9 cannot be installed together**, even though they
  work together at runtime. Both `16.8.6` and `16.14.0` resolve to the same
  `Reactv16`, but npm resolves the *devDependency* literally and
  `@fluentui/react-components` declares `peer react@">=16.14.0 <19.0.0"`. So
  `npm install` fails with ERESOLVE on a manifest that would have run fine.
  **Declare and install `16.14.0`** for anything using Fluent.
- The Fluent 9 alias reads `FluentUIReactv940` while the table serves 9.68.0.
  Misleading, but it is the platform's own name and the bundle has to match it.

**A platform library is a package, not a component set.** Fluent 9 is exactly
`@fluentui/react-components`, and plenty of what people think of as Fluent is
not in it. There is no DatePicker: Fluent 9's lives in
`@fluentui/react-datepicker-compat`, a separate package that is not a platform
library, so importing it bundles it and its calendar dependency. Check the
package actually exports what the design assumes before committing to it —
`node -e "console.log(Object.keys(require('@fluentui/react-components')))"`
settles it in one command. A native element is often the better answer: it
costs nothing, and the browser supplies keyboard handling, locale and
accessibility that a component library only re-implements.

**`pcf-scripts` does not validate platform-library names or versions at build
time.** A manifest declaring Fluent builds cleanly with
`@fluentui/react-components` not installed at all — the declaration is simply
inert until something imports from it. A wrong version fails in the host, not in
CI, so confirm it against the table rather than against a green build.

## Property types

Moved to [properties.md](properties.md#property-types), with

- **The wrong `of-type` does not fail — it empties the column picker** —
  [properties.md](properties.md#the-wrong-of-type-does-not-fail--it-empties-the-column-picker)
- **A `TwoOptions` input cannot default to on** —
  [properties.md](properties.md#a-twooptions-input-cannot-default-to-on)
- **`of-type-group` costs more than it looks** —
  [properties.md](properties.md#of-type-group-costs-more-than-it-looks)
- **An output that reports a verdict** —
  [properties.md](properties.md#an-output-that-reports-a-verdict)

## The bound property is more than `raw`

Moved to [properties.md](properties.md#the-bound-property-is-more-than-raw),
with

- **Three more things `context` gives you for free** —
  [properties.md](properties.md#three-more-things-context-gives-you-for-free)

## "Could not find/invoke <Namespace>.<Control>'s constructor"

The runtime error a model-driven form shows when it loaded the control's
resource and then could not find the class in it:

```
Error: Could not find/invoke PCFHub.GeoStamp's constructor.
pcf: Not found
default: Not found
```

**It says nothing about which half is wrong**, and the instinct — that the
control's code is broken — is usually the wrong end. Diagnose it in this order,
because each step is cheap and rules out everything below it.

**1. Does the built bundle register anything?** Load it the way the platform
does and look:

```js
const reg = require('./dev/host.js').captureRegistration(global);
vm.runInThisContext(fs.readFileSync('out/controls/<Control>/bundle.js', 'utf8'));
// reg.name should be "Namespace.Control", reg.ctor a function
```

`dev/smoke.js` already asserts this on its first line, so a passing suite has
answered it. If `reg.ctor` is not a function, or the load throws, the fault is
in the control and the rest of this section does not apply.

**2. Does the *packed* bundle register?** This is the one people skip, and it is
where the answer usually is — `out/` is not what ships. Pack the solution and
read the zip:

```bash
cd Solution && msbuild -t:build -restore -p:configuration=Release
```

Then extract `Controls/<prefix>_<Namespace>.<Control>/bundle.js` from
`bin/Release/Solution_managed.zip` and load *that* the same way. A zip that
contains no `Controls/` directory at all means the `<ProjectReference>` to the
`.pcfproj` is missing from `Solution.cdsproj`.

Note the two builds differ: `npm run build` emits a development bundle, and the
msbuild pack emits a **minified production** one — three to four times smaller,
with the class renamed to a single letter. That is normal and not the fault;
`registerControl` is passed a reference, not a name.

**3. If both bundles are correct, the fault is the deployment**, and there is
one cause worth checking before any other.

### Dataverse will not replace a component at the same version

**This is the trap.** Importing a solution whose version matches the one already
installed is accepted, reports success, and **does not update the control's web
resource**. So a first deployment that was broken or incomplete — an interrupted
`pac pcf push`, a pack made before the code was finished — leaves the form
pointing at a registration that no longer has code behind it, and every
subsequent import at the same version changes nothing at all.

The symptom is exactly the error above, and the reason it is confusing is that
the repository is *correct*: it builds, it packs, the packed bundle registers,
and the environment still fails.

Three versions have to move together, and `npm run check` enforces their
agreement:

- `<control version="…">` in `ControlManifest.Input.xml` — the one the
  platform upgrades on
- `<Version>` in `Solution/src/Other/Solution.xml`
- `version` in `package.json`

Bump all three, repack, import. If the control is already on a form, publish all
customizations afterwards and hard-reload the browser — the old bundle is
cacheable and a soft reload will serve it again.

Deleting the control from the environment and reimporting also works, and is the
honest fallback when a version is already in customers' hands and cannot be
moved.

### And pack clean, because the pack is incremental

`msbuild` does not rebuild what it thinks is current, so a stale `out/` or
`Solution/obj/` is packed as-is. Before any pack whose contents you intend to
trust:

```bash
rm -rf out obj Solution/obj Solution/bin
```

This is the same reason `SPEC.md` should never quote a bundle size: the number
depends on which build last wrote the directory.

## One export per control file

`pcf-scripts` refuses a control whose entry file defines more than one export:

```
[pcf-1023] [Error] Control source code defines more than one export.
```

It fires once per exported symbol, at the "Validating control" step before
webpack runs, and names neither the file nor the symbol — so nothing in the
message points at the cause. What causes it is ordinary: a helper beside the
class, exported so a test or another control can reach it.

Put the helpers in a second module and import them. Only the manifest's entry
point is declared, and anything it imports is bundled with it, so a second file
costs nothing:

```
GeoStamp/index.ts   the class, and the single export
GeoStamp/geo.ts     the pure functions, exported freely
```

That split is worth having anyway — coordinate arithmetic, validation and an
error reader are not about PCF — but it is worth knowing it is compulsory rather
than tasteful.
