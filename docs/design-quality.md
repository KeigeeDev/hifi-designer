# Design quality: avoiding AI slop, and what "premium" means

Read this before generating your first design. Its job is to keep output from
collapsing into the generic default look that every AI mockup drifts toward, and to
give you positive direction for what to reach for instead.

## Default guardrails (the banned list)

These are the tells of generic AI output. Treat them as banned by default; the user
can lift or extend any of them in their brief.

- **Purple / violet gradients** — especially the blue-to-purple hero gradient. The
  single most overused "AI" move. Also avoid the generic teal-to-blue and pink-to-
  orange gradient washes.
- **Default Inter (or system-ui) as the only type choice.** Inter is fine as a
  workhorse, but using it flat with no intentional pairing or display face is what
  makes designs read as untouched defaults. Choose type deliberately (see below).
- **3D blobs, floating gradient orbs, glassmorphism panels** — the decorative filler
  that signals "I had nothing specific to say here."
- **The default SaaS layout** as the only idea: centered hero → three equal feature
  cards → logo cloud → CTA band. Fine as one option; lazy as the reflex.
- **Everything rounded and soft-shadowed.** Uniform large border-radius plus soft
  drop shadows on every element is the "friendly startup" default. Vary it or commit
  to a sharper system.
- **Emoji as iconography** and emoji bullet lists.
- **Lorem ipsum** and vague filler copy ("Empower your workflow," "Unlock your
  potential"). Write specific copy.
- **Generic stock photography** — the smiling-team-at-laptop hero. If imagery is
  needed, describe something specific or use restrained graphic/typographic treatment.
- **Rainbow-of-accents.** More than one or two accent colors with no system.

## What "premium" actually comes from

Premium is not a style you turn on — it's a set of decisions made deliberately
instead of by default.

**Typography does most of the work.**
- Pick type with intent. A confident display face paired with a clean text face reads
  as designed; one default sans at three weights reads as untouched.
- Build a real type scale (e.g. a modular scale ~1.2–1.333) rather than eyeballed
  sizes. Expose it via `--font-scale` so it's tunable.
- Get the details right: generous line-height on body (~1.5–1.7), tight tracking on
  large display type, comfortable measure (~60–75 characters).

**Color: restraint plus one confident accent.**
- A neutral foundation (a real neutral ramp, often slightly warm or cool, not pure
  grey) plus **one** distinctive accent goes further than a palette of five.
- Make the accent specific and a little unexpected for the space — it's the fastest
  way to escape the default look. Expose it as `--accent`.
- Mind contrast and accessibility; premium never means low-contrast grey-on-grey.

**Space is a feature, not empty room.**
- Generous, *consistent* spacing built on a scale (4/8px base, exposed as
  `--space-scale`) reads as confident. Cramped or randomly-spaced reads as amateur.
- Let sections breathe. Whitespace is what makes luxury feel like luxury.

**Layout with tension.**
- Break the always-centered reflex. Asymmetry, a real grid, an off-center hero, or
  editorial column structure creates interest a stack of centered blocks never will.
- Establish clear hierarchy — one obvious focal point per section, one primary CTA
  that's unmistakably the most important thing on the page (tie this to the brief's
  conversion goal).

**Detail and craft.**
- Considered hover/focus/active states, not just default browser behavior.
- Intentional borders and dividers (hairlines, not heavy rules).
- Motion, if any, should be subtle and purposeful — easing and small transforms, not
  attention-grabbing animation.
- Alignment and optical balance: things line up on a grid; nothing is a pixel off by
  accident.

## A quick self-check before you ship a design

- Could I name the specific aesthetic, or is it just "clean and modern"?
- If I removed the logo, would this still look like a *particular* brand, or like a
  template?
- Is there exactly one thing the eye goes to first, and is it the CTA that serves the
  brief's goal?
- Did I make a deliberate type choice, or accept the default?
- Is anything on the banned list sneaking in?
