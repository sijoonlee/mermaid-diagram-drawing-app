# TODO / future work

Backlog of ideas for Mermaid Draw, roughly ordered by value-to-effort.
Checkbox = not started.

## Recommended first (best value-to-effort)

- [ ] **Drag-to-connect** — biggest UX win for the least effort (see Editor UX).
- [ ] **Undo / redo** — high value, contained change around `Store`.
- [ ] **GitHub Actions CI** — cheap to add, protects everything else.

## Diagram types

- [ ] **Add sequence diagram** *(requested)*
  - Different model from flowchart: participants (lifelines) + ordered messages,
    laid out left-to-right with time flowing downward. Won't reuse the free-form
    box/arrow canvas as-is — needs its own editor mode (lanes for participants,
    a vertical message list) and a `sequenceDiagram` generator.
  - Suggested phases: (1) data model `participants[]` + `messages[]`;
    (2) lane layout + add/reorder participants; (3) click-to-add messages
    between lifelines with arrow type (sync `->>`, async `-)`, reply `-->>`);
    (4) generate + validate + preview (reuse `preview.ts`).

- [ ] **Diagram-type selector** for the existing node/edge canvas
  - flowchart (done) + stateDiagram / classDiagram / erDiagram share the same
    box-and-arrow model — add a dropdown that swaps which `generate*()` runs.

## Editor UX

- [ ] **Undo / redo** — history stack around `Store` mutations (Cmd/Ctrl+Z).
- [ ] **Pan & zoom** the canvas (space-drag to pan, scroll/pinch to zoom; needs an
      SVG viewBox transform and coordinate mapping in `toLocal`).
- [ ] **Snap-to-grid + alignment guides** while dragging nodes.
- [ ] **Drag-to-connect** — start an arrow by dragging directly from a node's side
      anchor, instead of dropping an arrow then attaching both ends.
- [ ] **Copy / paste / duplicate** selected nodes; arrow-key nudge.

## Styling

- [ ] **Per-node color / style** picker (fill, border) → emit Mermaid `style`/
      `classDef` directives.
- [ ] **Edge styles** — dotted/thick lines, different arrowheads, edge type in the
      inspector.

## Markdown / export

- [ ] **Copy markdown** + **download `.mmd`** buttons.
- [ ] **Export preview as SVG / PNG**.
- [ ] **Two-way sync** — edit the markdown textarea and parse it back into the
      model (ambitious; currently markdown is generate-only/read-only).

## Quality / infra

- [ ] **GitHub Actions CI** — `playwright install --with-deps` + `npm test` on push.
- [ ] **More tests** — export/import round-trip, escaping (Story 10/11 from
      `user-story.md`), and per-shape generation variants.
- [ ] **Responsive / mobile** layout for the 3-pane UI.
- [ ] **Accessibility** — keyboard-only node creation/selection, ARIA labels.
