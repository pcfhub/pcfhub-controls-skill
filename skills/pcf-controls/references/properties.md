# Properties

How each property reaches the control: the `of-type` values, the type groups
and what they cost, outputs, and everything a bound property carries besides
`raw`. The manifest's other elements — features, resources, platform
libraries — and the load failures are in [manifest.md](manifest.md).

- [Property types](#property-types)
  - [The wrong `of-type` does not fail — it empties the column picker](#the-wrong-of-type-does-not-fail--it-empties-the-column-picker)
  - [A `TwoOptions` input cannot default to on](#a-twooptions-input-cannot-default-to-on)
  - [`of-type-group` costs more than it looks](#of-type-group-costs-more-than-it-looks)
  - [An output that reports a verdict](#an-output-that-reports-a-verdict)
- [The bound property is more than `raw`](#the-bound-property-is-more-than-raw)
  - [What a field control sees when the record is saved](#what-a-field-control-sees-when-the-record-is-saved)
  - [Three more things `context` gives you for free](#three-more-things-context-gives-you-for-free)

## Property types

`of-type` values you will actually reach for:

| Type | Notes |
| --- | --- |
| `SingleLine.Text` | Also `.Email`, `.Phone`, `.URL`, `.TextArea` |
| `Multiple` | Long text |
| `Whole.None` | Integer. Also `.Duration`, `.TimeZone`, `.Language` |
| `Decimal`, `FP`, `Currency` | Numeric |
| `TwoOptions` | Boolean |
| `OptionSet`, `MultiSelectOptionSet` | Choice columns |
| `DateAndTime.DateOnly` / `.DateAndTime` | Dates |
| `Lookup.Simple` | Lookups (model-driven only) |
| `Enum` | Author-defined list of `<value>` children — for configuration, not data |

`usage` is `bound` (reads and writes a column), `input` (configuration the maker
sets), or `output` (the control writes, nothing reads back into it). A `bound`
property is the one that must appear in `getOutputs()`.

### The wrong `of-type` does not fail — it empties the column picker

This is the failure mode to know before choosing any `bound` property's type,
because nothing in the repository can show it to you. The form designer offers
**only columns whose type matches the property**, so a control whose `of-type`
is wrong for its intended column is not broken at runtime and not broken at
build: it is unselectable. The maker opens the designer, finds the dropdown
empty or missing the column they came for, and has no way to tell whether the
control or the column is at fault.

It builds, it lints, it passes every assertion, and it fails on somebody else's
screen. So the type has to be checked against the **real column**, in the table
reference, before the property is written.

**The trap that catches geographic controls: Dataverse's coordinate columns are
`Double`, not `Decimal`.** From the account table reference,
`Address1_Latitude` is `Type: Double`, `MinValue -90`, `MaxValue 90`,
`Precision 5` — and `address1_` / `address2_` / `address3_` on contact, lead,
publisher and the rest are the same. PCF spells `Double` as **`FP`**.
`pcf-geo-stamp` shipped `of-type="Decimal"` on exactly the reasoning that sounds
right — "coordinates are decimals" — and was unbindable on every table it was
designed for.

The general shape of the fix is a type group, and this is the case they are
*for*:

```xml
<type-group name="coordinate">
  <type>FP</type>
  <type>Decimal</type>
</type-group>

<property name="latitude" of-type-group="coordinate" usage="bound" required="false" … />
```

`FP | Decimal` is a **good-case** group by the test in the section below: both
are `NumberProperty` subtypes, so `refreshTypes` generates `NumberProperty` with
`raw: number | null` and `IOutputs` keeps `number` — verified on
`pcf-geo-stamp`, not one cast changed. The cost is the flattened
`"Decimal | FP"` string on the hub, and `Precision` dropping out of the
generated type — it still arrives on every number column at runtime, a whole
number's at 0, and is read through a cast (*A bound number column* below).

Leave `Whole.None` out of a group like that even though it is also a
`NumberProperty`. Adding it makes an integer column selectable, the platform
accepts the binding, and every reading is truncated to the nearest degree —
about 111 km. **A type the control cannot honour is worse offered than
withheld**, because the designer presents it as supported.

One more thing the reference tells you and the type system does not: those
columns are **precision 5**. A control writing six decimal places to one has its
sixth digit rounded away on save, so a text column holding the full value and a
numeric column holding the rounded one disagree in the last place — platform
behaviour, not a bug, and worth saying to the maker rather than working around.

**`Enum` generates a real string union**, and that is worth knowing next to the
section below. A property declared with `<value>` children arrives as
`EnumProperty<"pager" | "loadMore">` in `generated/ManifestTypes.d.ts` — not
`any`, not a bare `string` (verified on `pcf-compact-list`, types 1.3.18). So for
a fixed set of author-defined choices, `Enum` costs nothing at the type level,
where `of-type-group` can cost you the type entirely.

Read the value defensively anyway. A canvas formula can supply a string outside
the union, and the union is a compile-time claim about a runtime the compiler
does not control:

```ts
const mode = String(context.parameters.paging.raw ?? 'pager') === 'loadMore' ? 'loadMore' : 'pager';
```

### A `TwoOptions` input cannot default to on

`refreshTypes` generates `TwoOptionsProperty` with **`raw: boolean`** — not
`boolean | null`. So there is no value that means "the maker never touched
this", and a maker who does not touch it gets `false`. A property that wants to
default to *on* therefore cannot: `?? true` has nothing to fall back from, and
`default-value="true"` in the manifest does not close the gap either.

There are two honest ways out, and which one is right depends on how the
property reads:

- **Invert the name**, so the platform's `false` is the behaviour most people
  want. `pcf-file-drop` has `hidePreview` rather than `showPreview` for exactly
  this reason. Cheap, and the awkward name is the whole cost.
- **Make it an `Enum` with two values**, which carries a real `default-value`
  and generates the string union above. `pcf-view-filter` has
  `itemClick: open | none` rather than an inverted boolean, because "clicking a
  record does nothing" is a worse name than a choice between two verbs.

**A blank input is `null` on a form, whatever the manifest's default.**
Measured with `pcf-hierarchy-view`'s 0.2.9 probe (2026-10-15): a
`TwoOptions` input with `default-value="false"` and an `Enum` with
`default-value="tree"`, both left blank in a binding, arrived as **`raw:
null`** — the generated type says `boolean` and the string union, and neither
default reached the control. **A property added in a later version arrives
the same way on a control that was already placed**: there is no entry for it
in the form XML at all. `pcf-date-range-picker`'s 0.3.9 probe (2026-10-29)
read its new `fiscalYearStart` Enum (`default-value="org"`) as `raw: null`,
and the new Whole inputs as `raw: null, type: null`, while a `-30` written
into the form XML arrived as the number `-30`, `type: 'Whole.None'`. So an
upgrade never applies a new property's default for you. So read `null` as the default yourself, and read
a `TwoOptions` through a normaliser that also turns the hub harness's string
`"false"` into off: `raw === true || raw === 'true' || raw === 1 || raw ===
'1'`.

What not to do is leave a `showX` property that silently starts off. It looks
like a control with a broken default, and the maker has to find a checkbox
nobody told them about. Note that `pcf-star-rating` ships `showClear` and lives
with the consequence — it is the example of the trap rather than of the fix.

### `of-type-group` costs more than it looks

A `type-group` lets one property accept several types. Reach for it only when
the types are near-interchangeable — `SingleLine.TextArea` and `Multiple`, as
`pcf-code-editor` does, where `raw` is a string either way. Three costs, all of
them easy to discover too late:

1. **It may erase the property type in the generated types** — it depends on the
   group, so check rather than assume. `pcf-scripts` falls back to the *base*
   `ComponentFramework.PropertyTypes.Property` — `raw: any`, `attributes?:
   Metadata` without the specific metadata, `IOutputs` as `any` — only when the
   grouped types have **no common generated property type**.

   `OptionSet | MultiSelectOptionSet` has none, so `pcf-choices-picker` pays the
   full cost and casts on every read. `Whole.None | Decimal` does: both are
   `NumberProperty` subtypes, and the platform typings say so out loud — the
   `NumberProperty` doc comment reads "when property manifest type is
   Whole.None|FP|Decimal". `pcf-star-rating` groups those two and generates
   `NumberProperty` with `raw: number | null` and `attributes?: NumberMetadata`,
   with not one cast in the control. `DateAndTime.DateOnly |
   DateAndTime.DateAndTime` is the same story: `pcf-date-range-picker` 0.2.7
   groups those two on *both* of its bound properties and still generates
   `DateTimeProperty`, with `attributes?: DateTimeMetadata` and `Behavior`
   and `Format` in reach.

   What is lost even in the good case is the *subtype* — in the types, not at
   runtime: `NumberMetadata` declares `MinValue` and `MaxValue`, and
   `Precision` lives on `DecimalNumberMetadata`, out of the generated type's
   reach. A form hands `Precision` over on every number column anyway (*A
   bound number column* below), so read it through a cast. Run `npm run
   refreshTypes` and read `generated/ManifestTypes.d.ts` — it is two seconds
   and it answers the type question exactly.
2. **PCFHub flattens it, and demos its first member.** `ControlManifestParser`
   does `implode(' | ', $typeGroups[$groupName])`, so the published API
   reference shows the property's type as `OptionSet | MultiSelectOptionSet`,
   and the demo panel's editor inference falls through to a plain text box.
   The demo then builds the property as the group's **first** member, `type`
   included (`DemoPropertyData::fromModel`) — so list first the member the
   demo should be. `pcf-number-slider` listed `Whole.None` first and every
   preset was a whole number; a form ignores the order.
3. **It may be model-driven only.** Microsoft's property schema reference is
   commonly read as listing `of-type-group` under model-driven apps only.
   Treat that as unconfirmed unless you have tested it: `pcf-scripts` enforces
   nothing of the kind — its only type-group diagnostic is "references a
   non-existent `<type-group>`".

**Do not "solve" this with a second bound property.** The obvious alternative —
one optional bound property per type — is worse, and worse in a way that only
shows up on a real form:

> A field control binds its **first** bound property to the column it is placed
> on, and renders every *additional* bound property as its own column picker in
> the configuration pane. So a maker chooses the column, and is then asked to
> choose another one, for a control that attaches to exactly one column.
> `required="false"` does not suppress this.

`pcf-choices-picker` shipped that shape, had it reported from a real
environment, and reverted to a single type-grouped property. The type-group's
costs are a cast in one file and a cosmetic string on the hub; the second bound
property's cost is a wrong question asked of every maker.

So: **one bound property per logical column.** Use a type-group when a single
column may be one of several types, and narrow at the boundary.

**The test is not the number of properties — it is whether the extra column
picker is a fair question to ask the maker.** `pcf-choices-picker` needed one
column and asked for two, which is why it reverted. `pcf-date-range-picker`
binds `startDate` and `endDate` and asks for two, because a date range
genuinely *is* two columns and there is no other way for a maker to say which
one holds the end. Same mechanism, opposite verdict.

For a control that legitimately spans several columns:

- Declare the property the control should **attach to** first. A field control
  binds its first bound property to the column it is placed on.
- Expect two of everything else. `security` is per property, so a user can be
  denied one column and permitted another; `error`/`errorMessage` likewise, and
  each belongs under the field it came from.
- Every bound property appears in `IOutputs`. Return the **required** ones on
  every call; for the optional ones, read the next paragraph first.

**Seven, measured.** `pcf-address-autocomplete-azure` binds a street and six
optional columns — city, region, postal code, country, latitude, longitude —
and went on a real Accounts form on 2026-09-13 with each of these questions
asked before the feature was written. What came back:

- **A bound column need not be on the form to persist.** City was removed
  from the form and left bound; a write to it survived Save and a Web API
  read-back. The six need binding, not placing — say so in `model-driven.md`.
- **An unmapped optional bound property is detectable, and `type === null`
  is the tell.** A picker the maker left empty arrives as
  `{ type: null, raw: null, formatted, attributes: {}, error: false,
  errorMessage, security: {}, isPropertyLoading }` — eight keys — where a
  mapped column carries fifteen, with `type` set and `attributes` holding
  `LogicalName`/`DisplayName`. `pcf-geo-stamp` built its coordinate columns
  believing the two were indistinguishable; they are not. Never write to an
  unmapped one and never emit a key for it.
- **Emit an optional column only once the control has written or cleared
  it** — geo-stamp's rule, and still right: a column the platform handed a
  value and the control never touched is not in the outputs at all. `null` on
  a mapped column clears it (measured), so a pick that has no value for a
  part clears that part rather than leaving the previous address's.
- **The platform echoes writes back out of order.** Every
  `notifyOutputChanged` produces an `updateView` carrying the value just
  written, and typing "pase laur" produced passes carrying `"pase laur"`,
  `"pase lau"`, `"pase laur"` — the echo of an earlier keystroke after a
  later one. A guard that recognises only the *last* write adopts the stale
  echo as a form-driven change and the last character typed disappears,
  which a fast typist reported within minutes. Remember every recent write
  per column (a bounded list, 32 is plenty); an incoming value among them is
  an echo whatever its order, a value never written is the form's and resets
  the list. A React component holding the text needs the same guard on its
  side, or the platform's echo closes its dropdown after every letter.
  **It is not a multi-column finding**: the one column a field control binds
  is echoed the same way, and both scaffolds carried a single-value guard
  until `_template` 87173d2. See *The caret, and what actually moves it* in
  `rendering-and-hosts.md`.

**Narrowing it: do not substring-match `property.type`.** For a type-grouped
property the platform may report the *group's accepted types* rather than the
resolved member — a string naming every type in the group, whichever column is
actually bound. `pcf-choices-picker` tested `/multi/i` against it and rendered
every single-select column as a multi-select on real forms.

Let the value's own shape answer first, and compare the type string exactly:

```ts
if (Array.isArray(property.raw)) return 'multiple';   // proof
if (typeof property.raw === 'number') return 'single'; // proof
if ((property.type ?? '').trim() === 'MultiSelectOptionSet') return 'multiple';
return 'single';
```

Exact comparison is correct whichever way a host behaves: a definitive member
name is honoured, and a group string matches nothing and falls to the default.
Where the arity genuinely cannot be determined — an empty column on a host
reporting the group string — give the maker an input property to override it,
and say so in the docs rather than hoping.

**And a single member name can be the wrong member.** `pcf-input-mask` binds
the group `SingleLine.Text | SingleLine.Phone`; on the Accounts form
(2026-09-28) `type` answered `SingleLine.Phone` on `telephone1` — and
`SingleLine.Phone` again on `accountnumber`, a **Text** column. So an exact
comparison is not proof either: it trusts a name the host can get wrong. For a
text format, `attributes.Format` / `FormatName` (`"Phone"`, `"Text"`) named the
bound column correctly on both — use it where it exists (not in canvas), and
the value's own shape before any type string.

**Then decide which way the check should fail.** The shape test above is proof,
but not every group has one — `Whole.None | Decimal` both arrive as `number`,
and a Decimal column holding `3.0` is indistinguishable from a whole one. When
only the type string is left, point the exact comparison at the case you want to
*forbid* rather than the case you want to allow.

`pcf-star-rating` offers half steps and must never write `3.5` to a `Whole.None`
column. Testing `/decimal/i` to enable them inverts on a host reporting the group
string — that string contains "Decimal" whatever the column is, so the half step
switches on for exactly the column it was meant to protect. Testing
`=== 'Whole.None'` to *veto* them fails the other way: the group string matches
nothing, the maker's own input property stands, and the one column type that
truncates is still refused.

Enabling on a loose match turns an unknown into a yes. Vetoing on an exact match
turns an unknown into the maker's stated intent, which is the answer you can
defend in the docs.

### A clear is `null`, never `undefined`

`getOutputs()` returns every bound property, and the generated `IOutputs`
types each one as optional — `value?: number`, `startDate?: Date` — so
`this.value ?? undefined` type-checks cleanly and means the opposite of what a
clear needs: `undefined` is "no change". A canvas app honours that strictly
and the field simply refuses to empty; a model-driven form is more forgiving,
so the bug hides on the host most people test first. Emit `null` and cast past
the generated type:

```ts
return { value: this.value === null ? (null as unknown as undefined) : this.value };
```

The generated type is narrower than the contract here, so the cast is the fix
rather than a workaround. `pcf-star-rating` shipped `?? undefined` and its
clear button did nothing in canvas.

### An output that reports a verdict

`usage="output"` hands a value to the host without binding a column —
`pcf-code-editor` 1.3.0's `isValid` and `problemCount`, for a canvas app to
gate its Save button on. Five things decided how, all measured on its 1.2.9
probe (2026-09-23) or found building it:

- **It is for canvas.** The modern form designer lists an output as a
  read-only label and offers nothing to bind. **The classic designer offers a
  pencil on it** — and binding a column there and saving the form fails with a
  browser alert reading `[object XMLDocument]`, the designer stringifying the
  server's refusal; the form is not saved. So an output is not a way to store
  a result on a model-driven form, and `docs/` should say not to bind one.
  Unbound, it imports and publishes cleanly.
- **Notify when the output changes, not only when the bound value does.** A
  verdict can change with nobody typing — a schema landing, a switch — and a
  canvas formula reads it only after `notifyOutputChanged`. Compare against
  the last verdict handed over and notify on a difference.
- **Report the first verdict whatever it is. In a canvas app an output nobody
  has reported reads `false`.** `pcf-input-mask` through 0.1.1 notified on
  load only when the verdict was false, on the belief that silence meant true.
  Read in a published canvas app (2026-10-07): a complete phone number and an
  empty optional field both gave `isValid` false to a label formula until
  their first edit, so a Save gated on it stayed off for a record nobody had
  touched. Start "the last verdict handed over" as *nothing*, so the first
  comparison always notifies. The cost is one `OnChange` on load; say so in
  `docs/canvas.md`. A control that would rather not notify on a form's load
  can keep that to the host with no column — `columnOf` above.
- **Which makes every `getOutputs()` call a write of the bound value too**, so
  hand an untouched column back exactly as it came: `null` for a null column,
  not `""`. A control that normalised `raw ?? ""` for its editor and returned
  that made no difference while it notified only on keystrokes; notifying on a
  verdict would hand back a change nobody made.
- **Decide what "valid" means when the check is incomplete, and fail
  closed.** `isValid` is true only once the document has been checked against
  everything the maker asked for; while a schema is loading, missing or broken
  it is false, and "No problems" is not claimed. The count stays a count of
  what was found. A canvas app that enables Save on the verdict would
  otherwise save a document nobody checked — the harness showed exactly that
  before the rule existed.
- **An output is permanent API.** A formula may bind it the day it ships;
  renaming or removing one breaks apps the author never sees. Add one only
  for a decision a maker cannot reach otherwise.

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
