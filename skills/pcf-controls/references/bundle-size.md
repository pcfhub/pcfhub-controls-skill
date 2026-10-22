# Bundle size

What decides a control's bundle size and what does not: `standard` against
`react_virtual`, a library that is most of the bundle, and language features
without a worker.

Split out of `rendering-and-hosts.md` on 15 Oct 2026, so each file can be read
whole.

- [Bundle size](#bundle-size)
  - [`standard` versus `react_virtual` is not a bundle-size decision](#standard-versus-react_virtual-is-not-a-bundle-size-decision)
  - [A library that is most of the bundle](#a-library-that-is-most-of-the-bundle)
  - [Language features without a worker](#language-features-without-a-worker)

## Bundle size

For anything with real UI, `react_virtual` plus platform libraries beats every
bundling trick — it removes React and Fluent from the bundle entirely.

### `standard` versus `react_virtual` is not a bundle-size decision

Say this out loud before advising anyone, because the intuition is wrong and the
numbers are cheap to check. Two dataset controls of comparable scope, both
packed in production mode:

| | `pcf-compact-list` (standard) | `pcf-data-table` (react_virtual) |
| --- | --- | --- |
| `npm run build` | 25,650 B | 35,694 B |
| msbuild pack | **7,472 B** | **9,262 B** |
| solution zip | 10,021 B | 10,441 B |

Measured at `pcf-compact-list` v0.1.0 / `pcf-data-table` v0.1.2, both packed
from clean trees. Quote them with the versions attached: an earlier pass of this
table read 6,872 against 9,020, and the difference was a bug fix landing in both
controls rather than anything about the frameworks.

**1,790 bytes.** Not an order of magnitude — a rounding error on any connection
that is going to load a Dataverse form at all.

The reason is that React and Fluent were never in the React control's bundle
either: `react_virtual` makes them `<platform-library>` externals, so both
controls ship only their own code and the gap is a DOM builder versus a React
tree. What the number does not capture is what the **browser** fetches — the
React control also causes the host to load the platform's React and Fluent,
which are far larger than 2 KB and are cached across every control on the page.

So the real questions are: does this control's UI earn a component library, and
is it the *only* reason those platform libraries get pulled into this app? On a
form that already has a React control on it, the second answer is no and the
first is the whole decision. Recommend `standard` because the control is one
input and a button, not because of bundle bytes.

**When Fluent is a `<platform-library>`, import from the package root.**

```ts
import { Checkbox, FluentProvider } from '@fluentui/react-components';
```

`pcf-scripts` marks the *package* external and rewrites those imports to the
version-encoded global (`FluentUIReactv940`). A deep subpath like
`@fluentui/react-components/unstable/Button` is a different module specifier, so
it may not match the external mapping and gets bundled instead — the exact
opposite of the intent. Deep imports are a tree-shaking trick for controls that
bundle Fluent, and they are counterproductive for controls that do not.

Prove the result rather than reading `package.json`, because nothing in CI
checks it:

```bash
grep -o 'Reactv16\|FluentUIReactv940' out/controls/<Control>/bundle.js | sort -u
grep -c '__SECRET_INTERNALS\|griffel\|react-dom.production' out/controls/<Control>/bundle.js
```

The first should list the externals; the second must be `0`. Size is the other
tell — a virtual control carrying React and Fluent properly is tens of KB, not
megabytes. For reference, `pcf-choices-picker` is 23 KB from `npm run build` and
**5.9 KB** after the msbuild pack, which rebuilds in production mode.

Both workflows hard-fail if `bundle.js` exceeds **5,242,880 bytes**, the default
Dataverse web-resource limit. An administrator can raise the environment's
limit, but the CI check is a fixed number.

### A library that is most of the bundle

`pcf-code-editor` bundles Monaco, and at 1.1.0 it shipped at 4.9 MB against
the 5 MB ceiling. 1.2.0 took it to 4.1 MB *while adding* the find widget,
folding, the context menu, Format Document and marker hovers, and the way it
got there is the pattern for any control whose bundle is mostly somebody
else's library:

- **Import the API, not the "everything" entry, and name each feature.**
  `monaco-editor/editor/editor.api` is the bare editor; `editor.main` is the
  API plus eighty grammars, four worker-backed language services and every
  contribution. The control lists its contributions in one file, one import
  each, under a rule — *it has to work without a language service* — and
  measures after each addition. The F1 palette turned out to cost 60 KB and
  stayed; the JSON language service cost 1.9 MB for nine providers that proxy
  to a web worker PCF cannot start, and went. Its main-thread tokenizer is a
  standalone module and was kept.

- **A web worker cannot start, so say so up front.** PCF serves one file; a
  library that reaches for `new URL('worker.js', import.meta.url)` gets a stub
  webpack emitted beside `bundle.js` that the platform never serves, and fails
  asynchronously — four console errors and a 404 on every form, then the
  main-thread fallback anyway. Monaco consults `MonacoEnvironment.getWorker`
  first, and a function that **throws** reaches the same fallback synchronously
  through a catch that warns once. Look for the equivalent hook in whatever
  library it is; the difference is one honest warning against a console that
  looks broken.

- **The library's `exports` map decides what you can reach.** Monaco's is
  `"./*": "./esm/vs/*.js"` — it appends `.js`, so no stylesheet is importable by
  path, and it only covers `esm/vs/`, so a vendored dependency under
  `esm/external/` (jsonc-parser) is unreachable. The honest fix is a declared
  dependency on the same package, ~30 KB duplicated, rather than a webpack
  alias into the library's internals.

- **pcf-scripts 1.51 has a CSS rule of its own and resolves its loaders from
  the project root.** A `webpack.config.js` carrying its own `.css` rule from
  the 1.14 days now runs *after* pcf-scripts' (arrays merge by appending) and
  sass-loader is handed JavaScript: `expected "{"` on every stylesheet in the
  library. Delete the rule. But keep `style-loader` as a devDependency: the OOB
  rule names its loaders as bare strings, webpack resolves those from the
  project, and pcf-scripts' own copy under its `node_modules` is not on that
  path. Only a project that imports CSS from JavaScript ever sees this, which
  is why no sibling has.

- **Prefer a library that interprets over one that generates code.** A
  control has no say over the Content-Security-Policy of the page it is
  mounted in, and a library that compiles with `new Function` or `eval` —
  Ajv, the usual JSON Schema validator, generates a function per schema —
  runs only as long as that policy allows `unsafe-eval`. **Today it does, by
  default**: `new Function` ran on a model-driven form (`pcf-code-editor`'s
  1.2.9 probe, P5, 2026-09-23), and the default model-driven CSP is
  `script-src * 'unsafe-inline' 'unsafe-eval' blob:`. **But the admin centre
  has a Strict CSP toggle** (Environments → Settings → Privacy + Security)
  that drops `unsafe-eval` — `script-src 'self' blob: <platform>` — and the
  setting is per environment, so a control cannot know which it will meet.
  A choice that does not depend on the answer is the better one.
  `pcf-code-editor` 1.3.0 chose
  `@cfworker/json-schema`, which walks the schema instead: a
  `grep` of its `dist/` for `new Function` and `eval(` finds nothing, and it
  added ~39 KB to the production bundle. Check any candidate the same way
  before adopting it, and **read its output before trusting it**: that one
  reports every applicator as a wrapper plus a child, every `anyOf` branch
  separately, and a declared property that fails its own schema *also* as
  "additional" under `additionalProperties: false` — false, and filtered in
  the control's `schema.ts` with a canary assertion that fails the day a
  release fixes it.

Measured on `pcf-code-editor` 1.2.0, 2026-09-17: 4,906,601 bytes with the
JSON contribution, 3,052,377 with its tokenizer alone, 4,118,900 with the
twenty-six named contributions on top — `SPEC.md` there has the list.

### Language features without a worker

A library's language services — completion, hover, go-to-definition — usually
run in a worker a control cannot start. The half that needs no worker can be
had anyway: register the provider on the main thread and feed it from the
control's own configuration. `pcf-code-editor` 1.4.0 completes JSON from the
JSON Schema already in force for validation, and every rule below was measured
on the Accounts form with probes 1.3.9–1.3.11 (2026-09-26):

- **A provider belongs to the page, not to an editor.** Monaco registers one
  completion provider per language for every editor on the page, the way
  `setTheme` is one theme for the page. Register it once at module load, and
  have each control file its configuration in a registry keyed by the
  model's URI, removed in `destroy()` — the provider looks the model up and
  answers nothing without an entry. Two editors with two schemas kept their
  own lists, and a form-tab switch left no stale entry.
- **A contribution imported after the first API call is inert.** A
  contribution's services register when its module is evaluated and are read
  once, on the first `monaco.editor`/`monaco.languages` call. Imported after
  the module that makes that call, the suggest controller threw *"depends on
  UNKNOWN service ISuggestMemories"* on every editor and the list never
  opened. Import every contribution ahead of the first call, in one file.
- **`wordBasedSuggestions: "off"`**, or the suggest contribution asks for
  the editor worker in every language. With it off, not one `getWorker` call.
- **The widgets go under `<body>`, not inside the control.** A form's
  `overflow: hidden` containers cut them — the list on a short field's last
  line was not clipped but gone. `fixedOverflowWidgets` alone put every widget
  296px low and 44px right: three of the form's containers carry
  `transform: matrix(1, 0, 0, 1, 0, 0)`, an identity transform that still
  makes each the containing block for `position: fixed`, while Monaco
  computes against the viewport. **`position: fixed` cannot be trusted
  inside a model-driven form**, from any library. `overflowWidgetsDomNode`
  on a node under `<body>` carrying `monaco-editor` (Monaco's CSS and theme
  variables are scoped to that class) placed every widget on the caret.
  Monaco reads both options **at creation only**; `updateOptions` ignores
  them.
- **Then follow the form's scroll yourself.** Monaco repositions an overflow
  widget on its own scroll, and the form scrolls a container around it —
  about eight events per wheel notch, from the tab section. A capturing
  `scroll` listener on the document re-renders the editor
  (`editor.render(true)`, which reads the editor's page position again) while
  a widget is open, and closes the widgets once the caret's line leaves the
  visible part of the form — the intersection of every clipping ancestor with
  the viewport — or the list slides over the form's sticky header. An
  IntersectionObserver on the editor closes them when it leaves the view
  entirely, which is also what a form-tab switch does. Remove the node in
  `destroy()`: it lives outside the container the platform removes.
- **Markdown in a hover renders under the form's policy**, untrusted and
  without HTML: emphasis, code and lists rendered, no violation, and raw tags
  stripped rather than shown.
- **Enter takes a suggestion; Tab never arrives** — see *A model-driven form
  keeps Tab* in `styling-and-accessibility.md`.

What `pcf-code-editor` 1.5.0 added, completing FetchXML from the
environment's table definitions (its `SPEC.md`, 2026-10-01):

- **A second language on the same grammar scopes the providers.** `fetchxml`
  is registered with the XML Monarch grammar and configuration, and the
  FetchXML providers belong to it alone — so an `xml` editor is unchanged by
  construction, not by a check in every provider. A new feature arrives
  switched off, and the maker switches it on by naming the language.
- **Decide synchronously, and say what was missing.** The completion, hover
  and check modules take a snapshot of what has been read and return their
  answer *and* the metadata they lacked; the provider fetches that, waits up
  to a budget set from measured read times (1,000 ms against a slowest cold
  read of 311 ms), asks again, and returns `incomplete: true` if anything is
  still outstanding — Monaco then asks again on the next keystroke. The pure
  modules never wait, so the suite drives them with a hand-built snapshot.
- **A provider may return a promise**, and the list shows *No suggestions*
  until it resolves past the budget; nothing else is needed for an async list.
- **`description` on a `CompletionItemLabel` shows on every row; `detail`
  only on the focused one.** Four joins to one table all read `account`
  until each carried what it inserts (`accountid = masterid`) as the label's
  description — and a self-referencing lookup is a join each way, so the two
  rows meant opposite things.
- **`command: editor.action.triggerSuggest`** on an item that inserts
  `name="$1"` opens the value list inside the quotes it just wrote.
- **A hidden pane takes no keystrokes.** Drive the harness through Monaco's
  own commands — `setValue`, `setPosition`, `editor.action.triggerSuggest`,
  `acceptSelectedSuggestion` — on an instance the harness parks on `window`,
  and read the list back from its DOM. Two more traps of a hidden pane
  (2026-10-09): Monaco's `hasTextFocus()` stays true with `<body>` active,
  so a check that refuses an incoming value while the editor has focus
  refuses it there and nowhere else; and **`requestAnimationFrame` never
  runs**, so a model-driven form does not draw a tab opened in it — clicks,
  `setFocus()` and all. Ask for the pane to be shown.

What `pcf-code-editor` 1.6.0 added, a diff view (its `SPEC.md`, 2026-10-09):

- **The diff editor needs no worker either.** `createDiffEditor` is in the
  standalone API the bundle already carries; with `getWorker` throwing, the
  diff runs on Monaco's in-process fallback — 45 ms to the first diff of 500
  lines on the form, 25 ms for 5,000, a longest main-thread stall of 76 ms,
  and the fallback's warning once. The feature cost 8,114 bytes.
- **Its modified side can be the editor's own model.** One model in two
  editors is supported: typing on the right is typing in the column, and the
  completion, hover and markers keyed by that model work there unchanged.
  Disposing the diff editor leaves both models alone, so dispose the
  baseline model yourself and never the editor's.
- **Its construction options take no suggestion settings** — set those on
  `getModifiedEditor()` afterwards — and its overview ruler is a grey band
  as wide as two characters beside a form field; `renderOverviewRuler: false`.
  `useInlineViewWhenSpaceIsLimited` switches to one column below 900 px,
  which is most form fields.
- **What it compares with is the hard part**, because a field control is
  never told the record was saved: *What a field control sees when the
  record is saved* in `properties.md`.

The decisions — which subschemas apply at a path, what to offer, what the
hover says, whether the caret's line is visible — are pure modules the suite
drives through `dev/modules.js`, and the Monaco half is a thin wrapper, as in
[When the bundle cannot load in Node](../../pcfhub-new-control/references/verification.md#when-the-bundle-cannot-load-in-node).
The suggest and snippet contributions and the modules cost 158,227 bytes on the
production bundle (4,317,569 against 1.3.1's 4,159,342).
