# The bound property

What a `bound` property carries besides `raw`, and what the form hands a
field control around it: security and validation, the column's metadata
(and where canvas diverges), a number, Duration or rollup column, and how a
save looks from inside the control. Choosing the `of-type` in the first
place, type groups and outputs are in [properties.md](properties.md).

- [The bound property is more than `raw`](#the-bound-property-is-more-than-raw)
  - [A bound number column](#a-bound-number-column)
  - [A Duration column](#a-duration-column)
  - [A rollup column](#a-rollup-column)
  - [What a field control sees when the record is saved](#what-a-field-control-sees-when-the-record-is-saved)
  - [Three more things `context` gives you for free](#three-more-things-context-gives-you-for-free)

## The bound property is more than `raw`

A `bound` property arrives as a bag with six useful fields, and a control that
reads only `raw` misses every state a real form puts it into. None of these are
gated features — no `<feature-usage>`, no permission prompt, nothing to declare.

```ts
interface Property {
    raw: any;              // narrowed by subtype: number | null, string | null, …
    error: boolean;        // the platform failed validation on this column
    errorMessage: string;  // its message, already localised
    formatted?: string;    // the platform's own display string
    security?: SecurityValues;  // { readable, editable, secured }
    attributes?: Metadata;      // column metadata — model-driven only
}
```

**`security` is not `mode.isControlDisabled`.** This is the one that produces a
real information bug rather than a cosmetic one. Field-level security can deny a
user *read* access, and when it does `raw` is `null` — indistinguishable from an
empty column unless `security.readable` is checked. A control that does not check
renders "no value" where the truth is "not allowed to see it". Check `readable`
before rendering anything, and `editable` alongside `isControlDisabled` before
accepting input:

```ts
if (security?.readable === false) { /* render a denied state */ }

const interactive =
    !context.mode.isControlDisabled && security?.editable !== false;
```

**Compare against `false`; never read the flag as a boolean, and never test
the bag for `undefined`.** `security` arrives in three shapes: `undefined` on a canvas app
(no field-level security at all); **`{ secured: false, editable: true,
readable: true }` on a real model-driven form for a column with no
profile** — an object, measured on every one of seven bound columns of an
Accounts form by `pcf-address-autocomplete-azure`; and **`{}` for an optional
bound property the maker never mapped** (same measurement). The earlier
form of the code above, `security === undefined || security.readable`,
reads that empty object as *denied* and hid the column's contribution. The
template's two scaffolds shipped it for a month; both are corrected, and the
field rig has `security: 'unsecured'` to reproduce the second shape.

**`error` and `errorMessage` are the platform's own validation**, already
localised. A code component that ignores them makes a failing business rule
silent — the form is blocked and nothing on screen says why. **Mark the field
— red, `aria-invalid` — and print the text only where the host does not.**
Measured on a model-driven form 2026-09-28 (`pcf-input-mask`): the modern form
draws the message under the field itself ("⊗ Main Phone: Required fields must
be filled in.", "…exceeded the maximum number of 20 characters…"), so a control
printing `errorMessage` too shows every error twice. Canvas draws nothing, so
there the text is the control's to show. **`attributes` being present is not the
tell for a model-driven form** — a canvas app hands one over too (below) — a
table's name in `attributes.EntityLogicalName` is. `pcf-input-mask` and
`pcf-number-slider` shipped `attributes !== undefined` as the test, which by
their code reads every canvas app as a form and prints no error text there
(not yet watched in a canvas app). Both template
scaffolds still print it; so, probably, does every field control built from
them.

**`attributes` is where canvas and model-driven actually diverge, and not by
being absent.** A model-driven form supplies the column's metadata —
`NumberMetadata` has `MinValue` and `MaxValue`, `StringMetadata` has `MaxLength`,
every one has `RequiredLevel` and `LogicalName`. **A canvas app supplies an
`attributes` as well, and it describes the manifest property, not a column.**
This file, the template's rig and several controls' comments said "a canvas app
supplies none" until a probe control read it on 6 October 2026 (the published
player):

| Member | On a form (a real column) | In a canvas app (every property) |
| --- | --- | --- |
| `EntityLogicalName` | the table — `cll_loan` | `""` |
| `LogicalName`, `DisplayName` | the column's | the **property's own name** |
| `MaxLength` | the column's — 850 | `100`, on every type |
| `MinValue` / `MaxValue` | the column's | ±100,000,000,000; a `Whole.None` ±2,147,483,647 |
| `Precision` | the column's | `2`; a `Whole.None` `0` |
| `Type` | `string`, `picklist`, `datetime` … | `string`, `integer`, `decimal`, `boolean`, `datetime` — a **choice is `string`** |
| `Behavior`, `Format` | the column's | `2` / `date` on a date-only property, `3` / `datetime` on a date-time one, `0` otherwise |
| `Options` | the column's | `No` / `Yes` on a yes/no; on a choice, the rows of its `<property>_Options` table numbered from 0 |
| `security` (beside it) | per the column | `{ editable: true, readable: true, secured: false }` |

**It does not depend on where the value comes from.** Six instances fed from a
literal, a variable, a collection and two Dataverse tables answered identically,
type for type, in three time zones: a canvas property is a formula's result, and
the host describes the property it was declared as. A SharePoint list, an Excel
table and a SQL source were not read, nor a gallery row or a form card; nothing
in what was read leaves room for them to differ, but that is an inference.

So a control that reads `attributes?.MaxLength` caps a canvas text field at 100
characters (the template's scaffold and `pcf-copy-field` both read it that way;
neither was watched doing it), one that reads a date `Behavior` moves the
day (*A canvas app states a behaviour for no
column* in `references/dates.md`), and one that announces `DisplayName` says
the property's name: `pcf-choices-picker` through 0.1.1 labelled every pill
"value: Draft" in the hub's canvas demo. **Ask whether a column is there before
believing any of it** — the template's scaffolds carry this as `columnOf`:

```ts
function columnOf<T extends object>(parameter: { attributes?: T }): T | undefined {
    const attributes = parameter.attributes as (T & { EntityLogicalName?: unknown }) | undefined;

    return typeof attributes?.EntityLogicalName === 'string' && attributes.EntityLogicalName !== ''
        ? attributes
        : undefined;
}

const ceiling = columnOf(context.parameters.value)?.MaxValue;
const max = ceiling === undefined ? requested : Math.min(requested, ceiling);
```

`EntityLogicalName` was the table's name on a form for a date, a date-time, a
text and a choice column, and empty for every type in canvas. It is not in the
typings, hence the cast. Two more shapes take the same branch: **an optional
property the maker left unmapped on a form arrives with `attributes: {}`** (and
`type: null`, `security: {}`), and PCFHub's demo harness publishes names and no
table (`baseAttributes()`, in `references/hub-demo.md`) — so the "no column" path is also the demo's and the unmapped property's,
which is why writing it this way costs nothing. The demo names a table only
where its fixture puts the property on a column of the form record's table
(from the hub's 2026-10-13 harness; never before it), so a demo whose fixture describes no
column still takes this path — *Column metadata comes from the fixture* in
`pcfhub-publish/references/hub-demo.md`.

**The rig can be either host, and it used to lie about this one.** The
template's `dev/host.js` handed `attributes: undefined` under `host: 'canvas'`
until 6 October 2026, so a suite proved a control against a host that does not
exist: `pcf-sla-timer` 0.2.0 passed and was late by the UTC offset in the
canvas app it was read in. It now hands over the placeholder above. Take it with
`node ../_template/scripts/sync-rig.mjs` and run the suite before trusting any
control written earlier.

### A bound number column

Measured on a model-driven Accounts form, 3 Oct 2026, by `pcf-number-slider`'s
probe — five columns, one of each kind plus a range pair. Its `SPEC.md` has the
dumps.

**What `attributes` carries.** On every number column: `Type` (`integer`,
`decimal`, `double`, `money`), `MinValue`, `MaxValue`, `RequiredLevel`,
`ImeMode` and **`Precision` — a whole number's included, at 0**, beside
`Format: "0"`. The typings put `Precision` on the fractional types only, and a
control that reads its *presence* as "can hold a fraction" is wrong on every
whole-number column. `type` was the bound column's own member on every column,
but a host may report the group or another member (*`of-type-group` costs more
than it looks*), so the evidence order is:

1. `attributes.Precision`: `0` is whole, above 0 is fractional;
2. else `Format` present, or `Type === 'integer'`: whole;
3. else an exact `type === 'Whole.None'`: whole — the canvas veto, where the
   `attributes` describe no column and steps 1 and 2 must not be asked (a
   canvas `Decimal` answers `Precision: 2` and a default range for nobody);
4. else unknown: take what the user gives.

**A declared range is not always a chosen one.** A column the maker never set
a range on carries its type's platform default — the table in
`grid-customizers.md`, under *The platform defaults, read off a real table*: ±2.1
billion for a whole number, ±100 billion for a decimal, 0..1e9 for a float.
Treat a range equal to that as "none declared". System columns carry big
ranges of their own that are *not* the default (`numberofemployees`
0..1,000,000,000, `revenue` 0..100,000,000,000,000): honoured as declared, and
the docs tell the maker to narrow them.

**The form reshapes a write without a word, and refuses only at Save.**

- 1.23456 written to a two-place Decimal came back **1.23** within 138 ms;
  3.5 written to a whole number came back **4**. So round to `Precision`
  before writing, or the echo will not match the write and an echo guard takes
  it for the form's change.
- A value outside `MinValue..MaxValue` is accepted by `notifyOutputChanged`,
  sets `error: true` with `errorMessage` "Enter a number between 0.00 and
  100.00.", and **the form refuses to save**. Refuse it at the control first,
  where the user can still see why.
- Every write re-renders **every** control on the form with
  `updatedProperties: ["value", "parameters"]`, so the flag says nothing about
  whose value changed. Compare values. (Measured among number-slider
  instances, which all name their bound property `value`. Two Code Editors
  on one form did not see it that way: the second's writes never reached the
  first as a pass naming *its* property — *What a field control sees when the
  record is saved*, below.)

**`formatted` carries the currency symbol; nothing else does reliably.**
`revenue` arrived as `$1,500,000.00`. `userSettings.numberFormattingInfo`
holds every member twice, PascalCase and camelCase; its `currencySymbol` is
**the organisation's currency, not the user's format's** — switched to German
formats, the separators and the currency patterns swapped (`1.500.000,00 $`)
and the symbol stayed `$`. `formatCurrency(-1234.5)` brackets en-US negatives,
`($1,234.50)`; a currency *code* passed as the symbol is prefixed in en-US
(`EUR1,234.50`) and suffixed in de-DE. Show `formatted` at rest and
`context.formatting` only for a value the control wrote and the form has not
echoed yet.

**An unset input is `raw: null`, never its manifest `default-value`.** On the
form as in PCFHub's demo (which hands a default over as a *string* until a
preset sets it). Decide every blank input's meaning in code.

**An input's *Bind to table column* lists only the property's own type.** In
the modern designer every input offers it; *Maximum* declared `Decimal`
listed only the table's Decimal columns. So a `min`/`max` meant to come from
another column binds to one type only — a whole-number or currency limit
cannot be picked.

**Canvas.** No column, so no range and no `Precision` worth believing — the
`attributes` there carry the type's defaults (*`attributes` is where canvas and
model-driven actually diverge* above): the maker sets them, and the
exact-`Whole.None` veto is the only kind evidence. **A `<type-group>` property
is one fixed type in a canvas app, and not always the first one listed.** A
mixed group listing `SingleLine.Text` first arrived as a Text input with
`type: 'SingleLine.Text'`, whatever the formula produced; but both date groups
read became `DateTime` — `pcf-sla-timer`'s, which lists `DateAndTime` first,
and `pcf-date-range-picker`'s, which lists `DateOnly` first — so a date group
answers `Behavior: 3`, `Format: 'datetime'` even for a plain `Date(…)` (probe
and Studio's property list, 2026-10-06; three groups read). **A number group
behaved as Decimal**: `pcf-number-slider`'s (`Decimal`, `Whole.None`, `FP`,
`Currency`) held every value to the placeholder's two places until 0.1.2 — a
step of 0.001 drawn as 0.01, a typed 0.12345 written as 0.12 — over a formula
and over a whole-number Dataverse column alike (a published canvas app,
2026-10-07; the effect was watched, the members were not read). Read the type off
`describe_control` or Studio's property pane, never off the manifest's order.
An unset number arrives as `0`,
an unset text as `""`, an unset yes/no as `false`, and only an unset date as
`null`. One OnChange per committed change (`pcf-number-slider` W8).

### A Duration column

Measured by `pcf-duration-input`'s probe, 30 Oct 2026 (its SPEC.md, P1). A
Duration column is a whole number of **minutes** with Format *Duration*.

- **Nothing can declare it.** `of-type="Whole.Duration"` fails the build at
  *Validating manifest* (pcf-1014); the schema's only whole-number type is
  `Whole.None`.
- **No designer offers a `Whole.None` control on one.** The modern designer's
  *+ Component* on a Duration column lists Canvas app alone, where a plain
  whole number lists every `Whole.None` control; the classic designer's *Add
  Control* the same. Both **keep and show a binding written into the form
  XML**.
- **Bound through the form XML, it works**: `value.type` `Whole.None`,
  **`attributes.Format` `"1"`** (a plain whole number reads `"0"`), range
  0 … 2,147,483,647, editable; a write of 90 fired one OnChange 113 ms later and
  saved. `Xrm`'s `getFormat()` answered `none` for the same column, hours
  after it was made — read `attributes.Format`, not `Xrm`.
- **Three texts for one value**: the platform's control showed *1.5 hours*,
  the `formatted` it handed the PCF *1.50 hours*, the Web API's formatted
  value *90*. Never scale a visual by a Duration value as if it were a count;
  name the unit. `pcf-sparkline`, `pcf-grid-data-bars` and
  `pcf-number-slider` each met "a count of minutes" in their own docs.

### A rollup column

Measured by the same probe (P8), on a whole-number rollup bound through the
form XML. The formula cannot be written through the Web API (Learn: "We don't
support defining the formulas with code"); `CalculateRollupField` computes
one record at once instead of the 12-hour job.

- **It arrives disabled**: the pass's `disabled` `true`, `security.editable`
  `false`, `attributes.SourceType` `2`. `attributes` carries keys no other
  column showed: `rollupValid`, `rollupStateField` / `rollupStateValue` (the
  `_state` companion), `lastUpdatedField` / `lastUpdatedValue` (the `_date`
  one — an hour later than the Web API's, seconds dropped, not explained) and
  `recalculate`, a function (not called).
- **The platform draws the chrome around the control**: *Recalculate* and
  *Last updated* appear under a PCF on a rollup as under its own control, and a
  recalculation from there reached the PCF as one pass ~500 ms later.
- **A write is accepted and thrown away.** `notifyOutputChanged` on the
  disabled rollup set the attribute and marked it dirty; a Web API `PATCH`
  of the column answered 204 and kept the old value (`IsValidForUpdate`
  `false`). Nothing refuses it, so honour `disabled` yourself.

### What a field control sees when the record is saved

Nothing says "saved". A field control gets no save event, no dirty flag and no
`modifiedon`, and the context's keys are the same before and after. What it
does get, measured on the account form by `pcf-code-editor`'s 1.5.9 probe
(2026-10-09), every pass tagged `updatedProperties: ["code","parameters"]`
(the bound property's name, and `parameters`):

| What happened | Passes the control got |
| --- | --- |
| The control wrote (a keystroke, then a click away) | **one**, carrying the value just written — the echo |
| Save, Save & Close, or *Ignore and save* on duplicate detection | **three**, 0.88–1.15 s after the press, carrying the value it already holds |
| The auto-save, ~30 s after the last change | **two**, the same — also when only **another column** changed |
| A save refused (a required column empty, duplicate detection open) | **none** |
| A form script's `setValue` on the column | **one**, 20 ms later, carrying the **new** value |
| Another column edited through the platform's own text box | **none** within 5 s |
| Another code component on the form writing its own column (W8) | none naming this control's property |
| The record reopened inside the app | `destroy`, then a new `init` with the stored value |

`init`'s pass names every property — 25 for a field control, `entityId`,
`isPageReadOnly`, `syncError` and `isEmpty` among them; a resize names
`layout`. No later pass named any of the others.

**So a save is a pass naming the bound property, carrying what the control
already holds, when the control has written nothing for a second** — an echo
lands 120–430 ms after a write, a save's burst 0.9 s or more after the press.
A script's value differs from what the control holds, so the same reading
keeps it apart. `pcf-code-editor` 1.6.0's *Changes* moves its baseline on that
reading (`CodeEditor/baseline.ts`), and its two failure modes both show more
than changed, never less: a save pressed within a second of the last
keystroke is caught by the burst's later passes or by the next save, and a
script that sets the value already held reads as a save. **Without a form**
— a canvas app, the hub's demo — a new value the host hands in is the saved
value, and the client URL being absent is how to tell. The field harness's
*Save the record* stages the burst.

### Three more things `context` gives you for free

- **`context.mode.label`** — the label the maker gave the field on this form.
  A better accessible name for the control than any string in the `.resx`, which
  cannot know what the field is called. Use the resource as the *fallback*:
  `context.mode.label || context.resources.getString('…')`.
- **`context.mode.isVisible`** — canvas relies on it; a model-driven form hides
  the section itself. One class toggle covers both hosts.
- **`context.userSettings.isRTL`** — set `dir` from it, and remember that this
  inverts the *horizontal* arrow keys and any left/right hit test. `ArrowRight`
  should decrement under RTL. Invisible to an LTR reviewer, so say in the PR that
  both were handled.

And prefer **`context.formatting`** (`formatInteger`, `formatDecimal`,
`formatCurrency`, the date helpers) over `Intl`. It follows the user's Dataverse
settings rather than the browser's, so the control's numbers match the rest of
the form instead of merely being plausible.
