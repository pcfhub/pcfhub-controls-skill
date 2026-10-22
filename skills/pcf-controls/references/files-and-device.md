# Files, and the device

Reading, writing and generating files — three routes to Dataverse, since PCF
cannot *bind* a File or Image column but can reach one — and the device APIs,
which are available per method and per host.

- [Files and binary content](#files-and-binary-content)
  - [Base64 in a text column](#base64-in-a-text-column)
  - [A File or Image column, through the record](#a-file-or-image-column-through-the-record)
  - [Reading the file](#reading-the-file)
  - [Writing a file to Dataverse as a Note](#writing-a-file-to-dataverse-as-a-note)
  - [Handing the user a file the control generated](#handing-the-user-a-file-the-control-generated)
  - [Putting text on the clipboard](#putting-text-on-the-clipboard)
  - [An icon that has to follow the theme must be inline SVG](#an-icon-that-has-to-follow-the-theme-must-be-inline-svg)
- [Device APIs](#device-apis)
  - [Availability is per method and per host, and narrower than it reads](#availability-is-per-method-and-per-host-and-narrower-than-it-reads)
  - [Absence and refusal are different, and `required="false"` is about absence](#absence-and-refusal-are-different-and-requiredfalse-is-about-absence)
  - [A device rejection arrives in three shapes and only one is an `Error`](#a-device-rejection-arrives-in-three-shapes-and-only-one-is-an-error)
  - [Three traps in the types](#three-traps-in-the-types)
  - [`captureImage` resolves with one file; `pickFile` resolves with many](#captureimage-resolves-with-one-file-pickfile-resolves-with-many)
  - [What a device API costs the demo, and the maker](#what-a-device-api-costs-the-demo-and-the-maker)
  - [Testing it](#testing-it)

## Files and binary content

**PCF cannot bind a File or an Image column — but a control can reach one.**
Both halves matter, and this file said only the first until 2026-10-02:

- The manifest schema reference's `type` element carries the note *"At this time
  File columns are not supported"*, and there is no `of-type="File"` in the
  enumeration at all.
- `ImageObject` is documented as **canvas apps** only.
- `context.webAPI` has five methods — `createRecord`, `retrieveRecord`,
  `retrieveMultipleRecords`, `updateRecord`, `deleteRecord` — and none can PATCH
  a file attribute, which is what writing to a File column requires.
- **A same-origin `fetch` can.** The Web API serves a File or Image column at
  its own URL under the record — `GET`, `PATCH` and `DELETE` — and a
  model-driven form is on that origin. That is a route, measured end to end on
  a form, not a workaround.

So there are three routes, and the data model picks one:

| Route | Hosts | Ceiling | Exemplar |
| --- | --- | --- | --- |
| **Base64 in a bound text column** | canvas and model-driven | about 768 KB | `pcf-file-drop` |
| **A Note on the record** (`annotation`, through `webAPI.createRecord`) | model-driven | `organization.maxuploadfilesize` | `pcf-attachment-list` |
| **A File or Image column, through the record** | model-driven only | the column's `MaxSizeInKB`; 128 MB per single `PATCH` | `pcf-file-preview` |

If the table already has a File column, the third route is the answer, rather
than a text column added beside it to hold a copy.

### Base64 in a text column

The route Microsoft's own ImageUploadControl sample takes, and the only one on
canvas: **base64 in a bound text column**.

```xml
<property name="value" of-type="Multiple" usage="bound" required="true" />
```

Store a full **data URL** — `data:image/png;base64,…` — rather than bare
base64. It costs the prefix and buys a value a canvas `Image` control binds to
directly, with no formula in between. `pcf-file-drop` does this.

**The ceiling is real and worth stating in `docs/`.** `Multiple` holds
1,048,576 characters, base64 costs about a third on top, so roughly **768 KB**
is the largest file that fits — less if the maker set the column's own maximum
length lower, which a control cannot see on canvas: the `attributes` there
describe the property, not a column, and their `MaxLength` was `100` on every
type read (a `Multiple` was not among them — *`attributes` is where canvas and
model-driven actually diverge* in `references/properties.md`). **Never size a
file against `attributes.MaxLength` without checking a column is behind it.**
Enforce a limit in the control and refuse up front: the
platform's own rejection arrives on save, after the file has been read, and says
nothing about size.

A data URL also carries the MIME type and **not** the name. If the name matters,
bind a second `SingleLine.Text` column for it rather than inventing an envelope
format — an output-only property is written to whatever the maker wired it to
and read back from nothing, so it does not survive a reload. (That wiring is a
canvas formula: on a model-driven form, binding a column to an output breaks
the classic designer's save — see *An output that reports a verdict* in `properties.md`.)

### A File or Image column, through the record

`pcf-file-preview` is the exemplar, and its `SPEC.md` holds the probe. **Measured
on the Accounts form on 2026-10-02**, Chrome 154. The control's bound property
is placed on **any** column — the 17-type `anyColumn` group `pcf-audit-history`
uses — and never reads or writes it; the File or Image column is named in a
text property and resolved from
`EntityDefinitions(LogicalName='<table>')/Attributes?$select=LogicalName,AttributeType,AttributeTypeName`
(`AttributeTypeName/Value` is `FileType` or `ImageType`). The record is
`mode.contextInfo` — *The current record's identity* in `context-apis.md`.
Every request is a same-origin `fetch` from `page.getClientUrl()`, which is
also why the route is model-driven only: canvas has no client URL and no
record to address.

| | Request |
| --- | --- |
| Read | `GET <set>(<id>)/<column>/$value` — `?size=full` for an Image column's full copy |
| Replace | `PATCH <set>(<id>)/<column>`, body `application/octet-stream`, the name in an `x-ms-file-name` **header** when it is ASCII and a **query parameter** (`?x-ms-file-name=<encoded>`) when it is not |
| Remove | `DELETE <set>(<id>)/<column>` |
| Limits | `…/Attributes(LogicalName='<column>')/Microsoft.Dynamics.CRM.FileAttributeMetadata?$select=MaxSizeInKB` (`ImageAttributeMetadata`, plus `CanStoreFullImage`) |
| Blocked types | `organizations?$select=blockedattachments` |

What the form answered, each of which differs from what Learn implies or
leaves unsaid:

- **The download is `application/octet-stream`, whatever the file.** The type
  is in a `mimetype` header; re-type the blob from it before drawing it. **An
  untyped blob in an `<iframe>` is not drawn — the browser downloads it, under
  the blob's UUID, every time the frame is drawn.** An `<img>` sniffs and draws
  either way. Typed, a PDF **draws inline** in an `<iframe>`, `<object>` or
  `<embed>` on a model-driven form, with no CSP refusal.
- **The size is `x-ms-file-size`**, not `Content-Length`, which one response
  carried and another did not. Read the headers, decide, and only then read
  the body: a file over the preview limit costs one abandoned request.
- **A name outside ASCII must come from `Content-Disposition`.** For
  `Übersicht — 2026.pdf`, `x-ms-file-name` arrived as `ÃÅbersicht Ã¢â¬â 2026.pdf`
  — UTF-8 read as Windows-1252, encoded again, handed over as Latin-1 — while
  the same response's `Content-Disposition` carried
  `inline; filename="=?utf-8?B?w5xiZXJzaWNodCDigJQgMjAyNi5wZGY=?="`, an RFC 2047
  encoded word that decodes exactly. An ASCII name comes bare
  (`filename=contract.pdf`). Going up, the query parameter stores a non-ASCII
  name correctly.
- **Empty is two different answers.** An empty File column is **404**, JSON,
  `0x80040217` *No file attachment found for attribute*; an empty Image column
  is **204** to both the full and the plain request. Both are "no file yet",
  not an error.
- **`?size=full` answers the full copy** (with `x-ms-image-pixel-width`,
  `-height`, `x-ms-color-depth-bits`); the plain request is the 144-pixel
  thumbnail. Ask for the full copy when `CanStoreFullImage` is on, and fall
  back to the thumbnail on a 204.
- **The refusals:** a blocked type is **400 `0x80043e09`** *The attachment is
  either not a valid type or is too large*; over `MaxSizeInKB` is **400
  `0x80044a02`** *Attachment file size is too big.* Refuse both before sending
  — the server's answers arrive after the whole file has gone up, and the
  first does not say which of its two reasons it means.
- **After a write the form knows nothing.** It does not go dirty,
  `updateView` does not fire, and **the platform's own File control on the
  same form keeps showing the old file** until the page is refreshed. A
  re-`GET` is the control's proof; the stale neighbour is a `docs/limitations.md`
  line, because no PCF call refreshes another control.
- **Saving a new record keeps the instance**, hands it the new `entityId`,
  and the load follows — key the load on client URL, table, id and column.
  Opening another record from a view remounts every control instead.
- **`utils.getEntityMetadata` carries neither `MaxSizeInKB` nor
  `CanStoreFullImage`** for these columns, and reports `IsValidForUpdate:
  false` on a File column that accepts a `PATCH` — do not gate on it. The
  casts are the reads.
- **`navigation.openFile` hands the bytes over both ways**: `openMode` 1 opened
  the PDF in a new browser tab, 2 saved it under its name. Base64, size in KB,
  as in *Handing the user a file* below.

Three things no form answers, decided rather than measured:

- **The hub's demo origin refuses `blob:` images.** Its content-security
  policy is `img-src 'self' https://cdn.pcfhub.dev data:`, so an object URL in
  an `<img>` is a broken image there — and only there: the local dev server
  sends no CSP, so a stand-in-parent run passes. Keep the blob URL (a form
  draws it) and, on the image's `error`, draw the same bytes once as a
  `data:` URL. `pcf-file-preview` 0.1.1; found on the live hub after 0.1.0
  shipped.
- **The hub's demo frame is a sandboxed document, and Chrome will not run its
  PDF viewer in one** — the frame shows the blocked-page icon. Read
  `globalThis.origin === 'null'` (an opaque origin) and show the file's card
  with Open and Download instead of a frame that cannot draw.
- **A phone's WebView may have no PDF viewer at all** (Android's has none). On
  `context.client.getClient() === 'Mobile'` the PDF gets the same card; images
  still draw inline. Unverified — say so in `docs/`.
- **The maker portal cannot change `MaxSizeInKB` after the column exists**
  (Learn: the API can). A test bed that needs two limits needs two columns.

The field rig answers this route from `fixture.files` (keyed
`'<table>|<id>|<column>'`), with `filesStatus`, `fileWrite` and
`blockedAttachments` switches; the hub's harness answers it from
`dataverse.files` — *The demo block* in `pcfhub-publish/references/hub-demo.md`.

### Reading the file

Three ways in, and a control that offers all three degrades on its own:

```ts
context.device.pickFile({ accept: 'image', allowMultipleFiles: false, maximumAllowedFileSize: kb * 1024 })
```

- **`context.device.pickFile()` first**, because on a phone it is the camera
  roll rather than a file dialog. It returns `Promise<FileObject[]>`.
- **A hidden `<input type="file">`** when that rejects — which it does on every
  host that is not a real device origin: `npm start`, the hub's demo sandbox, a
  canvas app in a browser tab.
- **A drop target**, which works wherever the other two do.

Because the fallback exists, declare the feature **`required="false"`**:

```xml
<feature-usage>
  <uses-feature name="Device.pickFile" required="false" />
</feature-usage>
```

`required="true"` is right only when there is no non-device way to do the thing
at all — `pcf-barcode-scanner` and `Device.getBarcodeValue`. Declaring a feature
required that the control can work without asks the maker for a permission for
nothing, and turns an ordinary fallback into a visible failure.

Three details that each cost an afternoon:

- **`FileObject.fileSize` is in KB**, not bytes. It is the one field that reads
  like it means something else, and a size check written against bytes lets a
  file a thousand times too large straight through. A browser `File.size` *is*
  in bytes, so a control handling both paths converts one of them.
- **`PickFileOptions.accept` is not the HTML `accept`.** It takes exactly
  `"audio"`, `"video"` or `"image"`. `image/png` narrows to `image` for that
  call and `.pdf` narrows to nothing; keep the full rule on the file input and
  re-check whatever comes back.
- **`dragover` must call `preventDefault()`** or `drop` never fires. It fails
  silently — the cursor shows "no entry", the handler is never called, nothing
  reaches the console — and it is the most common reason a drop target does
  nothing.

`destroy()` owes an `abort()` on a `FileReader` still in flight. On a form the
user navigates between records, that is every navigation: the callback fires
against a container the platform has already thrown away.

### Writing a file to Dataverse as a Note

The third route, and the one every community attachment uploader takes: the
file is not stored in a column at all, it is a **Note** (`annotation`) row on
the record, created through `webAPI.createRecord`. `pcf-attachment-list` 0.2.0
is the exemplar. **Measured on the Accounts form's Notes subgrid on
2026-09-14**: the create succeeds from `context.webAPI` and the row is on the
subgrid after the control's own `refresh()`; the navigation property read back
was `objectid_account`; `organization.maxuploadfilesize` was readable by an
ordinary user — 8,314,880 on that environment, not the 5 MB default, which is
the argument for reading it; a drop reaches the container inside the form
iframe; the `accept` rule refused a dropped file. Its `SPEC.md` has the
answers under *Measured* and what is still open (a phone's picker).

```ts
await context.webAPI.createRecord('annotation', {
    filename: file.name,
    mimetype: file.type || 'application/octet-stream',
    isdocument: true,
    documentbody: base64,                                   // bare — NO data: prefix
    [`${navigationProperty}@odata.bind`]: `/${entitySet}(${parentId})`,
});
context.parameters.records.refresh();                       // the row is not on the view until you ask
```

- **Bare base64, the opposite of the text-column route.** `documentbody` holds
  base64 and nothing else; the `data:image/png;base64,` prefix that a canvas
  `Image` control wants on a text column is a corrupt file here. Strip it off a
  `FileReader.readAsDataURL` result at the first comma. `filesize` is the
  server's to compute — do not send it.
- **The bind names are read, not derived, and it costs no feature.** The key is
  the relationship's *navigation property* (`objectid_account`,
  `objectid_cll_account` — `objectid` is polymorphic, one relationship per table
  that has Notes), and the value's set name is the parent's *entity set*
  (`accounts`; `category` → `categories`; `cll_account` → `cll_accounts`).
  Neither follows from a logical name by rule, so both come from a same-origin
  fetch of `EntityDefinitions` addressed through `page.getClientUrl()`:
  `…/EntityDefinitions(LogicalName='annotation')/ManyToOneRelationships?$select=ReferencedEntity,ReferencingEntityNavigationPropertyName`
  filtered by the parent's table, and
  `…/EntityDefinitions(LogicalName='<parent>')?$select=EntitySetName`. That is
  the same read `pcf-data-table` makes for a lookup write, and it needs no
  `Utility` prompt — `utils.getEntityMetadata` would have been a second
  install-time permission for one string. Cache per table; do not cache a
  failure.
- **The parent is `mode.contextInfo`** — `{ entityTypeName, entityId,
  entityRecordName }`, GUID unbraced, measured on a form subgrid; `null` on a
  main grid, where there is no record to attach to and therefore no upload.
  Strip braces and lower-case anyway: a dialog's GUID arrives the other way.
- **Refuse against the organisation's own ceiling, before the read.**
  `organization.maxuploadfilesize` (bytes, 5 MB by default) is the number
  Dataverse will enforce on the create, and it is one
  `retrieveMultipleRecords('organization', '?$select=maxuploadfilesize&$top=1')`
  away under the WebAPI feature the control already declares. A maker's
  `maxUploadSizeMb` carries **no `default-value`** — the platform already has
  the answer, and a default would override it on every install. A read that
  fails means *no client-side ceiling*, not 5 MB: an admin who raised the limit
  should not be refused by a control that could not find out. Blocked
  extensions stay the environment's: Dataverse refuses them on the create, and
  its message is the one to show.
- **One at a time, one refresh.** A base64 body is a third larger than the
  file and lives in memory until its create resolves; ten parallel creates
  against one record are ten refreshes of the subgrid. Drain a queue, collect
  the per-file problems, and announce them together at the end — a live
  region holds one string, and a failure announced mid-batch is replaced by
  the next file's progress before anybody hears it. Ask for the refresh once,
  and only if something was created.
- **Write to the columns you can resolve.** On `annotation` the logical names
  are the fallback; on a custom attachment table a role that is unmapped is a
  key not sent, because a column the table does not have fails the whole
  create. No file-name column resolvable means no upload.
- **Draw the button only where the host can perform the write** — an editable
  form (`mode.isControlDisabled` false), a parent record, `webAPI.createRecord`
  present — and decline a drop in words everywhere else.

**The picker is a file input, not `device.pickFile`, for this shape.** The
"`pickFile` first" rule above is right for one file into a column, where a
phone's camera roll is the point. For several files into Notes it is a second
install-time prompt for a picker whose `accept` is three words; a hidden
`<input type="file" multiple>` exists on every host with a DOM, takes the full
`accept` rule, and on a phone opens the same roll. Keep it hidden with the
attribute and `tabIndex = -1`, so the button is the only thing in the tab
order, and clear `input.value` after reading `files` or the same file cannot be
picked twice — `change` does not fire on an unchanged selection.

**The drop, done properly**, because each of these is a bug somebody shipped:

- **Prevent `dragover` and `drop` whether or not this host can upload.** Left to
  the browser, a file dropped on a code component navigates the frame to the
  file, and a model-driven form is an iframe the user then loses. Decline in
  words instead.
- **Read `dataTransfer.types` during the drag, not `files`.** The browser
  withholds the files until the drop; `types` is what says `Files` is coming,
  and it is how dragged text is told apart from a file.
- **Count `dragenter`/`dragleave` depth.** They fire for every child the cursor
  crosses, so a boolean flickers off while still over the list. A counter is
  the standard fix and the only one that works; reset it on `drop`.
- **Put the listeners on the container the platform hands over**, not on
  anything rendered — `render` empties the container every pass and a listener
  on a child goes with it. Take them in `init`, release them in `destroy`, and
  make them arrow properties so the same reference can be removed.
- **Apply the `accept` rule by hand.** The input narrows the picker; a drop
  bypasses the picker entirely, and a browser's own filter is a suggestion.
  Three token shapes: `.pdf` against the name, `image/*` against the family,
  `application/pdf` against the whole type. A token in none of those shapes
  matches nothing.

**Make the status visible.** `pcf-attachment-list` 0.1.x clipped its live
region to a pixel — an "sr-only" status, which read as tidy and meant a sighted
user who pressed Download on a refused row saw nothing happen at all. An
upload has progress and per-file refusals to report; the region is a line under
the list, empty and zero-height most of the time, never `display: none` between
announcements.

The dataset rig models the whole route: `createRecord` holds the row until the
next fetch (so a forgotten `refresh()` is a list one row short), resolves
`@odata.bind` keys through `fixture.relationships` and refuses unknown ones the
way the server does, `fixture.computed(data)` supplies the server's columns,
`fixture.bodyColumn` lifts the body so `retrieveRecord` hands it back,
`retrieveMultipleRecords` answers from `fixture.tables`, and the fetch stub
answers `EntitySetName` from `fixture.entitySets`. Two things about that rig
worth carrying to any other: **a stub installed per host onto one global
belongs to the last host created** — each rig host now answers a client URL of
its own and one stub routes by origin, found when a suite bound five views and
dropped a file on the first — and **a canvas host withholds `webAPI` and
`openFile` however the switches are set**, because a rig that can be told
"canvas, with a Web API" passes a control that works nowhere.

### Handing the user a file the control generated

The other direction — a CSV export, a generated document, an `.ics` — and it
needs **no `<feature-usage>` at all**. `navigation.openFile` is a method on
`context.navigation`, which is not gated, so a control can ship an export and
still install with no permission prompt. Shipped in `pcf-data-table`; the
download half of `pcf-attachment-list` is the same call over fetched bytes.

```ts
if (typeof context.navigation?.openFile === 'function') {
    context.navigation.openFile(
        {
            fileContent: btoa(unescape(encodeURIComponent(text))),  // base64, no data: prefix
            fileName: 'records.csv',
            fileSize: Math.ceil(text.length / 1024),                // KB, not bytes
            mimeType: 'text/csv',
        },
        { openMode: 2 },                                            // 2 Save, 1 Open
    );
}
```

- **Feature-detect the method, not the bag.** `context.navigation` is present on
  every host; `openFile` is documented model-driven only. Checking the bag
  passes on canvas and then throws.
- **`fileContent` is base64 with no `data:` prefix**, and a bare `btoa` throws
  on any character above U+00FF — one accented name in the view is enough.
  `btoa(unescape(encodeURIComponent(...)))`, or a `TextEncoder`.
- **`fileSize` is in KB**, which is the one field of `FileObject` that reads
  like it means something else.
- **`openMode: 2` is Save.** `1` is Open, which lets the host render the file
  inline — so a button labelled *Download* does something else on exactly the
  types users have opinions about. Omitting the options object defaults to Open.
- **Keep a `Blob` + `<a download>` fallback** for hosts without `openFile`, and
  revoke the object URL: a canvas app and PCFHub's demo run the control in a
  frame it does not own (a model-driven form does not — a standard control
  renders in the form's own document, measured 2026-10-11), so whether a
  browser download works is a property of the host's sandbox and
  Permissions-Policy rather than of the code. Same reasoning as the two
  clipboard paths, *Putting text on the clipboard* below.
- **Put the download in the file that touches the platform**, not in the React
  component. It keeps the platform surface in one place *and* gives the smoke
  rig a seam — `dev/dom.js` has no `Blob`, no `URL.createObjectURL` and no
  `a.download`, so a component that downloads directly is a component the rig
  cannot drive.

**If the file is a CSV, two things about the bytes.** Write a BOM, or Excel
reads UTF-8 as the local codepage and `école` opens as `Ã©cole`. And prefix a
cell beginning `=`, `+`, `-` or `@` with an apostrophe: those are formulas to
Excel, Sheets and LibreOffice alike, so a record someone named `=HYPERLINK(...)`
executes when a colleague opens the export. Withhold the prefix from anything
that parses as a number — `-1500` is a negative figure, and defusing it turns a
column of figures into text that will not sum.

**Say what the export covers.** A dataset holds the pages fetched so far, not
the view; an export button that quietly writes 25 rows of a 240-row view is the
same failure as a client-side sort — a wrong answer that looks completely right.
Either page the whole result set deliberately, or name the limit on the button
and in `docs/limitations.md`.

### Putting text on the clipboard

**Two paths, the API first, the old command on refusal — both from the press
itself.** `pcf-code-editor`'s 1.6.9 probe (2026-10-11) copied from inside a
field control on the account form, from a click and from a keydown:
`navigator.clipboard.writeText` threw *NotAllowedError: Write permission
denied* every time, and `document.execCommand('copy')` on an off-screen
textarea returned true every time and reached the operating system's
clipboard. The page was a secure context, **not framed** — a standard control
renders in the form's own document, `window === window.top` — and its policy
allowed `clipboard-write`, so the refusal was the browser's permission, not
the host's. That browser was the desktop app's Chromium 152; a desktop Edge or
Chrome may take the API, which is why the API still goes first. In PCFHub's
demo frame the policy refuses `clipboard-write` outright and the old command
copies there as well (`pcf-copy-field` found the same for its button).

- **From the press.** Both paths want a user's click or keydown on the stack;
  a copy after an `await` of anything else, or from a timer, is refused.
- **The textarea, not `display: none`** — a hidden element cannot hold a
  selection. Off-screen and `readonly`, removed straight after.
- **Focus goes back.** Selecting the textarea moved focus into it; put it back
  on the element that had it, or a keyboard user is dropped onto `<body>`.
- **A word in the UI either way**, in a status region, blanked before it is
  written so a second copy is announced too — *Copied $.lines[0].sku*, or that
  the browser refused and where the text is to copy by hand.
- **Ctrl+C belongs to the user's own selection first.** A widget that maps
  Ctrl+C to *copy this item* lets it through when the user has selected text
  inside the widget.

`pcf-code-editor`'s `copy.ts` is the whole of it in sixty-four lines;
`pcf-copy-field` is the field-sized original.

### An icon that has to follow the theme must be inline SVG

**Not an `<img>`, and not an `<img>` resource — and this is the shipped-bug
kind of finding rather than the theoretical kind.** `pcf-file-drop` drew its
empty-state icon as an `<img>`, first from a `.png` resource read with
`getResource` and then from an inline-SVG *data URL* as the fallback. It looked
right in every light-theme check and was found on a real model-driven form in
dark mode.

An image referenced through `<img src>` renders as an **isolated document**. It
cannot see the embedding page's stylesheet, so `stroke="currentColor"` inside it
resolves against its own `color` — black — and a dark form gets a black icon on
a near-black background. The file format is irrelevant: `.png`, `.svg` file,
`data:image/svg+xml`, all the same.

Build it inline instead, with `document.createElementNS`:

```ts
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(SVG_NS, 'svg');

svg.classList.add('Control-emblem');            // NOT className — see below
svg.setAttribute('viewBox', '0 0 48 48');
svg.setAttribute('aria-hidden', 'true');
```

```css
.Control .Control-emblem { color: var(--colorNeutralForeground4, #707070); }
```

Now `currentColor` resolves against the same custom property every other colour
in the control reads, and the icon follows light and dark for free.

Four things that bite while doing it:

- **`createElement('svg')` makes an *HTML* element named "svg".** It parses,
  appends, takes no space and draws nothing. The failure looks like CSS for as
  long as you let it. `createElementNS` is not optional.
- **`className` on an SVG element is a read-only `SVGAnimatedString`.**
  Assigning to it silently does nothing; use `classList.add` or
  `setAttribute('class', …)`.
- **`hidden` is an `HTMLElement` property**, so `svg.hidden = true` does nothing.
  The *attribute* works on any element — and needs a `[hidden] { display: none }`
  rule, because the element's own `display` outranks the UA's.
- **The tempting non-fix is `@media (prefers-color-scheme: dark)` inside the
  SVG**, which genuinely does apply inside an `<img>`. It is the wrong signal
  for the same reason `applyTheme` never uses it: a model-driven app carries its
  own theme and the OS setting says nothing about it, so an OS-dark machine on a
  light app gets the dark icon on a white form.

An `<img>` is still right for content the control did not draw — a preview of
the user's own file, which has no theme to follow.

**A *directional* icon needs one more thing: mirroring in right-to-left.**
Setting `dir` reorders flex children, so a leading chevron moves to the other end
of its label — but it does not turn the glyph around. `‹` stays `‹` and ends up
pointing at the text rather than away from it. One rule fixes it:

```css
[dir="rtl"] .Control-chevron { transform: scaleX(-1); }
```

Key it off **any** right-to-left ancestor rather than the control's own element.
A DOM control sets `dir` on its container, a React one on the `FluentProvider`
above it, and a host form in a right-to-left language sets it higher again — an
ancestor selector is the only one right in all three cases. Only mirror what is
actually directional: a magnifier or a dismiss glyph should stay as it is.

That leaves `context.resources.getResource(name, success, failure)` worth one
line for when a control genuinely needs a packaged asset: it is
**callback-style**, the only asynchronous API on `context` that is not a
promise, so code written in the shape of everything around it gets `undefined`
and no error. The template's field `dev/host.js` **fails by default**, because
an `<img>` resource is documented for model-driven apps and a control that
depends on one has nothing to show on the hosts a demo runs on.

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
[Files and binary content](#files-and-binary-content) covers for `pickFile`.

### What a device API costs the demo, and the maker

Every `<uses-feature>` is an install-time permission prompt, so declare only
what is called — `npm run check` warns on a declared feature nothing uses. And
any `context.device.*` call means the hub demo cannot be `full`: those methods
reject outside a real device origin, so what the demo shows is the control's own
unavailable state. Say which, in `demo.limitations`.

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

Assert that each of the refusals produces a **different** message and that none
leaves an unhandled rejection. `pcf-geo-stamp` does this in six assertions and
found a real bug doing it.
