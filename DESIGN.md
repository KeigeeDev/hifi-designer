---
name: Local Hi-Fi Project Browser
description: A quiet editorial workspace for reviewing local HTML design projects.
colors:
  signal-blue: "#2f5cff"
  archive-paper: "#f4f2ec"
  raised-paper: "#fbfaf7"
  white: "#ffffff"
  carbon-ink: "#171915"
  graphite: "#666961"
  quiet-graphite: "#70736b"
  rule: "#d7d5ce"
  rule-strong: "#b9bbb3"
  success-green: "#177152"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "4rem"
    fontWeight: 680
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  input-search:
    backgroundColor: "{colors.raised-paper}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  project-row:
    backgroundColor: "{colors.archive-paper}"
    textColor: "{colors.carbon-ink}"
    rounded: "0"
    padding: "20px 8px"
---

# Design System: Local Hi-Fi Project Browser

## 1. Overview

**Creative North Star: "The Working Index"**

The workspace borrows the calm authority of a design archive: broad paper-colored
surfaces, sharp black type, restrained blue signals, and fine rules that organize
without enclosing everything. It is a product interface, so hierarchy and
predictability outrank spectacle. The preview is always the dominant working object.

The system explicitly rejects generic SaaS dashboards, decorative gradients,
glassmorphism, floating 3D objects, excessive rounded cards, and novelty navigation.
It should feel quiet, editorial, and precise even when many projects are present.

**Key Characteristics:**

- Paper-toned flat surfaces with carbon-black type
- Blue reserved for current selection, focus, and primary actions
- Large editorial headings paired with compact monospaced metadata
- Hairline rules and whitespace instead of nested containers
- Familiar controls with complete keyboard and responsive behavior

## 2. Colors

The palette is nearly neutral. Signal Blue is rare enough to remain meaningful.

### Primary

- **Signal Blue:** Current tabs, focus rings, active device state, and primary
  selection cues.

### Neutral

- **Archive Paper:** Main workspace background.
- **Raised Paper:** Toolbars, search fields, and quiet secondary surfaces.
- **Carbon Ink:** Primary text and high-confidence actions.
- **Graphite:** Secondary copy and metadata.
- **Quiet Graphite:** Low-priority hints that still meet contrast requirements at
  their intended size.
- **Rule / Rule Strong:** Dividers and frame boundaries.

### Named Rules

**The One Signal Rule.** Signal Blue is the only decorative accent and occupies less
than ten percent of a screen.

**The Paper Is Flat Rule.** Background changes express hierarchy before shadows do.

## 3. Typography

- **Display Font:** Inter with system sans fallbacks
- **Body Font:** Inter with system sans fallbacks
- **Label/Mono Font:** SFMono-Regular with Consolas and Liberation Mono fallbacks

**Character:** The sans family keeps dense controls familiar; the mono voice marks
filesystem facts and review state. Strong size and weight contrast creates the
editorial character without adding a decorative display face.

### Hierarchy

- **Display** (680, 4rem, 0.95): Library headline only.
- **Headline** (650, 1.5rem, 1.1): Viewer and empty-state headings.
- **Title** (630, 1.0625rem, 1.2): Project and page titles.
- **Body** (400, 1rem, 1.5): Explanations, capped near 70 characters.
- **Label** (600, 0.6875rem, 0.08em, uppercase): Short metadata categories only.

### Named Rules

**The Two Voices Rule.** Sans explains the interface; mono reports the filesystem.
Never use mono for paragraphs or sans-serif uppercase labels for decoration.

## 4. Elevation

The library is flat. Tonal layers and hairline rules carry most depth. A restrained
structural shadow may appear only beneath the preview frame or bottom tweaks dock,
where separation from the workspace canvas is functionally necessary.

### Named Rules

**The Structural Shadow Rule.** If an element does not physically float above
scrolling content, it does not receive a shadow.

## 5. Components

### Buttons

- **Shape:** Gently squared corners (8px) or circular icon targets.
- **Primary:** Carbon Ink with white text and compact 10px by 16px padding.
- **Hover / Focus:** Tonal shift on hover; a 3px translucent Signal Blue focus ring.
- **Secondary:** Transparent until hover, using a full boundary only when grouping is
  otherwise ambiguous.

### Cards / Containers

- **Corner Style:** Project rows remain square; preview frames use 8px.
- **Background:** Archive Paper or Raised Paper.
- **Shadow Strategy:** None for rows; one restrained structural shadow for previews.
- **Border:** Hairline Rule or Rule Strong.
- **Internal Padding:** Derived from the 4px spacing scale.

### Inputs / Fields

- **Style:** Raised Paper, 1px Rule border, 8px corners, visible label or accessible
  name.
- **Focus:** Signal Blue ring with 2px offset.
- **Error / Disabled:** Text and icon accompany color; disabled controls remain
  legible.

### Navigation

Project rows, page tabs, back navigation, and device controls follow standard web
patterns. Active tabs use text weight plus a blue underline. Touch targets remain at
least 44px even when the visible icon is smaller.

### Tweaks Dock

The dock is hidden on the project library because it tunes designs, not the dashboard
interface. It appears while a project page is open, as a persistent bottom tool when
expanded and a compact toggle when collapsed. It controls Accent, Type, Spacing, and
Radius for the active preview only. Its reserved layout space prevents it from
covering review content.

## 6. Do's and Don'ts

### Do:

- **Do** keep the preview as the largest and highest-contrast working object.
- **Do** use Signal Blue only for actions, selection, focus, and state.
- **Do** use direct project and page names instead of invented product language.
- **Do** preserve visible focus, reduced motion, and 44px touch targets.
- **Do** derive spacing, type, and radius from the shared tweak-token contract.

### Don't:

- **Don't** make this look like a generic SaaS dashboard.
- **Don't** use decorative purple or multicolor gradients.
- **Don't** use glassmorphism, floating 3D objects, or decorative blobs.
- **Don't** wrap every project, page, and toolbar in rounded cards.
- **Don't** pair 1px borders with wide decorative drop shadows.
- **Don't** invent navigation when search, tabs, and back controls already fit.
