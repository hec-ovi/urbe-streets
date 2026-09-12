# CONTRACT: preview

Purpose: a local viewer for one generated city, so the construction can be looked at.

## In

    npm run preview

It reads a build directory written by the CLI: the manifest, then the pieces whose bounds are near the camera.

## Layout from JSON

The view holds no layout of its own. [view.json](view.json) declares the panels and their widgets, and the view iterates it, passing labels and parameters through. Adding a control is an edit to that file.

Widget types are coded once in [ui/](ui/): a label, a readout, a slider, a toggle, a select, a button. Composed blocks live in [components/](components/). The full page is [views/](views/).

## What it shows

- The city, streamed by piece bounds, with the piece count and the triangle count drawn.
- One toggle per surface role, so paving, curbs, gutters, markings, hardware and the ground partition can be isolated.
- The ground partition drawn flat in role colours, which is how a partition gap is seen rather than inferred.
- A piece picker that reports the piece's kind, its Atlas ids and its bounds.
- The wear field, drawn as a ground overlay.

## Rules

- No `border-radius` anywhere.
- The view holds no construction logic. It loads a build and draws it; it never decides a dimension.
- Finishes unresolved by the catalog draw in a flat marker colour and are listed, so a missing material is visible rather than grey.

## Invariants

- The preview reads a build; it never generates one.
- It works at phone width.

## Dependencies

- [assets](../assets/CONTRACT.md) output, read as files.
- `three` and `vite`, development only.
