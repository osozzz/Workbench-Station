---
name: Workbench Station
description: A tidy workbench for keeping a Windows developer PC up to date, built as a circuit board under glass.
colors:
  substrate: "#0b1c19"
  silk: "#edf4ef"
  silk-soft: "#aec2b9"
  copper: "#dda765"
  copper-ink: "#10211e"
  risk-low: "#6fcfb0"
  risk-medium: "#e8c15a"
  risk-high: "#f0746a"
  manual: "#7f9f93"
  glass-solid: "#142c27"
  substrate-light: "#d9e6df"
  silk-light: "#10302a"
  silk-soft-light: "#41604f"
  copper-light: "#8f5a1c"
  risk-low-light: "#16795b"
  risk-medium-light: "#8f6600"
  risk-high-light: "#bd3627"
typography:
  display:
    fontFamily: "Schibsted Grotesk Variable, Segoe UI, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk Variable, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Schibsted Grotesk Variable, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Schibsted Grotesk Variable, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  code:
    fontFamily: "Fragment Mono, Consolas, monospace"
    fontSize: "0.87em"
rounded:
  mark: "3px"
  tray: "16px"
  pane: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button:
    textColor: "{colors.silk}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  tab:
    textColor: "{colors.silk-soft}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "38px"
  tab-active:
    textColor: "{colors.silk}"
  segment:
    textColor: "{colors.silk-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  pane:
    rounded: "{rounded.pane}"
    padding: "24px"
  risk-mark:
    backgroundColor: "{colors.risk-low}"
    rounded: "{rounded.mark}"
    width: "6px"
    height: "22px"
---

# Design System: Workbench Station

## Overview

**Creative North Star: "The Workbench Under Glass"**

Workbench Station is the bench where a developer keeps their PC in order. A circuit board sits beneath it: deep green solder mask with copper traces lit from below. Panes of liquid glass rest on top and frost what passes underneath. The mood is a quiet control room. Nothing blinks without a reason, risk reads at a glance, and only what the person started moves on its own.

Density is moderate. Each view does one job:

- Overview shows the state of the PC.
- Updates is where you choose.
- History records what happened.
- Settings holds the rest.

Glass groups content and is never decoration: if it separates nothing, it isn't there. The voice is warm and plain. It speaks to a person, says what will happen and what to do next, and never sells or apologizes.

Dark is the main design. Light is the bare board: pale substrate, dark silkscreen, oxidized copper. The app follows the Windows theme.

**Key Characteristics:**

- A PCB substrate with soft color glows and a trace texture (`board.svg`) behind everything.
- Glass panes with a rim that catches light at the corners, a top sheen, and a long soft shadow.
- Copper is the single accent: primary action, focus, selection, counters.
- Every control is a pill; containers step down in radius (28 → 16 → 3 px).
- Risk is always drawn as a vertical color mark, never as text alone.

## Colors

Two families: the board and its silkscreen (neutrals), and copper with the risk scale (signals). Every token has a dark value (the main design) and a light pair.

### Primary

- **Copper Trace** (`copper`): the primary action ("Install N selected", "Audit this PC"), the focus ring, text selection, the Updates counter and folder icons. In light theme it becomes oxidized copper (`copper-light`) to hold contrast.

### Neutral

- **Solder Mask** (`substrate`): the window's base. In light theme, the pale board (`substrate-light`).
- **Silkscreen** (`silk`): primary text and active icons.
- **Faded Silkscreen** (`silk-soft`): secondary text, notes, inactive tabs, window buttons.
- **Solid Glass** (`glass-solid`): the opaque fill when Windows asks for reduced transparency.
- **Copper Ink** (`copper-ink`): text on copper.

### Risk signals

- **Low** (`risk-low`), **Medium** (`risk-medium`), **High** (`risk-high`): used for the risk mark, the ticks in the update strip and run results.
- **Needs you** (`manual`): manual updates, always drawn as an outline, never filled.

### Named Rules
**The One Copper Rule.** Copper is the only accent. It marks the primary action, focus and counters, never decoration. A view never shows two copper buttons.

**The Mark-Not-Word Rule.** Risk always appears as its color mark (6×22 px, 3 px corners) next to its name. Color never carries meaning alone, and a word never replaces the mark.

## Typography

**Display and body font:** Schibsted Grotesk Variable (with Segoe UI)
**Mono font:** Fragment Mono (with Consolas), only for commands and versions

**Character:** a mechanical, friendly grotesk, tightened at large sizes. The mono appears exactly where a person sees what will run on their PC.

### Hierarchy

- **Display** (600, 3rem, 1.06, -0.03em): the welcome headline. At most one per screen.
- **Headline** (600, 2rem, 1.15, -0.025em): each view's title ("Updates", "History").
- **Title** (600, 1.0625rem): pane and group titles.
- **Body** (400, 15px, 1.5): running text. Notes and descriptions cap at 60–64ch.
- **Label** (500, 14px): segments, chips, side data.
- **Code** (Fragment Mono, 0.87em): exact commands and versions, selectable.

### Named Rules
**The Tabular Count Rule.** Every number that changes (counters, totals, scores) uses `font-variant-numeric: tabular-nums` so it never jitters.

**The Selectable Truth Rule.** The interface does not select text on drag (`user-select: none`), except commands, titles and paths, which can be copied.

## Layout

A fixed title bar floats on top. It is a glass pill 58 px tall, 10 px from the top and 12 px from the sides. It holds:

- the PC name on the left;
- the tabs in the center;
- the window buttons on the right.

The page scrolls beneath it, with content capped at 1160 px and centered. The scrollbar's space is always reserved on both sides (`scrollbar-gutter: stable both-edges`), so switching views never changes the width.

Panes have 24 px padding and sit 16 px apart. Updates is a list with inline detail: the focused update opens inside the list. The selection dock floats at the bottom as a glass pill. Below 980 px, two-column grids collapse to one. Below 820 px, the bar and panes tighten.

## Elevation & Depth

Depth comes from glass, not stacked shadows. Every glass surface (pane, bar, dock, sheet) shares one recipe:

- a translucent fill;
- `backdrop-filter` blur and saturation;
- a rim drawn with a masked gradient;
- a top sheen;
- the long `--lift` shadow.

The bar and dock also bend what is beneath them through an SVG lens (`feDisplacementMap`), like a drop of liquid glass.

### Shadow Vocabulary

- **Lift** (`0 24px 48px -22px rgb(1 12 10 / 0.75), 0 2px 6px rgb(1 12 10 / 0.25)`): every glass surface resting over the board.
- **Sheen** (`inset 0 1px 0 rgb(255 255 255 / 0.12)`): the glass's lit top edge.
- **Droplet** (`inset 0 1px 0 var(--rim-bright), inset 0 -1px 0 var(--rim-dim), 0 4px 12px -4px rgb(0 0 0 / 0.35)`): the lens that slides between tabs.

### Named Rules
**The One Glass Recipe Rule.** A new floating surface reuses the `.pane` or `.bar`/`.dock` recipe. No new mix of blur, rim and shadow.

**The Solid Fallback Rule.** With `prefers-reduced-transparency`, glass turns solid (`glass-solid`) and the lens goes away. Nothing depends on transparency to be read.

## Shapes

Corners step down from outside in, following the padding: pane 28 px, the tray inside it 16 px, small marks 3 px. Every control is a full pill (999 px): buttons, tabs, segments, chips and window buttons. There are no visible borders. Separation comes from the glass rim or a 1 px inset `hairline`.

## Components

### Buttons
Tactile and calm: they give a little when pressed.

- **Shape:** pill (999 px), 42 px tall, 18 px horizontal padding, weight 600.
- **Base:** translucent tray fill with an inset `hairline`. On hover the line brightens to `silk-soft`.
- **Primary:** copper fill, copper ink and an inset top highlight. On hover, a soft white wash.
- **Press:** `scale(0.97)` with `--settle`. Disabled: 50% opacity and a not-allowed cursor.
- **Island (optional):** a 26 px circle at the right end with an arrow that moves 2 px on hover.

### Navigation (tabs)

- A tray-colored rail inside the bar, with 38 px pill tabs that carry an icon and a label.
- The active tab gets a glass droplet. It slides on a spring (`transform 520ms var(--spring)`) and fits its width with `--settle`. The active tab's icon switches to the fill weight.
- The Updates counter is a copper pill with tabular numerals.

### Segments (filters)

- 34 px pills on a tray rail. The pressed one gets light glass with an inset `hairline`.

### Panes and trays

- **Pane:** glass, 28 px corners, 24 px padding, the full Elevation recipe.
- **Tray:** an inner surface with a dark translucent fill (`tray`) and 16 px corners. Used for notices, welcome steps and grouped lists.

### Window buttons

- 42 px circles in `silk-soft`. Hover fills with tray. Close turns red (#c8402f) with white, as in Windows.

### Update strip (signature)

- Each pending update is a vertical tick with 3 px corners, grouped by source. A group grows with its number of updates.
- The tick's color shows its risk: low, medium or high.
- A manual update is drawn as an outline, a done one fades, and a failed one gets diagonal stripes.
- The running update breathes (`running`, 1.4 s).

## Do's and Don'ts

### Do:

- **Do** use the board tokens (`substrate`, `silk`, `copper`, `risk-*`) and their light pairs. Never put fixed hexes in components.
- **Do** keep every control a 999 px pill and containers at 28 → 16 → 3 px.
- **Do** show the exact command in Fragment Mono before anything is installed.
- **Do** write in a warm, plain voice that says what will happen and what to do next ("Updates appear here after the first audit of this PC"). Errors explain the cause and the way out without apologizing.
- **Do** use Phosphor icons at 16–20 px: regular weight, and fill for the active state.
- **Do** honor `prefers-reduced-motion` (no animation) and `prefers-reduced-transparency` (solid glass).

### Don't:

- **Don't** use a second accent color or put copper on decoration.
- **Don't** add colored side borders (`border-left`) to notices or cards. Tone lives in the icon.
- **Don't** let a view change the content width. Keep the scrollbar's space reserved.
- **Don't** animate anything on its own that the person did not start. The one exception is the running update's breathing.
- **Don't** leave browser or Windows defaults (context menu, tooltips, scrollbars, window buttons). Everything is drawn in this system.
