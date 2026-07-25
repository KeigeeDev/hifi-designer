# Hi-Fi Design Generation Workflow

Follow this when the task is to design or mock up a web page, landing page, hero
section, or UI as **rendered, high-fidelity HTML** — or to explore aesthetic
directions and design variations. The output is always **standalone HTML**: one
file that renders on its own with no build step and no dependencies beyond CDN
fonts/icons.

The value here is not "write some HTML." It's the discipline around it: a tight
brief that constrains the design, a deliberate anti-generic stance so the output
doesn't look like every other AI mockup, and a workflow that explores widely before
committing.

## Session shape

1. **Assemble the brief** — collect the four inputs below. A vague brief is the
   single biggest cause of generic output.
2. **Cast a wide net** — generate 5 distinct directions so the user sees range.
3. **Choose and refine** — user picks one; produce ~3 sub-variations, then fine-tune.
4. **Ship with a tweaks bar** — every refinement-stage file carries an in-page panel
   for live adjustment.

Move through these in order, but stay flexible — if the user arrives with a fully
formed brief, go straight to the wide net.

---

## Step 1 — Assemble the design brief

A design is only as good as its constraints. Gather all four inputs before
generating. If the request is missing any, ask for the missing pieces in one short
round rather than guessing — guessing is how you end up with a generic
demo-startup-landing-page that ignores what the user actually wanted.

**1. Aesthetic definition.** Name the specific design family or "vibe," not a generic
adjective. "Clean and modern" is useless — it describes 90% of the web. Push for
something with edges: *"editorial Swiss-grid with heavy serif display type,"* *"warm
analog/tactile like a boutique coffee brand,"* *"brutalist mono-spaced dev tool,"*
*"soft luxury spa with lots of negative space."* If the user gives a generic answer,
offer 2–3 sharper directions and let them pick.

**2. Reference library.** Concrete visual references beat description. Ask for
screenshots and/or live URLs of sites the user admires. Read what actually makes them
work — the type pairing, spacing rhythm, color restraint, layout tension — and carry
those qualities across, not a literal copy. If the user has no references, name a few
well-known sites that match the stated aesthetic so you're both anchored to the same
thing.

**3. Intent and audience.** State the purpose and who it's for: *"landing page for a
B2B analytics startup, aimed at technical founders, primary goal is booking a demo."*
Every design decision should serve that goal — the hero, the hierarchy, the single
most important CTA. A design that looks nice but doesn't drive the intended action has
failed even if it's pretty.

**4. Guardrails.** Define what to never do. This is the most important input for
avoiding "AI slop." Use the defaults in `design-quality.md` (purple gradients, default
Inter as the only choice, 3D blobs, etc.) and let the user extend or override them.
**Read `design-quality.md` before generating your first design** — it's the difference
between distinctive output and the generic default look.

---

## Step 2 — Cast a wide net (5 variations)

Generate **five genuinely distinct directions** off the brief. The point is range, so
make them differ on real axes — type system, layout structure, color mood, density,
era — not five recolors of the same layout. Give each a short name ("Editorial,"
"Terminal," "Warm Studio," ...) so the user can refer to them.

Keep this stage **light and fast**: no tweaks bar yet. The goal is to see the field
and pick a direction, not to polish.

Deliver as a single scrollable **contact sheet** — one HTML file where each variation
is a full-width, labeled section stacked vertically — so the user can scroll and
compare in one place. (If the user prefers separate files, do that instead.)

Then ask which direction resonates, and why. The "why" tells you what to preserve.

---

## Step 3 — Choose and refine

Once the user picks a favorite:

1. Produce **~3 sub-variations** of that direction — same DNA, different executions of
   the details (type scale, accent, section rhythm, hero treatment). This is depth,
   not range: all three should feel like siblings.
2. When they land on one, move to **fine detail** — copy, spacing polish, states,
   responsive behavior — iterating on the single chosen file.

From this stage on, every hi-fi file **ships with the tweaks bar** (Step 4).

---

## Step 4 — Ship with an in-page tweaks bar

Real-time visual adjustment beats re-prompting for taste decisions. Every
refinement-stage design includes a small floating **tweaks bar** that lets the user
adjust type scale, accent color, and spacing live in the browser.

This only works if the design is built on **CSS custom properties** for its tokens
(type scale, accent, spacing unit, radius) so the bar can drive them. Build the design
token-first, then drop in the bar.

`tweaks-bar.html` is a drop-in snippet with the token contract it expects
(`--accent`, `--font-scale`, `--space-scale`, `--radius`). Paste it before `</body>`,
make sure the page's tokens follow that contract, and it works with no per-file
wiring. The bar is collapsible, marked `data-tweaks-bar` so it's trivial to strip for
a clean export, and includes a "Copy values" button so the user can lock in what they
tuned.

---

## Output requirements

- **Standalone.** One `.html` file per design (or the contact sheet for Step 2). All
  CSS and JS inline. No build step, no framework, no local assets. Fonts and icons may
  load from a CDN (e.g. Google Fonts) — nothing else external.
- **Token-first.** Define type scale, color, spacing, and radius as CSS custom
  properties on `:root`. This is what makes the tweaks bar and quick iteration work.
- **Real copy.** No lorem ipsum. Write specific, plausible copy tied to the intent.
- **Responsive.** It should hold up from mobile to wide desktop, not just at one width.
- **Tweaks bar** on every refinement-stage output (Steps 3–4), not on the Step 2
  contact sheet.

## Companion files

- `design-quality.md` — anti-slop guardrail defaults and what "premium" means in type,
  color, layout, and detail. Read before generating.
- `tweaks-bar.html` — drop-in tweaks-bar snippet and its CSS-variable contract. Read at
  Step 3/4.
