# Product

## Register

product

## Users

A single designer working locally on a Windows desktop. The workspace is used to
brief a subscription-backed Codex or Claude agent, generate high-fidelity HTML
directions, and review the outputs without navigating the filesystem by hand.

## Product Purpose

The Local Hi-Fi Designer collects a complete brief, runs a locally authenticated
selected agent through the defined design workflow, validates and publishes its HTML,
and presents every output in one review surface. Success means moving from brief to
five directions, choosing and refining a direction, comparing responsive behavior,
tuning shared design tokens, and exporting accepted standalone HTML without exposing
account credentials to the browser or project files.

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
5. Work locally by default. Agent generation requires the localhost service and a
   connected ChatGPT or Claude subscription; the generated catalog remains portable
   and dependency-free.
6. Make the handoff explicit. A finished refinement ends with a clear choice between
   another revision and a clean export with review controls removed.
7. Keep trust visible. Account connection, generation progress, validation, failure,
   cancellation, and publishing state should always be understandable without
   exposing agent reasoning or authentication data.
8. Pin project execution. Provider and model are chosen before creation and remain
   fixed for all continuation runs so output history stays coherent and billing is
   predictable.

## Accessibility & Inclusion

Target WCAG 2.2 AA contrast. Support full keyboard navigation, visible focus,
meaningful landmarks and labels, 44px touch targets where controls may be tapped, and
reduced-motion preferences. Never depend on color or hover alone to communicate
state.
