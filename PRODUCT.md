# Product

## Register

product

## Users

A single designer working locally on a Windows desktop. The workspace is used during
focused review sessions to move between generated HTML projects without navigating
the filesystem by hand.

## Product Purpose

The Local Hi-Fi Project Browser scans the repository's `projects/` directory, builds
a portable catalog, and lets the designer open every project page in one review
surface. Success means finding a project quickly, moving between its pages, comparing
responsive behavior at known widths, tuning shared design tokens without leaving the
workspace, and exporting the accepted page as clean standalone HTML.

## Brand Personality

Quiet, editorial, precise. The interface should feel like a carefully typeset working
index: calm enough to disappear during review, exact enough to trust, and distinctive
without decorative product theater.

## Anti-references

Generic SaaS dashboards, decorative purple or multicolor gradients, glassmorphism,
floating 3D objects, excessive rounded cards, heavy drop shadows, and novelty
navigation that makes standard actions harder to recognize.

## Design Principles

1. Keep the preview primary. Workspace chrome provides context and then gets out of
   the way.
2. Make the filesystem legible. Project names, page names, source files, and modified
   dates should remain easy to understand.
3. Preserve review continuity. Page, device, and tweak state should carry through
   navigation wherever practical.
4. Favor earned familiarity. Search, tabs, back navigation, and device controls use
   recognizable product patterns.
5. Work locally by default. The catalog remains portable, dependency-free, and useful
   without a server or account.
6. Make the handoff explicit. A finished refinement ends with a clear choice between
   another revision and a clean export with review controls removed.

## Accessibility & Inclusion

Target WCAG 2.2 AA contrast. Support full keyboard navigation, visible focus,
meaningful landmarks and labels, 44px touch targets where controls may be tapped, and
reduced-motion preferences. Never depend on color or hover alone to communicate
state.
