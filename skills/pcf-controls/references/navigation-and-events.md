# Navigation, dialogs and events

Opening records, URLs and the quick create form, the platform dialogs, a
destructive command done safely, and raising an event to a canvas app or a
form script.

- [Navigation and dialogs](#navigation-and-dialogs)
  - [Presence is per method, not per bag](#presence-is-per-method-not-per-bag)
  - [Two routes to opening a record, and they are not interchangeable](#two-routes-to-opening-a-record-and-they-are-not-interchangeable)
  - [Creating a record through the quick create form](#creating-a-record-through-the-quick-create-form)
  - [`openUrl` has no failure channel, so validate before calling](#openurl-has-no-failure-channel-so-validate-before-calling)
  - [The dialogs, and the cancel that arrives as a resolve](#the-dialogs-and-the-cancel-that-arrives-as-a-resolve)
  - [Confirm, then destroy](#confirm-then-destroy)
  - [A destructive command over a selection](#a-destructive-command-over-a-selection)
  - [`deleteRecord`, beyond the N:N trap](#deleterecord-beyond-the-nn-trap)
- [Events](#events)
  - [`&lt;event&gt;` and `&lt;common-event&gt;` are two elements, and the tooling enforces it](#-and--are-two-elements-and-the-tooling-enforces-it)
  - [`refreshTypes` emits nothing for an event](#refreshtypes-emits-nothing-for-an-event)
  - [The model-driven payload can carry functions](#the-model-driven-payload-can-carry-functions)
  - [Two channels, and the double fire](#two-channels-and-the-double-fire)
  - [A counter, not just a state](#a-counter-not-just-a-state)
  - [`pfx-default-value` is a Power Fx expression, not a value](#pfx-default-value-is-a-power-fx-expression-not-a-value)
  - [Testing it](#testing-it)

## Navigation and dialogs

`context.navigation` is how a control leaves itself: opens a record, follows a
URL, or puts a modal in front of the user. Six methods, and **the only thing
they have in common is the bag they arrive in.** Two return `void`, one resolves
with a boolean nobody expects to be a resolve, and they are not present on the
same set of hosts.

| Method | Returns | Where it works |
| --- | --- | --- |
| `openForm(options, parameters?)` | `Promise<OpenFormSuccessResponse>` | model-driven |
| `openUrl(url, options?)` | **`void`** | everywhere |
| `openWebResource(name, options?, data?)` | **`void`** | model-driven |
| `openFile(file, options?)` | `Promise<void>` | model-driven — see [Files and binary content](files-and-device.md#files-and-binary-content) |
| `openAlertDialog(strings, options?)` | `Promise<void>` | model-driven |
| `openConfirmDialog(strings, options?)` | `Promise<ConfirmDialogResponse>` | model-driven |
| `openErrorDialog(options)` | `Promise<void>` | model-driven |

**None of them needs a `<uses-feature>`.** `Navigation` is not in the feature
list at all — `pcf-lookup-search` calls `openForm` with nothing declared, and
`pcf-row-commands` calls four of these with only `WebAPI` declared, for the
delete rather than for the navigating.

### Presence is per method, not per bag

`context.navigation` is typed non-optional, which is a claim about the type
definitions rather than about the host — the same claim `paging.loadExactPage`
makes, and that one has been observed missing.
Inside the bag it is worse, because the methods go missing *independently*:
`openUrl` is everywhere, `openFile` is documented model-driven only, and the
three dialogs are a model-driven affordance.

So this is the shape that fails:

```ts
// Wrong. Checks the bag once, then calls four things through it.
if (context.navigation) {
    context.navigation.openConfirmDialog(strings).then(…);
}
```

and this is the one that does not:

```ts
const confirm = context.navigation?.openConfirmDialog;

if (typeof confirm !== 'function') {
    // This host cannot ask. Decide what that means for the feature.
    return;
}

void confirm.call(context.navigation, strings).then(…);
```

`.call(context.navigation, …)` rather than a bare call, because pulling the
method off the bag loses its `this`.

**And never by listing its keys.** `Object.keys(context.navigation)` was
**empty** on the account form while `openUrl` worked (`pcf-code-editor`
1.5.9 probe, 2026-10-09): the methods live on the bag's prototype. A
presence check that enumerates — `Object.keys`, `for…in` with
`hasOwnProperty`, a spread into a plain object — finds nothing on the host
where everything is there. `typeof bag.method === 'function'` reads the
prototype; nothing else here should.

A control written the first way passes every test on the host it was written on
and throws a `TypeError` on the next one. **Decide what each method's absence
means for the feature it powers, per method**, and prefer hiding the affordance
to showing one that throws: a button that is not there is a host difference, and
a button that fails on press is a bug report.

### Two routes to opening a record, and they are not interchangeable

A dataset control has `dataset.openDatasetItem(record.getNamedReference())` —
which takes an `EntityReference`, has no id-based overload, and **returns
nothing**. `navigation.openForm({ entityName, entityId })` returns a promise —
and **it settles on navigation, not on close**: measured 2026-09-25
(`pcf-row-commands` P7), 309 ms after the call, as the form replaced the page.

That is the whole difference and it decides which to use:

- **Nothing to do afterwards** → `openDatasetItem`. It is the host's own route,
  it needs no entity name, and a subgrid may open the record its own way.
- **Something to do afterwards** → `openForm`, and fall back to
  `openDatasetItem` where it is missing. What "afterwards" can mean is narrower
  than it looks: a form that opens in place tears the control down, so a
  refresh chained on the promise runs — if at all — against a control that is
  gone. Guard it with a `disposed` flag, and rely on the remount for fresh rows.
  The quick create form is the exception: it opens over the page, and its
  promise settles when it closes (below).

`OpenFormSuccessResponse.savedEntityReference` on an ordinary form carries **the
record it opened** — `[{ entityType, id, name }]`, measured (P7) — not an
empty array. A quick create form's carries the record it saved,
or `null` when dismissed.

A **field** control has only the second route — there is no dataset to ask —
and `pcf-hierarchy-view` is the first to take it: a card's name calls
`navigation.openForm({ entityName, entityId })` and never for the record the
form is already on. The field rig has `openForm` behind `openForm: 'resolves'
| 'rejects' | 'absent'`, absent on canvas whatever the switch says; before that
control it deliberately had none, on the grounds that a stub nothing calls is a
stub nobody maintains.

### Creating a record through the quick create form

The third use of `openForm`, and the first control to exercise it is
`pcf-data-table` 0.4.0's New button. `DataSet.newRecord` is absent on
model-driven, so an inline blank row could only reach the server through
`webAPI.createRecord` — a second feature, a payload that bypasses every
business rule and required-field check the form would apply, and a row that
cannot fill a Choice or a Lookup. The quick create form is the platform's own
create surface and honours all of that:

```ts
const options: Record<string, unknown> = {
    entityName: dataset.getTargetEntityType(),
    useQuickCreateForm: true,
};

if (parent) {
    options.createFromEntity = { entityType: parent.entityTypeName, id: parent.entityId };
}

const result = await context.navigation.openForm(options);
const id = result?.savedEntityReference?.[0]?.id ?? null;   // every step optional — see below
```

Measured on a form subgrid, 2026-09-11:

- **`mode.contextInfo`** is the record the subgrid sits on — `{ entityTypeName:
  'account', entityId: '85f6…', entityRecordName: '…' }`, GUID unbraced. Passed
  as `createFromEntity` it seeds the relationship, and the saved row landed in
  the subgrid it was asked for from. It is untyped, and a main grid has no
  parent, so check both fields and leave the option out rather than send a
  reference to nothing.
- **Save resolves** `{ savedEntityReference: [{ id: "{436E09A8-…}", entityType,
  name }] }` — braced, upper-case, like `lookupObjects` and unlike every GUID
  `getValue` returns. Normalise it before it becomes an output.
- **Dismissing the form resolves `{ savedEntityReference: null }`** — not
  `[]`, not a rejection. A reader written as `saved[0]` throws on it, which
  is the branch a control forgets; the template rig resolves this shape by
  default for that reason.
- **`dataset.refresh()` afterwards** is what puts the row on screen, exactly as
  it is after `record.save()`.
- **The table needs *Allow quick create* on and a quick create form.** What
  `openForm` does without one has not been measured — say so under *Not
  verified* rather than guess.
- **The second argument is how the form opens with a column already set.**
  `openForm(options, parameters?)` — `parameters` is typed
  `{ [key: string]: string }`, a map of logical column name to value.
  Measured 2026-09-14 (`pcf-kanban-board` 0.2.2 probe): the quick create for
  `cll_task` opened with the Choice column already set from
  `{ cll_status: "858010002" }`, **and from the bare number too** — keep the
  string, which is what the typings declare. The "+" in a lane header passes
  `{ [status.name]: String(lane.value) }`. The template rig logs both
  arguments as one object — a stub that logged the options alone would
  certify a create that opens blank.
- **`openForm` mutates the options object it is handed.** After the call it
  carried a `recordSetQueryKey` the control never set. Build a fresh options
  object per call; one reused across calls arrives at the platform with the
  platform's own key already on it.

No `<uses-feature>` for any of it: `navigation` is not a gated bag. Canvas has
no `openForm`, so the button is model-driven only, and the rig removes the
method under `host: 'canvas'` for that reason.

### `openUrl` has no failure channel, so validate before calling

`void openUrl(url, options?)` — the odd one out. Nothing to `await`, and
`.catch()` on it is a `TypeError`. More importantly there is no report of any
kind: a URL the host will not open says nothing back.

**A URL that came out of a record is untrusted input.** It is whatever anybody
with write access to that row typed, and `openUrl` follows what it is given.
Judge it before the call, because there is no after:

```ts
function safeUrl(value: unknown): string {
    if (typeof value !== 'string') return '';

    let parsed: URL;

    try {
        parsed = new URL(value.trim());
    } catch {
        return '';        // relative paths land here too
    }

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? parsed.href
        : '';
}
```

**An allow-list of two schemes, never a block-list.** `javascript:` is the one
everybody thinks of; `data:` and `blob:` are the two they do not, and a
block-list is only ever as long as its author's imagination. Relative paths fall
out as refused, which is a real cost worth stating in `docs/limitations.md`
rather than papering over — resolving `/main.aspx?…` needs a base the control
cannot honestly choose, since the form's origin is not the app's is not the
record's.

`pcf-row-commands` renders no button at all for a value that does not pass, so
the refusal is visible as an absence rather than as a press that does nothing.

**The two schemes are also what works.** A press calling `openUrl` with an
`https` URL opened a new tab on the account form; with a `mailto:` URL it
opened nothing at all and still returned `undefined` (`pcf-code-editor` 1.5.9
probe, 2026-10-09). A control that shows `mailto:` links should show them as
text rather than as a link that silently does nothing.

### The dialogs, and the cancel that arrives as a resolve

`openConfirmDialog` resolves with `{ confirmed: boolean }`. **A cancel is a
resolve.** The promise settling means the dialog closed, not that the user
agreed, and there are two one-line ways to get this wrong:

```ts
// Deletes the record the user just declined to delete.
void confirm.call(nav, strings).then(() => remove(id));

// Shows an error for something the user did on purpose.
void confirm.call(nav, strings).then(() => remove(id)).catch(() => showError());
```

The correct shape reads `confirmed`, and treats a cancel as *nothing happened* —
no error, no output written, no telemetry event:

```ts
void confirm.call(nav, strings).then((response) => {
    if (!response?.confirmed) {
        return undefined;      // the user said no; that is not a failure
    }

    return remove(id);
});
```

The strings are `{ title?, subtitle?, text, confirmButtonLabel?,
cancelButtonLabel? }` — only `text` is required, and all of them belong in the
`.resx` like everything else the user reads.

`openErrorDialog(options)` takes `{ message?, details?, errorCode? }` and **you
must set either `errorCode` or `message`.** Setting `errorCode` alone makes the
platform look the message up itself.

**The dialog shows `message` and nothing else.** Measured on a model-driven
form, 2026-10-16 (`pcf-row-commands` 0.4.0, its SPEC.md W4): *Show Details*
reveals an error code (`0x0` when you gave none), a session id, an activity id
and the time; **`details` goes only into the text file *Download Log File*
saves** — which is what Learn's `openErrorDialog` page says, and what the name
"details" hides. Row Commands passed the server's reason as `details` from
0.1.0 to 0.3.3, and every refused delete said only *could not be deleted* to
the person who pressed it. So:

- **Put the reason on the message**: your sentence, then the server's words.
  A line break collapses to a space in the dialog, so join several on one line
  (a selection's first three, say) and leave the rest to `details`.
- **Shorten the server's words first.** A refused Web API write rejects with a
  1.5–3.6 KB message: *Error identified in Payload … InnerException :
  Microsoft.OData.ODataException: <the useful sentence> ---> <the stack>*. Take
  what follows *InnerException :*, drop the exception's type name, the `--->`
  chain and everything after the first line, and cap it; a message with no
  *InnerException* (the platform's own refusals — *Entity 'systemuser' With Id
  = … Does Not Exist*) is already short and is shown whole. `pcf-row-commands`'
  `readableReason` (in `action.ts`) is that rule.
- **`details` still earns its place** — the whole of every reason, for whoever
  downloads the log for support.

Testing it: an assertion that the dialog does not say `[object Object]` is
worthless if it reads only your half of `message`. Assert that the server's
sentence is **in `message`** — the half a person sees — and that `details`
holds the full text. A mutation that drops the reason from the message must
fail the suite (Row Commands': five assertions). The same class of mistake as
the `img.src` one in [Testing it](#testing-it).

### Confirm, then destroy

Anything irreversible — a delete, a bulk write, a state change nobody can undo —
needs a confirmation, and there are two shapes with a clean rule between them:

- **`openConfirmDialog`**, when the host has it. It is modal, it is the
  platform's own furniture, and it looks like every other confirmation in the
  app. Use it for anything that destroys data.
- **An inline two-step confirm**, where the control arms itself on the first
  press and acts on the second. `pcf-action-button` is the reference
  implementation: a 4-second self-revert, Escape cancels and announces, blur
  cancels silently because the user is already elsewhere, and the armed state is
  a colour change as well as a label change. See
  [Timers and teardown](rendering-and-hosts.md#timers-and-teardown) — an armed confirmation holds a
  real timer and `destroy` owes it.

**Do not substitute the second for the first on a host that lacks the dialog.**
It is tempting, and `pcf-row-commands` considered it: canvas has no
`openConfirmDialog`, so why not confirm inline and delete anyway? Because canvas
has no `context.webAPI` either — there is nothing behind the confirmation. When
a host cannot do the destructive half, the answer is to not offer the command,
not to build a nicer way of failing.

**The exception, and the test that separates the two cases: is the action itself
host-independent?** The rule above is about a control whose *doing* is missing on
the same host as its *asking*. Where the action works everywhere — raising an
event, writing an output, changing something the control owns — an inline
fallback degrades the asking and nothing else, and refusing to offer the button
would remove a working feature to make a point.

`pcf-form-action-button` is that case: its action is `context.events.onAction()`,
which no host withholds. It prefers `openConfirmDialog` and falls back to
`pcf-action-button`'s inline two-step, and its `index.ts` says so at the call
site — because a reviewer holding this file will otherwise flag it, correctly.

Three rules that hold either way:

1. **Default to off.** A destructive command is opt-in — `showDelete`, not
   `hideDelete`. This is the one place the `showX` naming is correct, because
   the platform's `false` is already the answer you want; see [A `TwoOptions`
   input cannot default to on](properties.md#a-twooptions-input-cannot-default-to-on).
2. **Guard the handler, not only the button.** `button.disabled` stops a browser
   dispatching a click; it does not stop a test rig, and a control whose safety
   rests on the DOM refusing is one nothing can assert.
3. **Single-flight it.** One confirmation in the air at a time. The platform's
   dialog is modal so it cannot produce two, but a double press before the
   dialog paints can, and so can any rig.

### A destructive command over a selection

`pcf-row-commands` 0.2.0's **Delete selected**. What the single-record rules
(*Confirm, then destroy*, above) become when there are twelve records:

- **One confirmation, naming the count** — and a selection of one takes the
  single-record path with its own sentence, not "Delete 1 records?".
- **Sequential, with a Stop.** One request in flight: a Stop takes effect at the
  next record, a failure names one record, and a user's service-protection budget
  is spent at the pace of one. `$batch` is faster past a few dozen and is a
  multipart request nobody here has measured.
- **The runner never rejects.** Every failure is a row in its result, because
  what follows — refresh, report — is the same whichever records failed.
- **One refresh at the end**, not one per record; a refresh in flight drops the
  next.
- **Name the failures where they are read**: the first few, record by record
  with the server's shortened reason, on `openErrorDialog`'s `message` (the
  dialog shows nothing else — see above), all of them in `details` for the
  log; and **leave the failures selected** for a second try.
- **`shouldStop` reads `disposed`.** A form tab switch mid-run must stop the run
  at the record in flight; a suite reaches that by tearing the control down
  inside the first delete, not before the dialog answers.
- **The same gates as the row's command**: the maker's switch, a host that can
  confirm and delete, and a role that allows it.

### `deleteRecord`, beyond the N:N trap

`webAPI.deleteRecord(entityType, id)` resolves with a **`LookupValue`** —
`{ entityType, id, name }` for the record that is now gone — not with `void`.
Handy for naming it in a confirmation message without having remembered it.

Its other use, deleting an intersect row to break an N:N relationship, is a trap
with its own section: see [Lookup columns](lookups-and-fetchxml.md#lookup-columns).

Three things around a delete from a dataset control:

- **The rejection is a plain object**, `{ errorCode, message }`, not an `Error`.
  See [A platform rejection is not an `Error`](context-apis.md#a-platform-rejection-is-not-an-error).
- **Refresh afterwards.** The row leaves the *fetch*, not the call — a control
  that deletes and forgets `dataset.refresh()` leaves it on screen, and the next
  press deletes something already gone.
- **`.finally()` is not a `.catch()`.** `pcf-tag-list` through 0.2.x shipped
  `deleteRecord(...).finally(() => dataset.refresh())` with no catch, and the
  unhandled rejection took its first smoke run down with it.
  `try/catch/finally`, or `.then/.catch/.then`, and tell the user. 0.3.0's
  suite installs an `unhandledRejection` listener and fails on any, which turns
  a crash into an assertion that names the test.

The buttons a control draws reflect **the host's capabilities, not the user's
privileges**. A control can ask whether `deleteRecord` exists; it cannot ask
whether this user may delete this record. A user without the privilege sees the
button and gets the server's refusal — which is the one case where the error
dialog is the whole of the user experience, so make it say something.

## Events

A control can declare events in its manifest and raise them from code, and the
host binds a handler to each. It is the only channel a control has that is not a
property, and it is the one people assume is canvas-only. **It is not.**

| | Canvas | Model-driven |
| --- | --- | --- |
| How a maker binds one | Power Fx in the properties pane | `formContext.getControl(name).addEventHandler("<name>", fn)` in a form script |
| What the handler receives | nothing — a formula | the payload the control passed |
| Can the handler answer? | **No.** A formula cannot be handed a callback | **Yes.** Functions in the payload are called straight back into the control |

The summary table on Microsoft's manifest-schema index says the `event` element
is "Canvas apps"; **the element's own reference page says "Canvas and
model-driven apps"**, and there is a full tutorial binding one with
`addEventHandler`. Trust the element page. `pcf-action-button`'s manifest carried
the wrong reading for a release and its `SPEC.md` records the correction.

The feature is documented as **preview**. Design for it, and give a control that
depends on it a second channel — see [Two channels, and the double
fire](#two-channels-and-the-double-fire).

### `<event>` and `<common-event>` are two elements, and the tooling enforces it

Read out of `pcf-scripts@1.51.1` rather than out of the docs:

- `ManifestSchema.json`'s **`commonEventAttribs` accepts only `name`** — an enum
  of exactly `OnSelect` and `OnChange` — and `pfx-default-value`. No
  `display-name-key`, no `description-key`, so a common event contributes nothing
  to the hub's API reference.
- **`eventAttribs`**, the custom element, takes `name`, `display-name-key`,
  `description-key`, `pfx-default-value` and `hidden`. Only `name` is required by
  the schema, though the docs mark `display-name-key` required for canvas.
- `manifestSchemaValidator.js`'s `validateEventNodes` **rejects a custom
  `<event>` named `OnSelect` or `OnChange`**, case-insensitively: *"is a reserved
  system event name, use common-event instead"*.
- Every attribute bag is `additionalProperties: false` and
  `treatValidationErrorsAsWarnings` is `"off"`, so a misspelled attribute fails
  the build rather than being ignored. Good news: this surface tells you when you
  are wrong.
- Both are gated on the feature flag **`pcfAllowEvents`**, `"on"` in
  `pcf-scripts`' own `featureflags.json`. A future version shipping it off stops
  the manifest building, and the message says so.

**Which to declare is decided by the host, not by taste:**

- **Canvas** → `<common-event name="OnSelect" />`. It is the property a maker
  already looks for on a button, and a custom `OnClick` beside it would be a
  second name for the same gesture.
- **Model-driven** → a **custom** `<event name="onAction" …/>`. `addEventHandler`
  binds by the event's own name, so only a name the manifest chooses is a name a
  form script can reach — and `OnSelect` is exactly the name it may not have.

`pcf-action-button` (canvas) and `pcf-form-action-button` (model-driven) are the
two exemplars, and they are the same control twice for this reason.

### `refreshTypes` emits nothing for an event

`manifestTypesGenerator.js` reads only `type-group`, `property` and `data-set`,
so `ManifestTypes.d.ts` carries no `events` member and **nothing checks a call
against the manifest**. It compiles anyway, because
`@types/powerapps-component-framework` declares
`Context<TInputs, TEvents = IEventBag>` with `events` **non-optional** and
`IEventBag` as `Record<string, (params?: unknown) => void>`.

So `context.events.onAction()` type-checks whether or not the manifest declares
it, and would type-check just as happily spelled `onActoin`. Neither the types
nor the manifest is evidence that the platform binds a callable to that name at
runtime.

**Write the guard against the type rather than with it.** Declare your own
interface with the member optional, and the feature detect survives a reviewer
who notices the platform types say it cannot be missing:

```ts
interface MyEvents {
    onAction?: (payload: MyPayload) => void;
}

const events = (context as ComponentFramework.Context<IInputs, MyEvents>).events;

if (typeof events?.onAction === 'function') {
    try {
        events.onAction(payload);   // as a member: a saved reference loses `this`
    } catch (error) {
        console.error('the handler threw', error);
    }
}
```

The `try` is not optional either. The handler is somebody else's Power Fx or
somebody else's web resource, and the platform does not promise to catch it.

### The model-driven payload can carry functions

This is the capability canvas does not have, and it is what makes an event worth
more than an output property on a form. Microsoft's own tutorial passes
`{ message, preventDefault }` and calls `params.preventDefault()` from the
handler; the events overview shows the same shape under the name
`callBackFunction`. The names are yours — the platform passes the object through
untouched.

Three rules for anything callable in a payload, each of which is a real bug
otherwise:

1. **Latch it to the press it came from.** An async handler closes over its
   payload by construction, and a second press while the first is still running
   is one ordinary click. Capture a monotonic token at raise time and check it in
   every callback; a stale one does nothing.
2. **Kill it in `destroy()`.** The callbacks write to the control's DOM, and a
   handler holding one across a form navigation would reach a detached tree. A
   `destroyed` flag checked in every callback is the whole fix.
3. **Say which ones are synchronous-only.** A `preventDefault` that suppresses
   the outputs cannot work from a `.then()`, because the outputs are written the
   moment the handler returns. Ignore a late call with a console warning rather
   than half-applying it — and document it, because the Client API says the same
   of its own change events, which "should not" be asynchronous.

`pcf-form-action-button` ships `preventDefault()`, `setBusy(message?)` and
`setResult({ ok, message? })`, and asserts all three rules.

### Two channels, and the double fire

An output property is the *other* way a press reaches a maker, and on
model-driven there are three routes in total:

| # | Channel | Maker side | Available |
| --- | --- | --- | --- |
| 1 | the event | Power Fx (canvas) / `addEventHandler` (model-driven) | preview |
| 2 | output properties | `OnChange` (canvas) / `control.addOnOutputChange(fn)` + `control.getOutputs()` (model-driven) | stable |
| 3 | a bound column write | the column's own `OnChange`, a business rule, a real-time workflow | stable, and reaches non-JavaScript consumers |

Ship more than one. A control cannot detect that a preview API stopped being
delivered, and channel 2 costs two output properties.

**Channel 1 was not delivered on a subgrid, measured 2026-10-08**
(`pcf-row-commands` 0.2.5 probe, P1, the first time anyone in this catalogue
measured channel 1 at all). On a form's subgrid carrying a dataset control,
`Xrm.Page.getControl('<subgrid>')` is a `customsubgrid:<Namespace>.<Control>`
with `addEventHandler`; `addEventHandler('onRowCommand', fn)` bound without
error; the control's `context.events.onRowCommand` was a function and
returned — **and `fn` never ran**, twice, the second time after a refresh.
The platform files the handler under `<the subgrid's uniqueid>.onRowCommand`
and runs custom handlers filtered by that key *and* a context key from the
raiser's token, so the dataset control may raise under another. A handler
added at form OnLoad (a throwaway web resource) was not heard either, but the
built-in browser never showed that script running, so that half is open.
**Channel 2 worked on the same subgrid** (P7): `addOnOutputChange` fired on
every press and `getOutputs()` carried `<subgrid>.invokedCommand` and
`.invokeCount`. **On a main grid** the bag still publishes the event (P2) but
there is no form and no script to bind it — gate a press-only button on
`mode.contextInfo.entityId`, never on the bag. So for a dataset control, lead
the docs with channel 2; `pcf-row-commands` 0.3.0 raises the event and
documents it as not delivered.

**On a field control, channel 1 is delivered, measured 2026-10-28**
(`pcf-form-action-button` 0.1.9 probe E1–E3, and the 0.2.x walkthrough from a
real On Load web resource). `getControl("<column>").addEventHandler("onAction",
fn)` — from the console's `Xrm.Page` and from an On Load library both — ran
`fn` on every press with the payload whole: its data and **all three
functions**, which then worked (`preventDefault()` kept the outputs where they
were; `setBusy`/`setResult` drove the button). The subgrid's failure is the
dataset host's, not the feature's.

**And channel 2 is read off the control, by long keys** — the same probe:

- In an `addOnOutputChange(fn)` handler, `executionContext.getEventSource()` is
  the **column** (it has `getValue`), not the control — it has no `getOutputs`.
  Read `formContext.getControl("<column>").getOutputs()`.
- **Each output is keyed `"<column>.fieldControl.<output>"`**, holding
  `{ type, value }` — `outputs.pressCount` is `undefined`. A subgrid's are
  `"<subgrid>.<output>"` (above). Print `Object.keys(getOutputs())` once
  before documenting a read.
- **Two `notifyOutputChanged()` calls ~0.3 s apart arrived as one
  `OnOutputChange`** carrying the final values; two presses seconds apart were
  two. A script reads the outputs it is given, never a count of events.

`pcf-form-action-button`'s 0.1.0 docs had channel 2's snippet wrong on both
counts for seven weeks; a snippet nobody pasted into a form is a claim.

**The cost is a maker who wires both getting the action twice**, and that has to
be stated in `docs/`. It is a real hazard and it is still the right trade.

**Order the two deliberately, because the two orders buy different things:**

- **Outputs first, then the event** — a handler that throws cannot take the
  outputs down with it. Right when the handler has no say in the outcome.
  `pcf-action-button` does this.
- **Event first, then the outputs** — the handler can *veto* the outputs, which
  it cannot do once they are written. Right when the payload offers a
  `preventDefault`. Put the raise in a `try` and write the outputs anyway on a
  throw: a throw is not a veto. `pcf-form-action-button` does this.

Either way, say which and why in a comment. The two files otherwise look like one
is a copy of the other with a bug in it.

### A counter, not just a state

**A change event fires on a *change*, not on a write.** Canvas `OnChange`,
model-driven `OnOutputChange` and a column's own `OnChange` are all in that
family. So two consecutive presses both writing `lastAction: "confirm"` are one
event and one silence, and the maker sees a button that works once.

Every control with outputs that can repeat needs a number that moves:

```ts
this.pressCount += 1;          // increments only on a press that commits
this.lastAction = action;
this.notifyOutputChanged();
```

Same family as `pcf-star-rating`'s `?? undefined` clear: invisible on the host
you test first, reliable in the field. `pcf-row-commands` needs it too, for the
same reason, on `invokeCount`.

If channel 3 is in play, put the count **in the written value** —
`` `${action}|${count}` `` — for exactly the same reason. A column set to the
same string twice fires no `OnChange` either.

### `pfx-default-value` is a Power Fx expression, not a value

Canvas only, and it takes precedence over `default-value` where a host reads it —
so the two have to be kept in step by hand.

The attribute has to be delimited with `'` so the formula can keep its own `"`:

```xml
pfx-default-value='"Submit"'
```

Written `pfx-default-value="Submit"` the formula is the *identifier* `Submit`,
which resolves to nothing and leaves the property empty. It also accepts real
expressions — `'SubmitForm(%MyFormName.ID%)'`, `%EnumName.RESERVED%.EnumValue` —
which is why it exists at all.

**Do not put one on an event.** A default formula on `OnSelect` is the control
deciding what a maker's button does. And on a model-driven control it is an
attribute nothing on the supported host reads, since there is no formula bar on a
form.

### Testing it

`_template/dev/host.js` builds the bag from an `events` option, and it takes two
shapes:

- an **array of names**, each bound to a logger — all a canvas-shaped event
  needs, since there is no Power Fx to run;
- an **object of `name → function`**, which binds the caller's handler as well,
  so a suite can call `preventDefault()` / `setBusy()` back into the control.
  A rig that could only log can never exercise the half of the contract the
  control implements.

`events: null` removes the bag entirely, and **that is the case worth having**:
the platform types make `context.events` non-optional, so nothing will ever force
a control to guard it, and a manifest declaration is a claim about the schema
rather than about the runtime. A control that still works with no bag passes both
ways; one that does not fails on the host it was never run on.
