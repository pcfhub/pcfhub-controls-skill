# The device

`context.device` — the camera, the barcode scanner, the microphone, location
and the file picker: which host has which method, the three shapes a refusal
arrives in, a run of scans, and how to test all of it without a device. Files
themselves — reading, writing and generating them — are in
[files-and-device.md](files-and-device.md).

- [Device APIs](#device-apis)
  - [Availability is per method and per host, and narrower than it reads](#availability-is-per-method-and-per-host-and-narrower-than-it-reads)
  - [Absence and refusal are different, and `required="false"` is about absence](#absence-and-refusal-are-different-and-requiredfalse-is-about-absence)
  - [A device rejection arrives in three shapes and only one is an `Error`](#a-device-rejection-arrives-in-three-shapes-and-only-one-is-an-error)
  - [Three traps in the types](#three-traps-in-the-types)
  - [`captureImage` resolves with one file; `pickFile` resolves with many](#captureimage-resolves-with-one-file-pickfile-resolves-with-many)
  - [Scanning many: one call, one code](#scanning-many-one-call-one-code)
  - [What a device API costs the demo, and the maker](#what-a-device-api-costs-the-demo-and-the-maker)
  - [Testing it](#testing-it)

## Device APIs

`context.device` is six methods onto native capability, and the reference
describes them in a sentence each. Everything expensive about them is in what
happens when they are not there — which is most of the time, on most hosts.

```ts
context.device.captureAudio()                  // Promise<FileObject>
context.device.captureImage(options?)          // Promise<FileObject>       ONE
context.device.captureVideo()                  // Promise<FileObject>
context.device.getBarcodeValue()               // Promise<string>
context.device.getCurrentPosition()            // Promise<Position>
context.device.pickFile(options?)              // Promise<FileObject[]>     MANY
```

### Availability is per method and per host, and narrower than it reads

| | Model-driven, web | Model-driven, mobile | Canvas | Power Pages | `npm start` | Hub demo |
| --- | --- | --- | --- | --- | --- | --- |
| `pickFile` | yes | yes | yes | **no** | rejects | rejects |
| `captureImage` / `Audio` / `Video` | yes | yes | yes | **no** | rejects | rejects |
| `getBarcodeValue` | — | yes | yes | **no** | rejects | rejects |
| `getCurrentPosition` | **no** | yes | yes | **no** | rejects | rejects |

Two rows deserve reading twice.

**`getCurrentPosition` is documented for canvas apps and the model-driven
*mobile* client.** A model-driven form open in a browser has no geolocation at
all — which is the host every one of these controls is developed on, and the
first one anybody tries. It is not a permission problem and not an intermittent
failure: the API is absent, there is nothing to grant, and a control that
reports it as an error sends the user looking for a setting that does not exist.

**Power Pages supports no `Device.*` API whatsoever**, nor `Utility`, and its
documentation states that `<uses-feature>` **must not be set to `true`** there.
That single line settles the `required` attribute for any control meant to run
on Pages.

Do not paper over the gaps with the browser's own APIs. Falling back to
`navigator.geolocation` works in exactly the hosts where the platform declined
to offer location, and it prompts the user for a permission the app never
declared, from inside a component. If the platform said no, the honest control
says no too and names the host that would work.

### Absence and refusal are different, and `required="false"` is about absence

`required="false"` buys the right for the platform to **omit the member**. That
is a different state from a call that rejects, and it needs a different sentence
to the user — "not available on this client" is actionable somewhere else,
"that did not work" is not.

So feature-detect against the type system rather than with it:

```ts
if (typeof context.device?.getCurrentPosition !== 'function') {
    // Absent. Say which hosts do have it.
    return;
}
```

Both halves of that guard earn their place. `context.device` is typed as always
present and Power Pages removes the whole bag; the method is typed as always
present and `required="false"` removes just it. Neither absence is visible to
`tsc`.

### A device rejection arrives in three shapes and only one is an `Error`

This is the part that costs an afternoon, and it is documented in the Client API
reference for `getCurrentPosition`:

| Shape | When | What breaks |
| --- | --- | --- |
| `{ code, message }` | the user or the client refused | `String(error)` renders `[object Object]` |
| **`null`** | an older mobile client, or a device with no geolocation capability — the reference says so outright | `error.message` **throws inside the catch** |
| `Error` | a browser tab with no native bridge | nothing |

The middle row is the dangerous one. A handler beginning `error.message` throws
while handling a failure, so the failure handler fails: no message is shown, the
promise rejects into nothing, and the button sits on its busy label forever. A
control tested against one refusal is untested against the other two.

Note `code`, where a `webAPI` rejection carries `errorCode`. Two platform APIs,
two names for the same idea, and one error reader that has to know both — see
[A webAPI rejection is not an `Error`](context-apis.md#a-platform-rejection-is-not-an-error) for
the reader, which handles all four shapes.

### Three traps in the types

**`Position.timestamp` is typed `Date` and is a number.** The type definitions
declare `timestamp: Date`; the `Position` reference page says, of the same
member, "represented as DOMTimeStamp". The platform sends the number, so
`position.timestamp.toISOString()` compiles and throws, and nothing in the types
distinguishes the two. Prefer a timestamp the platform agrees with itself about
— the record's own `modifiedon` — or coerce defensively and say why.

**`Position['coords']` declares every member non-optional**, including
`altitude`, `heading`, `speed` and `altitudeAccuracy`, which are routinely
`null` on a device standing still. Only `latitude`, `longitude` and `accuracy`
are dependable.

**`CaptureImageOptions` has five non-optional fields** — `allowEdit`,
`height`, `preferFrontCamera`, `quality`, `width` — so
`captureImage({ quality: 80 })` does not compile. It is all five or no argument.

### `captureImage` resolves with one file; `pickFile` resolves with many

`Promise<FileObject>` against `Promise<FileObject[]>`. The `[0]` that was right
on the picker reads `undefined` on the camera, and `undefined.fileContent`
throws seconds after the camera UI closed — as far from the mistake as a stack
trace can get.

And `FileObject.fileSize` is in **KB**, which is the same trap
[Files and binary content](files-and-device.md#files-and-binary-content) covers for `pickFile`.

### Scanning many: one call, one code

`getBarcodeValue()` takes no options and opens the device's scanner for **one**
code; Learn documents nothing more. The canvas Barcode reader has a *Scan
multiple* mode; the code-component API has none. So "scan many" is a loop of
calls, and `pcf-barcode-scanner` 0.3.0 is the catalogue's one. What it settled:

- **The end of a run is a call that brings no code back, and its shape is
  unmeasured.** No phone has run a probe, so nobody here knows whether a
  scanner closed without a code rejects or resolves with `''`. Take both as
  the end. Also unmeasured: whether the device reopens the scanner straight
  after a code without another tap. A loop written for both answers degrades
  to one code per press if it does not.
- **The first call's refusal is a different sentence.** Refused before any
  code came back means there is no scanner here, so say "type it instead",
  not "run over".
- **A host can answer without a person.** The hub's demo resolves a preset's
  `state.device.barcode` at once, on every call, forever. A loop that only
  ends on a closed scanner never ends there. Skip a code already in the list
  and say so, end the run on **two repeats in a row**, and yield to the page
  between calls (a zero-delay timer) so it draws.
- **Write each code as it arrives.** A run cut short (the user leaves the
  form, the app is backgrounded) keeps what it had. One text column, one code
  a line, works on a single-line column too. Measured through the Web API
  (`pcf-barcode-scanner` SPEC.md P4): `\n` and `\r\n` are stored as written,
  and a value one character past `MaxLength` is refused whole (400,
  `0x80044331`), so check the length **before** the write.
- **Take `MaxLength` from a column only.** A canvas app reports 100 for every
  text property, whatever it is bound to (*`attributes` is where canvas and
  model-driven actually diverge* in `bound-property.md`). Capping by it there
  stops every canvas run at 100 characters.
- **Keep the focus on Scan while the run works**: `aria-disabled`, not
  `disabled` (*A button that is working keeps focus* in `accessibility.md`).
  The scanner is a native screen over the app, and a keyboard or switch user
  should come back to the button they pressed.

### What a device API costs the demo, and the maker

Every `<uses-feature>` is an install-time permission prompt, so declare only
what is called — `npm run check` warns on a declared feature nothing uses.
Outside a real device the methods reject, so a demo shows the control's own
unavailable state unless a preset simulates an answer. Since pcfhub#60 (29 Sep
2026) a preset's `state.device` can carry `barcode` (a string, answered on
every call), `position`, or `files`, and the event log says the answer was
simulated. That makes the demo `mocked`, not `full`. Say which in
`demo.limitations`, and keep one preset without a device so the unavailable
state is still one click away.

### Testing it

The field rig models **four** device states, and the fourth is the one people
forget:

```js
mount({ position: 'no-bridge' })   // rejects with an Error — the default
mount({ position: 'denied' })      // rejects with { code, message }
mount({ position: 'unavailable' }) // rejects with null
mount({ position: 'absent' })      // the METHOD IS NOT THERE
mount({ device: false })           // the whole bag is not there — Power Pages
mount({ position: { latitude: 47.6062, longitude: -122.3321, accuracy: 20 } })
```

`captureImage` takes a `FileObject` or rejects; `pickFile` takes an array or
rejects. Both default to rejecting, because that is what every host this rig can
imitate actually does.

`getBarcodeValue` has three answers and an end:

```js
mount({ barcode: null })                       // rejects, every call — the default
mount({ barcode: 'SAME' })                     // that code on every call: the hub's demo
mount({ barcode: ['A', 'B'] })                 // one code per call, then…
mount({ barcode: ['A', 'B'], barcodeEnd: 'empty' }) // …'' instead of a rejection
```

The queue's place is kept **per array**, in a `WeakMap` in `host.js`: a control
keeps whichever context it was handed and `createContext` runs afresh per
render, so a cursor inside the context would start the run over on every pass.
Pass a fresh array for a fresh run. The harness's *Scanner answers* box does
that each time it is edited.

Assert that each of the refusals produces a **different** message and that none
leaves an unhandled rejection. `pcf-geo-stamp` does this in six assertions and
found a real bug doing it.
