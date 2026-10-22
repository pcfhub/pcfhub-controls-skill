# Media, and the mark

What goes in `media/`, how the hub mirrors it, and how to draw the logo and
take the screenshots. The rest of the hub contract is in
[pcfhub-manifest.md](pcfhub-manifest.md).

- [Media](#media)
  - [Drawing the mark](#drawing-the-mark)
  - [Making it, with no new dependency](#making-it-with-no-new-dependency)

## Media

The hub mirrors `media/` onto its own CDN while compiling a page and rewrites
the URLs. Anything it cannot mirror keeps pointing at `raw.githubusercontent.com`
— it still renders, just served from GitHub.

- **Keep files small.** There is a per-file ceiling and a per-sync file count.
  Screenshots in the tens of kilobytes mirror; a 40 MB video does not.
- **A path is mirrored once — to replace a file, rename it.** The mirror is
  keyed by path and does not re-fetch a path it already holds. Measured
  2026-09-14: `pcf-attachment-list` 0.2.0 replaced all three screenshots in
  place, and the hub went on serving the 0.1.x renders through a sync that took
  everything else. Give the new file a new name (`screenshot-upload.png` beside
  the retired `screenshot.png`) and repoint `pcfhub.json` and the docs; the old
  object stays on the CDN, unreferenced, until a full sync. (This page said the
  opposite until 2 Oct 2026; the template's `media/README.md` had it right.)
- Always ship a poster with a video, or it renders as a blank box until it
  loads.

`pcfhub.json` names a `logo` and up to twelve `screenshots` from here.

### Drawing the mark

**A logo is drawn for 32px, and that is a constraint rather than a note.** The
hub's catalogue, the browser tab and a maker's picker all show it small. 80px is
where the craft is checked; 32 and 24 are where the reading is decided, and a
mark that only works at 80 is not finished.

Every mark uses one scaffold, so a new control joins the family instead of
sitting beside it:

```svg
<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- What the mark is, and what was rejected on the way to it. -->
  <defs>
    <linearGradient id="<control>-ramp" x1="6" y1="82" x2="90" y2="14" gradientUnits="userSpaceOnUse">
      <stop stop-color="#A684FF"/><stop offset="0.6" stop-color="#7C86FF"/><stop offset="1" stop-color="#00BCFF"/>
    </linearGradient>
  </defs>
  <!-- The silhouette, in the ramp. -->
  <!-- The interior, in #F8FAFC. -->
</svg>
```

- **The ramp verbatim, `userSpaceOnUse`, spanning the whole canvas.** Those
  coordinates are canvas units, not shape units, so every part of the mark
  samples the stretch of ramp it happens to sit on and the whole thing reads as
  one object lit from the top right. `objectBoundingBox` would restart the
  gradient inside each shape and turn a mark into a set of separate rainbows.
  Diagonal, low-left to high-right, is the family's light; a mark whose
  composition wants a different angle may move the endpoints, not the stops.
- **Two weights: the ramp, and `#F8FAFC` on it.** Never a second hue. Opacity is
  a way of getting a third value out of those two, not a licence for a third
  colour.
- **One silhouette.** Everything else is interior.
- **Give the gradient a unique id** — `<control>-ramp`, not `ramp`. The files
  are standalone on disk, but anything that inlines several of them into one
  page gets the first definition applied to all of them.

**Test the readings; do not reason about them.** Build one HTML page that draws
every candidate at 80, 40, 32, 24 and 32-on-dark, screenshot it in one Chrome
invocation, and look. This costs a minute and it is the only thing that finds
the failures below, every one of which survived being reasoned about and died on
the contact sheet.

**Put the neighbours on that sheet too.** The catalogue is one gallery, and a
mark is only as good as its distance from the others. That distance lives in the
silhouette, not the interior: a card with rectangles in it is already spoken
for several times over, so a new control that wants one has to earn it. When two
marks would share a silhouette, the second one changes shape — `pcf-choices-picker`
gave up a perfectly legible closed combobox because a pill with a label at one
end and marks at the other is `pcf-row-commands`.

**A hole beats a tint.** To say "this one is not filled in", stroke an outline
rather than dropping the fill's opacity. An outline keeps a hole at 24px; a
0.35 fill goes soft and reads as a smudge. Where a tint is genuinely the right
answer, 0.55 is about the floor against a white page — `pcf-copy-field` shipped
0.42 first and lost its second sheet entirely at 24.

**Fill and stroke with the same paint to round corners** — one path, no second
shape, and the points of a star or the corners of a funnel stop thinning to
nothing. But that stroke grows the shape by half its width on every side, so it
also **eats gaps**: `pcf-process-flow`'s chevrons carry no rounding stroke at all
because 3 units of it would have taken 3 of the 7 units holding the cells apart.
Where shapes clear each other along a diagonal, check the gap at every height it
narrows, not just at the widest point.

**Record the rejected attempts in the file itself.** The comment at the top of
each `logo.svg` is the only place this reasoning survives, and it is what stops
the next person redrawing a mark into a shape that was already tried. Write what
the mark is, what was rejected and what it read as instead, and any measurement
that is load-bearing. **No double hyphen may appear anywhere in that comment**,
or the document stops parsing as XML and the hub renders nothing.

Readings that beat the obvious mark, all of them found at 32px in this
catalogue:

| Drawn as | Read as | Recorded in |
| --- | --- | --- |
| A pill with a dot in it | A toggle switch, off | `pcf-form-action-button` |
| A pale band between two solid ends | Nothing; it vanishes | `pcf-date-range-picker` |
| Indented lines of text on a card | A paragraph | `Code-Editor-PCF` |
| Two chevrons facing outward | The collapse/expand control | `Code-Editor-PCF` |
| A horizontal tag with a label bar | A back arrow | `pcf-tag-list` |
| The same tag, rotated 45 degrees | A pencil | `pcf-tag-list` |
| A chain of two interlocking halves | A pill | `pcf-toolkit` |
| Two thin rules crossing a card | A plus sign, so "add" | `pcf-grid-cell-styler` |
| Bare columns with caps on them | An equalizer | `pcf-kanban-board` |
| Columns with headers and varying fills | A bar chart | `pcf-kanban-board` |
| Circles on a connector | Beads; the checks inside are gone | `pcf-process-flow` |
| A bar with three white chevrons | Fast forward, a media control | `pcf-process-flow` |
| Vertical hands on a disc | A keyhole | `pcf-sla-timer` |
| An upright paperclip | Concentric ovals, or a padlock | `pcf-attachment-list` |

Sizes that are load-bearing, because a 96 canvas is three times the size it is
read at: the interior of a card is about 13 real pixels tall at 32; 10 units of
indent is 3 pixels, which is not enough to signal anything; three dots need
12-unit centres to stay three dots; and a standalone stroke mark wants 9 to 11
units of weight, below which it disappears and above which its own holes close.

### Making it, with no new dependency

**Retake the screenshots, and look at them.** This is the only step that looks
at the thing rather than counting its parts, and it finds a class of defect no
assertion reaches: correct markup drawn wrongly. `pcf-data-table` 0.6.0's
screenshot pass found three — two aggregates over one column rendering as one,
computed measures never labelled on the browser route, and a sorted column
whose arrow was carried outside its own cell by a long heading. Markup,
`aria-sort` and accessible names were correct in all three. Keep the recipes in
a script (`npm run shots`) rather than in prose, or a retake becomes archaeology
and the pictures go stale instead.

**The template carries the script** (from 4 Oct 2026): `dev/shots.js` is the
control's own list of recipes — a page, the query string or the clicks that
arrange the state, the selector to frame — and `dev/cdp.js` is the engine,
headless Chrome over the DevTools protocol with no dependency, kept current by
`sync-rig.mjs`. Five repositories had hand-copied the engine before it moved
there; an older repository takes it with `sync-rig.mjs --add-missing` and
points its own recipes at `require('./cdp').shoot`. `npm run shots` also says
when a retake changed a picture under a name `pcfhub.json` already publishes —
the hub keeps the old one (*Media* above).

**The recipes start on `dev/preview.html`** (from 5 Oct 2026), a page of
cards with one state each, mounted through the rig's own host. A field control
gets value, empty, read-only, secured, no access, error and canvas, framed by
`.card`. A dataset control gets the view, empty, loading, error and canvas,
framed by `#view`. `?width=`, `?dark=1`, `?rtl=1` and `?only=` arrange each
shot. `--bind` rewrites the preview's column with the rest of the rig, and
`--framework react` patches it the way it patches the harness. Until then every
scaffold inherited `pcf-data-table`'s own preview, whose `.DataTable-*`
selectors fit no other control. The page is the control's from the first
commit: `sync-rig.mjs` reports it against the template's copy and never writes
it, so an older repository that wants one copies its shape's version by hand.

There is no rasteriser in any of these repositories and there does not need to
be: **headless Chrome is already on any machine that can run the dev harness**,
and it renders both the logo and the screenshots.

The logo, at the catalogue's 256×256 RGBA:

```bash
chrome --headless --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 \
  --screenshot=media/logo.png --window-size=256,256 file:///…/logo-256.html
```

where the page is one `<img src="logo.svg">` sized to 256 on a transparent body.
**`--default-background-color=00000000` is the whole trick** — without it the
logo ships on an opaque white square, which looks fine everywhere except the
hub's dark theme, where it is a white tile. Verify rather than assume: read the
PNG's IHDR colour type, where `6` is RGBA.

Screenshots are the same tool at **`--force-device-scale-factor=2`**, which is
where the catalogue's 800×144 crops come from — a 400×72 CSS viewport: 20px
padding, a 32px button, 20px padding. A state with a message under the control is
400×92 → 800×184. Keep the crop tight on the control; there is no form chrome in
any of these and adding some would date them.

Three things the shot page has to do, each of which was a bug first:

1. **`captureRegistration` before the bundle's `<script>` tag.** The bundle
   registers itself the moment it loads and, with nothing listening, takes its
   own else-branch and hangs the constructor on a local. The symptom is an empty
   container and **no error at all**.
2. **`*, *::before, *::after { transition: none !important; }`.** A headless
   screenshot is taken while a transition started at load is still at t=0, so an
   armed or selected state is photographed wearing its previous colours. Same
   trap as
   [Verify it](../../pcf-controls/references/styling-and-accessibility.md#verify-it-because-none-of-this-is-type-checked),
   in a different tool. **The pseudo-elements are not optional:** `*` does not
   match them, and Fluent's focus underline *is* an `::after` — `pcf-tag-list`'s
   first focused shot showed a 40px stub of it in the middle of the field
   (2026-09-23).
3. **`--virtual-time-budget=3000`.** Without it Chrome may shoot before scripts
   settle, which looks identical to the control being broken.

A page that lays every state out as cards for the camera
(`pcf-number-slider/dev/preview.html`) lives in `dev/` beside the recipes that
frame it, so a retake needs nothing from anyone's scratch folder; a one-off
page for a single picture stays scratch, with its recipe in `SPEC.md`.

**Take one at the width of a two-column form section — about 300px — as well
as the wide one.** A field control on a model-driven form usually gets the
field column, not the page, and a rule written for a phone fires there.
`pcf-hierarchy-view` 0.1.0 shipped with its detail lines hidden below 480px and
its top row 26px right of the form's other fields; five screenshots at 760px
showed neither, and the first look at the Accounts form showed both. No rig
models the width a form allocates, so the narrow shot is the only place that
class of defect is visible before an import.

**`--window-size=320,…` does not lay the page out at 320px.** Headless Chrome
keeps a minimum layout width of about 500px and crops the screenshot to the
window, so a "narrow" shot shows the left 320px of a wide layout — content
running off the right edge, which reads exactly like an overflow bug in the
control (`pcf-tag-list`, 2026-09-23). Set the control's root to the width
wanted (`280px` inside 20px padding) and keep the window at 320 to crop it.

**A shot page served from `file://` cannot `fetch` from the harness server** —
the origins differ — though `<script src>` and `<link>` load across them. Put
anything the page must read (the `.resx` strings) in a script it loads, rather
than fetching it, or the control mounts with key names and no error.

**Take the screenshots before calling the control finished, not after.** They are
the only step in the whole pipeline that looks at the thing.
`pcf-form-action-button` had 71 passing behavioural assertions and a clean
review, and the screenshot pass found two defects in one image: the busy message
printed twice — once in the caption, once in the live region below it — and the
maker's glyph still drawn beside the busy spinner. Neither was a wrong value or a
missing branch; each was two correct things drawn in the same place, which is
precisely the class of defect assertions cannot reach.
