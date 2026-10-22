# Styling and accessibility

Looking like the form the control is on — Fluent's tokens without mounting
Fluent, the field surface, focus, dark, icons, tables. Accessibility — the Tab
the form keeps, a tree's keys, live regions — is in
[accessibility.md](accessibility.md).

- [Styling, or looking like the form it is on](#styling-or-looking-like-the-form-it-is-on)
  - [A standard control cannot mount a `FluentProvider`, and does not need to](#a-standard-control-cannot-mount-a-fluentprovider-and-does-not-need-to)
  - [Get the values from the packages, not from a screenshot](#get-the-values-from-the-packages-not-from-a-screenshot)
  - [The palette worth starting from](#the-palette-worth-starting-from)
  - [Dark: the host's theme, never the OS's](#dark-the-hosts-theme-never-the-oss)
  - [The field surface is one box, not two](#the-field-surface-is-one-box-not-two)
  - [The animated focus underline, and why it is a pseudo-element](#the-animated-focus-underline-and-why-it-is-a-pseudo-element)
  - [Disabled is a different surface, not a dimmer one](#disabled-is-a-different-surface-not-a-dimmer-one)
  - [Icons: Fluent's path data, at the size it was drawn for](#icons-fluents-path-data-at-the-size-it-was-drawn-for)
  - [Tables get the same treatment, with different numbers](#tables-get-the-same-treatment-with-different-numbers)
  - [Target size, and the honest version of the trade](#target-size-and-the-honest-version-of-the-trade)
  - [Narrow widths are in `layout.md`](#narrow-widths-are-in-layoutmd)
  - [Two media queries that are not optional](#two-media-queries-that-are-not-optional)
  - [Verify it, because none of this is type-checked](#verify-it-because-none-of-this-is-type-checked)
  - [Scoping, restated because the blast radius is real](#scoping-restated-because-the-blast-radius-is-real)
  - [A Fluent surface's own class competes with yours](#a-fluent-surfaces-own-class-competes-with-yours)
- [Accessibility](#accessibility)

## Styling, or looking like the form it is on

The most common reason a working control reads as third-party is that it was
styled to be *neutral* rather than to match. `font: inherit`,
`background: transparent`, a 1px grey border — that inherits the host's type and
nothing else, which next to a real Fluent field is a white bordered box sitting
beside a grey filled one. It looks pasted on, and no amount of polish elsewhere
undoes it.

### A standard control cannot mount a `FluentProvider`, and does not need to

This is the fact everything below rests on, and it is routinely read backwards.

`FluentProvider` is React, so a `control-type="standard"` control cannot mount
one — from which people conclude that Fluent's styling is unavailable to them
and go back to inventing colours. The half that gets missed is what the provider
actually *does*: it emits the theme as **CSS custom properties on its own
wrapper**. A model-driven form already mounts one above every code component on
the page. Nothing has to be mounted in order to *read* them.

So write every colour, radius, duration and font as the token with a literal
fallback:

```css
.ColorPicker {
    --ColorPicker-background: var(--colorNeutralBackground3, #f5f5f5);
    --ColorPicker-foreground: var(--colorNeutralForeground1, #242424);
    --ColorPicker-stroke-focus: var(--colorCompoundBrandStroke, #0f6cbd);
}
```

The token wins where the host publishes it — so the control follows the app's
theme *and its brand colour* for free — and the literal carries the hosts that
publish nothing, which includes canvas apps and PCFHub's demo harness. One
declaration covers both, and neither case needs a JavaScript branch.

Indirect through control-local properties rather than writing `var(--colorX, …)`
at each use site. The fallbacks have to be redefined per theme (below), and a
palette declared in one block is a palette that can be.

### Get the values from the packages, not from a screenshot

Fluent's tokens live in `@fluentui/tokens`, a transitive dependency of any
control that already declares Fluent. Print the pair rather than sampling a
colour picker over a screenshot — a value one step off on the neutral ramp is
invisible in isolation and obvious beside the real thing:

```bash
node --input-type=module -e "
import {webLightTheme as L, webDarkTheme as D} from '@fluentui/tokens';
for (const k of ['colorNeutralBackground3','colorCompoundBrandStroke'])
    console.log(k.padEnd(34), String(L[k]).padEnd(12), String(D[k]));
"
```

The **component** styles are worth reading the same way, because Griffel
compiles them to plain CSS text that is sitting in `node_modules` ready to be
copied:

```bash
grep -o '\.r[a-z0-9]*{[^}]*}' \
  node_modules/@fluentui/react-input/lib/components/Input/useInputStyles.styles.js
```

That is the authority for what a Fluent Input *is*, down to the pseudo-element
timings. Read it before hand-writing anything meant to look like one.

### The palette worth starting from

Verified values, Fluent web light and dark. Enough for a field-shaped control;
extend from the packages rather than guessing the next one.

| Token | Light | Dark |
| --- | --- | --- |
| `colorNeutralBackground1` | `#ffffff` | `#292929` |
| `colorNeutralBackground3` (the filled field) | `#f5f5f5` | `#141414` |
| `colorNeutralBackground3Hover` | `#ebebeb` | `#292929` |
| `colorNeutralForeground1` | `#242424` | `#ffffff` |
| `colorNeutralForeground2` (icon at rest) | `#424242` | `#d6d6d6` |
| `colorNeutralForeground4` (placeholder) | `#707070` | `#999999` |
| `colorNeutralForegroundDisabled` | `#bdbdbd` | `#5c5c5c` |
| `colorNeutralStroke1` | `#d1d1d1` | `#666666` |
| `colorNeutralStrokeDisabled` | `#e0e0e0` | `#424242` |
| `colorTransparentStroke` | `transparent` | `transparent` |
| `colorCompoundBrandStroke` (the focus line) | `#0f6cbd` | `#479ef5` |
| `colorCompoundBrandStrokePressed` | `#0f548c` | `#2886de` |
| `colorSubtleBackgroundHover` | `#f5f5f5` | `#383838` |
| `colorSubtleBackgroundPressed` | `#e0e0e0` | `#2e2e2e` |
| `colorPaletteRedBorder2` (invalid) | `#d13438` | `#e37d80` |
| `colorPaletteRedForeground1` | `#bc2f32` | `#e37d80` |
| `colorPaletteGreenForeground1` | `#0e700e` | `#54b054` |
| `colorStrokeFocus1` / `colorStrokeFocus2` | `#ffffff` / `#000000` | `#000000` / `#ffffff` |

Note that `colorNeutralBackground3` inverts its relationship to
`colorNeutralBackground1` between themes — lighter than the page in dark, darker
in light. That is why "filled-darker" is a name and not a description, and why a
hand-picked grey that works in light mode usually disappears in dark.

The non-colour tokens are the same in both: `borderRadiusMedium` 4px,
`spacingHorizontalM` 12px, `spacingHorizontalXXS` 2px, `fontSizeBase300` 14px /
`lineHeightBase300` 20px for body, `fontSizeBase200` 12px / `lineHeightBase200`
16px for captions, `durationUltraFast` 50ms, `durationFaster` 100ms,
`durationNormal` 200ms, `curveAccelerateMid` `cubic-bezier(1,0,1,1)`,
`curveDecelerateMid` `cubic-bezier(0,0,0,1)`, `curveEasyEase`
`cubic-bezier(0.33,0,0.67,1)`.

Field heights are `small` 24px, `medium` **32px**, `large` 40px. A form uses
medium.

### Dark: the host's theme, never the OS's

`@media (prefers-color-scheme: dark)` is the obvious hook and it is the wrong
question — a model-driven app carries its own theme and the user's OS setting
says nothing about it. The signal is `context.fluentDesignLanguage?.isDarkTheme`,
typed on `FluentDesignState`. *Fluent 8, and no icons* has the grid-customizer
version of this, which publishes to `document.documentElement` because a cell
renderer has no root of its own; a field control has one and should use it:

```ts
private applyTheme(context: ComponentFramework.Context<IInputs>): void {
    const isDarkTheme = context.fluentDesignLanguage?.isDarkTheme;

    // Absent writes nothing rather than assuming light — leaving the class off
    // keeps the light fallbacks, which is the same guess the host itself made
    // when it declined to say.
    if (isDarkTheme === undefined) {
        return;
    }

    this.container.classList.toggle('ColorPicker--dark', isDarkTheme);
}
```

```css
.ColorPicker--dark {
    --ColorPicker-background: var(--colorNeutralBackground3, #141414);
}
```

**Only the fallback changes.** A host that emits the tokens is already handing
over its own dark values through the `var()`, and the block never takes effect
there. That property is what makes this safe: the class cannot fight a host that
knows better than the control does.

### The field surface is one box, not two

The platform's own fields with a trailing affordance — phone, email, lookup,
date — are a **single filled surface with the control inside it**. The border,
the hover, the focus underline and the invalid state all belong to that surface.
Rendering an input beside a separate button is the clearest tell that a code
component was not laid out by the same hand as the form around it.

```html
<div class="ColorPicker-field">      <!-- fill, border, ::after underline -->
    <input class="ColorPicker-input">    <!-- transparent, borderless -->
    <button class="ColorPicker-button">  <!-- subtle, no fill until hovered -->
</div>
```

Fluent's `filled-darker` Input, which is what a model-driven form draws:

```css
.ColorPicker .ColorPicker-field {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--spacingHorizontalXXS, 2px);
    box-sizing: border-box;
    min-height: 32px;
    border: 1px solid var(--ColorPicker-stroke);        /* transparent */
    border-radius: var(--ColorPicker-radius);
    background-color: var(--ColorPicker-background);
}

.ColorPicker .ColorPicker-input {
    flex: 1 1 auto;
    min-width: 0;              /* or the button is pushed off a narrow form */
    align-self: stretch;
    padding: 0 var(--spacingHorizontalM, 12px);
    border-style: none;
    outline-style: none;
    background-color: transparent;   /* the surface owns the fill */
    font-family: inherit;
    font-size: var(--ColorPicker-font-size);
}
```

`background-color: transparent` on the input is not cosmetic. Give it a fill of
its own and the surface's hover state shows as a lighter rectangle inside the
field.

Note the borders are `transparent` rather than absent. They hold the 32px height
against the box model, and they are what the invalid and disabled states colour
in — a field that has no border to reveal has to grow one, which moves the form.

**And add `[hidden] { display: none }` for the surface**, which the flex
declaration has just made necessary:

```css
.ColorPicker .ColorPicker-field[hidden] { display: none; }
```

`element.hidden = true` works by way of a UA rule `[hidden] { display: none }`,
and *any* author `display` declaration beats it on specificity. So the moment a
wrapper gains `display: flex`, every `hidden` the control sets on it silently
stops working — and the branch that breaks is usually the field-level-security
one, which is the branch nobody exercises and the one where failing open means
rendering an empty box where "you may not see this value" should be. The same
applies to `--hidden` for `mode.isVisible` if that class is on an element the
stylesheet also gives a `display` to.

### The animated focus underline, and why it is a pseudo-element

The blue line that grows along the bottom of a focused field is the most
recognisable thing Fluent does, and the obvious implementation is wrong.

A `border-bottom` that appears on focus is 2px of height the box did not have a
moment ago, so **every field below it on the form nudges down** as the user tabs
through. Fluent scales an absolutely-positioned `::after` instead, which is
composited and moves nothing:

```css
.ColorPicker .ColorPicker-field::after {
    content: "";
    position: absolute;
    right: -1px;
    bottom: -1px;
    left: -1px;                        /* over the border, not inside it */
    box-sizing: border-box;
    height: max(2px, var(--ColorPicker-radius));
    border-bottom: 2px solid var(--ColorPicker-stroke-focus);
    border-bottom-right-radius: var(--ColorPicker-radius);
    border-bottom-left-radius: var(--ColorPicker-radius);
    clip-path: inset(calc(100% - 2px) 0 0 0);
    transform: scaleX(0);
    transition-property: transform;
    transition-duration: var(--durationUltraFast, 50ms);
    transition-delay: var(--curveAccelerateMid, cubic-bezier(1, 0, 1, 1));
}

.ColorPicker .ColorPicker-field:focus-within::after {
    transform: scaleX(1);
    transition-duration: var(--durationNormal, 200ms);
    transition-delay: var(--curveDecelerateMid, cubic-bezier(0, 0, 0, 1));
}

/* The underline is the indicator; stop the host drawing a second one. */
.ColorPicker .ColorPicker-field:focus-within {
    outline: 2px solid transparent;
}
```

Three things in there are load-bearing and none is obvious:

- **`clip-path`.** The box has to be at least as tall as the corner radius or
  the line stops short of the rounded ends; the clip trims the rest back to 2px.
- **`:focus-within`, not `:focus`.** Focusing the button inside the field should
  light the same field the input would — it is one control, not two stops that
  look different from each other.
- **The asymmetric duration.** 50ms out, 200ms in. That is Fluent's, and it is
  why arriving in a field is what the eye catches while leaving one is not.

A curve in `transition-delay` is invalid CSS and computes to `0s`, so those two
lines are inert. They are reproduced because they are what Fluent's authored
source contains — `useInputStyles.styles.raw.js` has
`transitionDelay: tokens.curveAccelerateMid` — and because the interesting thing
about them is knowing they do nothing. Do not "fix" them into
`transition-timing-function`: that changes the animation away from what every
Fluent field on the page is actually rendering, which is the opposite of the
goal. Dropping the two lines entirely is equally correct and shorter.

A control whose focus target is *not* inside a field surface — a plain button, a
tile — takes Fluent's focus **ring** instead: a dark ring with a light one
immediately inside it, so the shape survives on either background.

```css
.ColorPicker .ColorPicker-button:focus-visible {
    outline: 2px solid var(--ColorPicker-focus-outer);   /* colorStrokeFocus2 */
    outline-offset: -2px;
    box-shadow: inset 0 0 0 4px var(--ColorPicker-focus-inner); /* …Focus1 */
}
```

`:focus-visible`, not `:focus` — a mouse click should not leave a ring behind.
A button inside a field wants both: the underline says focus is somewhere in
this field, and a field holding two tab stops has to say which one.

### Disabled is a different surface, not a dimmer one

`opacity: 0.6` over the enabled styling is the reflex and it is wrong twice: it
drags the *text* below contrast along with the chrome, and it looks nothing like
Fluent, which **removes the fill and reveals the border**:

```css
.ColorPicker--disabled .ColorPicker-field {
    background-color: var(--colorTransparentBackground, transparent);
    border-color: var(--ColorPicker-stroke-disabled);
}
```

Drive it from a class on the root rather than `:disabled` on the input, since
`:disabled` cannot reach the box around it.

And decide *what* disabled means for each part. A read-only field is exactly
where a copy button is most useful, so that button follows the value's
**readability** while the input follows its **editability** — two different
conditions, and conflating them removes the feature in the case it exists for.

### Icons: Fluent's path data, at the size it was drawn for

A control that shows a glyph should show *the* glyph. Fluent's icons are plain
path strings in `@fluentui/react-icons`:

```bash
grep -rh "^export const Copy16Regular = " node_modules/@fluentui/react-icons/lib/sizedIcons/
```

Inline the path data rather than adding the dependency — it is a React package,
and installing it to reach two paths puts the whole icon set's module graph in
front of the bundler.

**Take the cut that matches the box.** Fluent redraws each size rather than
scaling it, so a 20px glyph rendered at 16px has strokes a fifth too thin. That
reads as "slightly wrong" without ever being identifiable.

Build them with `createElementNS`:

```ts
const SVG_NS = 'http://www.w3.org/2000/svg';

const svg = document.createElementNS(SVG_NS, 'svg');

svg.setAttribute('viewBox', '0 0 16 16');
svg.setAttribute('aria-hidden', 'true');
svg.setAttribute('focusable', 'false');

const path = document.createElementNS(SVG_NS, 'path');

path.setAttribute('d', ICON_PATHS.copy);
svg.append(path);
```

`document.createElement('svg')` returns an `HTMLUnknownElement` that renders
nothing and reports nothing — SVG is a separate namespace and the HTML factory
does not know it. `innerHTML` would work, but a control that assigns it anywhere
has to be re-read carefully by everyone who ever audits the repo for injection,
which is a cost with no matching benefit for two static paths.

Set `fill: currentColor` on the `<svg>` and the glyph follows the button's
hover, disabled and success colours with no second set of rules chasing them.

**Build both states once and let CSS choose**, rather than swapping path data:

```css
.ColorPicker .ColorPicker-icon--copied,
.ColorPicker--copied .ColorPicker-icon--copy { display: none; }
.ColorPicker--copied .ColorPicker-icon--copied { display: block; }
```

`updateView` runs on every change to every bound value on the form, so anything
rebuilt inside it is rebuilt constantly — and a transient confirmation lives on a
timer that `updateView` knows nothing about, so path data written there is path
data a stray render silently reverts.

`aria-hidden` on the glyph, always: the accessible name belongs on the button.
And an icon-only button needs `title` as well as `aria-label`. A sighted user who
does not recognise the mark has no other way to learn what it does, and `title`
is not a substitute for the label — screen readers can be configured to ignore
it, and a touch user has no hover.

### A native range, styled as Fluent's Slider

A standard control gets Fluent's Slider without Fluent: keep the browser's
`<input type="range">` — it places the thumb, takes every key and reports
every value — and paint only around it. `pcf-number-slider` does it this way;
its stylesheet is the worked example.

- **The numbers are the package's.** `@fluentui/react-slider`'s
  `useSliderStyles.styles.raw.js`, size `medium`: a 20px thumb, a 4px rail
  with `borderRadiusXLarge`, rail `colorNeutralStrokeAccessible`, progress and
  thumb `colorCompoundBrandBackground` (Hover and Pressed on `:hover` and
  `:active`), and the thumb's ring as an inset shadow of
  `colorNeutralBackground1` at 0.2 of the thumb, with a hairline of
  `colorNeutralStroke1` outside it. Disabled: thumb and progress
  `colorNeutralForegroundDisabled`, rail `colorNeutralBackgroundDisabled`.
- **Make the input's track transparent and draw the rail and fill under it**,
  inset by half a thumb at each end — that is where a native thumb's centre
  sits at the minimum and the maximum, so a percentage along your rail is a
  percentage along the thumb's travel. Style the thumb through
  `::-webkit-slider-thumb` and `::-moz-range-thumb`, each in a rule of its
  own: one unknown pseudo-element in a selector list drops the whole rule.
- **Two thumbs on one rail** are two inputs stacked, `pointer-events: none`
  on the inputs and `auto` on the thumbs, and the lower one raised when both
  sit at the top end or it can never be dragged back.
- **Use logical properties for the fill** (`inset-inline-start`, `width`):
  a native range runs right to left under `dir="rtl"`, and the fill follows
  with no code. Mirror an SVG arc with `scaleX(-1)` instead.
- **`touch-action: none` on the track**, or a drag on a phone scrolls the
  form (intended; not yet measured on a phone).
- **`aria-valuetext` on each thumb** with the value as displayed — "72.50%",
  "No value" for an empty column — and the field's label plus "From"/"To" as
  the names of a range's two thumbs. A display-only value is `role="meter"`
  with `aria-valuenow`, `-min`, `-max` and `-valuetext`, never a disabled
  slider. A stepper's box is `role="spinbutton"`.
- **Forced colours flatten backgrounds to `Canvas`**, so a rail and a fill
  drawn as backgrounds vanish: `forced-color-adjust: none` on them, and
  `CanvasText` / `Highlight` / `GrayText` as their colours.

### Tables get the same treatment, with different numbers

A dataset control is not field-shaped, so the surface and the underline do not
apply — but the palette, the focus indicator and the two media queries all do,
and three numbers are worth taking from Fluent's DataGrid rather than inventing:

- **44px rows, header included.** A table with 8px of padding and no height is
  the difference between something that reads as a grid and something that reads
  as a `<table>` with padding on it.
- **Header cells are `fontWeightSemibold`**, and their bottom border is
  `colorNeutralStroke1` where the body's is the lighter `colorNeutralStroke2`.
  One border weight throughout is the other common tell.
- **Pager buttons are 32px and semibold**, Fluent's secondary Button:
  `colorNeutralBackground1` darkening through `…Hover` and `…Pressed`. A 26px
  pager under a form full of 32px controls is the same mismatch as a wrong-height
  field, just further down the page.

The two-ring focus indicator matters more here than anywhere else. A single
outline disappears into whichever background happens to match it — and on a
table that means it disappears **on hover**, because the hover colour is a third
colour again. The light ring inside the dark one is what survives all three.

**`opacity` is the right tool for exactly one thing on a table**, and it is worth
naming because the rule elsewhere is the opposite. Dimming rows while a page
loads is transient and says "stale"; blanking them makes every sort and page
turn flash empty. That is fine. What is not fine is reaching for the same trick
for a *disabled* pager button, which is disabled for as long as the user sits on
the first or last page — a permanent state, where `opacity` parks the label
below contrast and leaves it there. Recolour instead:
`colorNeutralForegroundDisabled` on `colorNeutralStrokeDisabled`.

And under `forced-colors`, an open-record button needs `LinkText` and an
underline. It is a link in everything but markup, and forced colours is where
that has to be said out loud — the brand colour is gone, so without the
underline nothing distinguishes it from the cell beside it.

### Target size, and the honest version of the trade

A trailing button inside a 32px field is about 28px square. That clears WCAG 2.1
**AA** — 2.5.8 asks for 24px — and does not meet 2.5.5's 44px at **AAA**.

Take the trade and write down why, rather than shipping a 44px button that
cannot fit inside a form field and therefore cannot look like one. What is not
acceptable is leaving a 44px claim in `docs/` because the first draft had it: a
control that documents an accessibility property it no longer has is worse than
one that documents the real number alongside the reason.

### Narrow widths are in `layout.md`

**A viewport-relative cap has a lower end, and something will find it** and
**A narrow layout is measured, not queried — and never contained** moved to
*Narrow widths* in `layout.md` on 10 Oct 2026, beside the table rules they
share a `min(measured, allocated)` with.

### Two media queries that are not optional

```css
@media (forced-colors: active) {
    /* Every tint collapses to a handful of system keywords, so anything
       carrying meaning by colour has to carry it by shape too. Transparent
       borders become visible ones; the brand underline becomes Highlight. */
    .ColorPicker .ColorPicker-field { border-color: ButtonBorder; }
    .ColorPicker .ColorPicker-field::after { border-bottom-color: Highlight; }
    .ColorPicker--disabled .ColorPicker-field { border-color: GrayText; }
}

@media screen and (prefers-reduced-motion: reduce) {
    /* Shortened, not removed. The animation is decoration; the focus it
       indicates is not, so the line must still appear — it just stops
       travelling to get there. */
    .ColorPicker .ColorPicker-field::after,
    .ColorPicker .ColorPicker-field:focus-within::after {
        transition-duration: 0.01ms;
        transition-delay: 0.01ms;
    }
}
```

Fluent ships the reduced-motion pair on the Input itself, which is the argument
for it: a control that animates where the platform's own equivalent does not is
a control that ignored a stated preference.

**Audit the forced-colors block against the file rather than writing it from
memory**, because the thing it usually misses is a background. Forced colours
replace every `background-color` with the system `Canvas`, so anything that was
*only* a tint becomes invisible — and the canonical victim is a loading
skeleton, three grey bars that render as three rectangles of nothing on the one
screen whose entire job is to say that something is happening. It fails silently
and only for the users who need it most.

The template's own grid-customizer stylesheet shipped exactly this: it stated
the principle — a border, an underline and a glyph survive forced colours, a
tint does not — and then left the block empty under a comment claiming nothing
depended on colour, while its skeleton bars were pure `background-color`. Give a
placeholder a `1px solid GrayText` border and a transparent fill there.

Walk the file for `background-color` and for anything whose meaning is a hue.
Text needs no rule: `color` is overridden to `CanvasText` whether or not you say
so, which is fine wherever the meaning was carried by a glyph or a sentence
rather than by the colour itself.

### Verify it, because none of this is type-checked

The build will not tell you that a selector matches nothing or that a token name
is misspelled. `var(--colorNeutralBackgroud3, #f5f5f5)` renders the fallback
forever and looks entirely fine on any host that publishes nothing — which is
every host you are likely to test on.

Serve the **built** stylesheet against the DOM the control constructs and read
computed styles back:

```js
const f = document.querySelector('.ColorPicker-field');
getComputedStyle(f).backgroundColor;                    // rgb(245, 245, 245)
getComputedStyle(f, '::after').borderBottomColor;       // rgb(15, 108, 189)
```

Then set a token on `document.documentElement` and confirm both palettes follow
it. That is the whole premise of the token-with-fallback approach, and it is one
typo away from being silently untrue.

One trap while doing this: `getComputedStyle` read immediately after changing a
transitioned property returns the value **mid-transition**, which at t=0 is the
old one. A background that appears not to have picked up a token has usually
picked it up fine.

**Waiting is not the fix, and believing it is costs an hour.** A browser pane
that is hidden, backgrounded, or behind another window does not composite, so its
transitions never advance — `getComputedStyle` keeps returning the *from* value
however long you wait, `element.getAnimations()` comes back **empty**, and the
rule looks as though it never applied. Every animated property reads as a broken
selector at once, which is exactly the shape of a real bug.

Neutralise the transition instead of waiting for it:

```js
el.style.transition = 'none';
getComputedStyle(el).borderTopColor;   // now the value the cascade actually chose
el.style.transition = '';
```

And when a rule still looks inert, **insert a probe element** with the same
classes beside the real one and measure that. A fresh element has no transition
to be frozen in, so a probe that is styled correctly while the real element is
not tells you the cascade is fine and the compositor is not — which is a
different problem from the one you were looking for.

Found on `pcf-form-action-button`, whose armed state read as neutral grey through
three rounds of investigation before the pane turned out to be the cause.

### Scoping, restated because the blast radius is real

Every rule under the control's own class, the custom property declarations
included. A code component shares a document with the host app and with every
other control on the form, and the platform does not sandbox it. A bare
`input { … }` here restyles the page the control was dropped onto.

The React version of this problem — a portalled Fluent surface the control's
stylesheet cannot reach — is under *React (virtual) controls* in `rendering-and-hosts.md`, and it is the same
fact seen from the other side.

### A Fluent surface's own class competes with yours

Two findings from `pcf-date-range-picker` 0.3.1, both on a `PopoverSurface`
and both invisible in the dev harness, whose Fluent stub has neither:

- **Fluent's class on the surface is a competitor for every declaration on that
  element.** `PopoverSurface` sets `padding: 16px` through Griffel, which
  injects its styles *after* the control's stylesheet; one class against one
  class is decided by order, so `.DateRangePicker-popover { padding: 0 }` lost
  silently for six releases and the surface carried 32px it was never meant to.
  Check the computed style, not the stylesheet. Win with a doubled selector
  (`.X.X { padding: 0 }`) — and put **only** the contested declaration under it,
  because raising the whole rule's specificity outranks the control's own
  one-class media rules further down and disables them just as silently.
- **Tabster's focus guards take a pixel before they take none.** `trapFocus`
  inserts two `<i data-tabster-dummy>` elements at the start and end of the
  surface in flow, and makes them `position: fixed` about 100ms later. Until
  then the trailing one is a one-pixel line box after the last child, and a
  surface with `overflow-y: auto` shows a scrollbar for that tenth of a second
  on every open. `.X [data-tabster-dummy] { position: absolute; height: 0 }`
  takes them out of flow from the first frame; Tabster's inline style then
  supersedes it and the trap still wraps.

Both were measured by sampling `scrollHeight` against `clientHeight` every
8ms from the click in `npm start`. `npm start` is the authority for anything
that depends on the real Fluent; the harness stub renders inline, unpadded and
untrapped, and would have certified either bug.

## Accessibility

Moved to [accessibility.md](accessibility.md) on 15 Oct 2026, so each file can
be read whole:

- **Accessibility** — A model-driven form keeps Tab · A tree or a list of your own: one tab stop, arrows inside · Live regions: announce the change, not the value
