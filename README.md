# Mermaid Draw

A small visual editor for building [Mermaid](https://mermaid.js.org/) flowcharts
by drag-and-drop. Drop shapes onto a canvas, connect them with arrows, then
generate, **validate**, and **preview** the Mermaid markdown — all in the browser.

Built with **Vite + TypeScript** and a hand-rolled **SVG canvas** (no diagramming
library). Mermaid itself is used only to validate and render the preview.

---

## Features

- **Shape palette** — drag any of 7 node shapes onto the canvas: rectangle,
  rounded, stadium, circle, diamond, hexagon, cylinder.
- **Arrows with side anchors** — drag an arrow's round endpoint onto a box's
  top/right/bottom/left dot; it snaps and attaches. Edges route as side-aware
  bezier curves.
- **Inspector panel** — rename a box, change its shape, edit an arrow's label,
  swap an arrow's ends, detach an endpoint, or delete.
- **Multi-select** — shift-click or rubber-band a group of boxes and drag them
  together.
- **Edge labels** — double-click an arrow (or use the inspector) to label it;
  emitted as `A -->|label| B`.
- **Generate + validate + preview** — one click produces Mermaid markdown,
  validates it with `mermaid.parse`, and renders the diagram.
- **Save SVG** — download the rendered preview as a standalone `.svg` file.
- **Paste & preview** — the markdown box is editable: paste any mermaid
  flowchart into it and the preview renders live as you type.
- **Draw on canvas** — turn the markdown box's flowchart into editable boxes
  and arrows. Boxes whose id already exists on the canvas keep their position;
  everything else gets a simple auto-layout.
- **Persistence** — your diagram auto-saves to `localStorage` and survives a
  reload; export/import as JSON.

## Deploying to GitHub Pages

`npm run build` produces a fully static bundle in `dist/` (relative asset
paths, so it works from any URL). Pushing to `main` triggers
`.github/workflows/deploy.yml`, which builds and publishes `dist/` — enable it
once under **Settings → Pages → Source: GitHub Actions**. To deploy manually
instead, copy `dist/` to any static host.

## Quick start

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
```

Then in the browser:

1. Drag a shape from the **Palette** (left) onto the canvas.
2. Drag an **Arrow** onto the canvas; drag each round endpoint onto a box's side
   dot to attach it.
3. Click **Generate & Preview** (left panel) to produce and validate the markdown
   and see the rendered diagram (right panel).

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Start the Vite dev server with hot-reload at `http://localhost:5173`. |
| `npm run build` | Type-check (`tsc`) and produce a production build in `dist/`. |
| `npm run preview` | Serve the production `dist/` build locally. |
| `npm test` | Run the Playwright end-to-end tests (starts the dev server automatically). |
| `npm run test:ui` | Run the Playwright tests in interactive UI mode. |

> First time running tests? Install the browser once: `npx playwright install chromium`.

## Project layout

```
src/
  main.ts        app wiring: palette DnD, buttons, keyboard
  state.ts       Store — nodes, edges, selection, persistence
  types.ts       NodeModel, EdgeModel, NodeShape, …
  shapes.ts      the 7-shape registry (SVG render + mermaid short names)
  canvas.ts      SVG rendering + drag/attach/marquee interactions
  inspector.ts   context panel for the current selection
  palette.ts     builds the draggable palette tiles
  generate.ts    model -> mermaid markdown
  preview.ts     mermaid.parse (validate) + mermaid.render (preview)
tests/           Playwright e2e specs + helpers
user-story.md    end-to-end user stories the tests are based on
mermaid/         a reference-only clone of mermaid-js (git-ignored, not a dependency)
```

## How it works

The editor keeps a plain model of `nodes` and `edges`. Each arrow endpoint is
either **attached** to a node side or **free** at a point. On *Generate*, the
model is serialized to a `flowchart TD` diagram: rectangles use the classic
`id["label"]` syntax and the other shapes use Mermaid's typed
`id@{ shape: <short>, label: "…" }` syntax (v11.3+). The markdown is validated
with `mermaid.parse` before rendering, so invalid output is reported instead of
silently breaking the preview.

> Note: side attachment is an editor-visual concept — Mermaid's own layout engine
> decides final edge routing in the preview, so the side you attach to won't
> literally appear in the generated markdown.

## Requirements

- Node.js 20+ (developed on Node 22/24).
