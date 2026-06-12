# User stories (Playwright test specs)

These are concrete, end-to-end user stories for the mermaid-draw-app, written so
each can be turned into a Playwright test. Every story lists the **persona**, the
**goal**, the **steps**, and the **assertions** a test should make.

App URL during dev: `http://localhost:5173/` (run `npm run dev`).

---

## Selector & behavior reference

Stable hooks a test can rely on:

| Thing | Selector / fact |
| --- | --- |
| Palette tiles | `.palette-item` (draggable). Shapes first, arrow last. |
| Canvas | `#canvas` (the `<svg>`) |
| A rendered node outline | `.node-rect` (rect / ellipse / polygon / path) |
| A node's text label | `text.node-label` |
| Side anchor dots | `.anchor` (4 per node) |
| Arrow curve | `path.edge-line` |
| Arrow endpoint handles | `.endpoint`; attached ones also have `.attached` |
| Edge label pill text | `text.edge-label` |
| Inspector panel | `#inspector` (shows `h3` "Box" / "Arrow" / "N boxes selected") |
| Inspector label field | `#inspector input[type=text]` |
| Inspector shape dropdown | `#inspector select` |
| Generate button | `#generate-btn` |
| Generated markdown | `#md` (`<textarea>`) |
| Validation status | `#status` (class `ok` on success, `err` on failure) |
| Preview output | `#preview` (contains an `<svg>` when valid) |
| Export / Import / Clear | `#export-btn` / `#import-btn` (+ hidden `#import-file`) / `#clear-btn` |
| Persistence | `localStorage['mermaid-draw:diagram']` (JSON `{nodes, edges}`) |

### Two different drag mechanisms (important for tests)

1. **Palette → canvas uses native HTML5 drag-and-drop** (`dragstart`/`drop` with a
   `DataTransfer` carrying `text/tool` = `box|arrow` and `text/shape`). Playwright's
   `dragTo()` is unreliable for native DnD; prefer dispatching the events with a
   shared `DataTransfer`, e.g. a `dragAndDrop(source, target, x, y)` helper. See the
   sketch at the bottom.
2. **Everything on the canvas (moving nodes, dragging endpoints, marquee) uses raw
   mouse events** (`mousedown`/`mousemove`/`mouseup` on `document`). Use Playwright's
   `mouse.move()/down()/up()` with absolute page coordinates for these.

---

## Story 1 — Create a box from the palette

**As** a user, **I want** to drag a Box shape onto the canvas **so that** I can start
a diagram.

**Steps**
1. Open the app (canvas starts empty).
2. Drag the "Rectangle" palette tile and drop it at canvas point ~(300, 200).

**Assertions**
- Exactly one `.node-rect` exists.
- A `text.node-label` reads `Box 1`.
- `localStorage['mermaid-draw:diagram']` parses and has `nodes.length === 1`.

---

## Story 2 — The core flow: two boxes, an arrow, generate & preview

**As** a user, **I want** to connect two boxes with an arrow and generate validated
mermaid **so that** I get a working diagram. (This is the original headline story.)

**Steps**
1. Drop a Rectangle at ~(250, 150)  → `Box 1`.
2. Drop an Arrow at ~(250, 300).
3. Drop another Rectangle at ~(250, 450) → `Box 2`.
4. Drag the arrow's **head** endpoint (`.endpoint` nearest the arrowhead) onto
   `Box 2`'s **top** anchor (snaps within ~22px).
5. Drag the arrow's **tail** endpoint onto `Box 1`'s **bottom** anchor.
6. Click **Generate & Preview** (`#generate-btn`).

**Assertions**
- Both endpoints now carry `.attached` (2 elements with `.endpoint.attached`).
- `#md` value contains `flowchart TD`, two node lines, and an edge line
  `n1 --> n2` (ids may differ; assert on the `-->` between the two node ids).
- `#status` has class `ok` and text includes `Valid`.
- `#preview` contains an `<svg>`.

---

## Story 3 — Pick a shape for a box

**As** a user, **I want** to change a box's shape **so that** it conveys the right
semantics, and the generated markdown reflects it.

**Steps**
1. Drop a Rectangle, then click it to select (inspector shows `Box`).
2. In `#inspector select`, choose `Cylinder`.
3. Click **Generate & Preview**.

**Assertions**
- The node's main element is now a `path` (cylinder) and a `.node-deco` rim exists.
- `#md` contains `@{ shape: cyl, label: "Box 1" }`.
- `#status` has class `ok`.

**Variant (data-driven):** repeat for each option — `rounded`/`rounded`,
`stadium`/`stadium`, `circle`/`circle`, `diamond`/`diam`, `hexagon`/`hex` — asserting
the matching `shape: <short>` token appears and the diagram stays valid.

---

## Story 4 — Drag a specific shape straight from the palette

**As** a user, **I want** to drag the Diamond tile **so that** the new node is a
diamond without extra clicks.

**Steps**
1. Drag the "Diamond" palette tile to ~(300, 200).
2. Select it and open the inspector.

**Assertions**
- The created node's main element is a `polygon` (4 points).
- `#inspector select` value is `diamond`.
- After **Generate**, `#md` contains `@{ shape: diam`.

---

## Story 5 — Edit and clear an arrow label

**As** a user, **I want** to label an arrow **so that** the edge has meaning, and
the label appears in the markdown.

**Steps**
1. Build the Story-2 graph (two attached boxes).
2. Select the arrow, type `yes` into the inspector label field.
3. Click **Generate**.
4. Clear the label (empty the field), click **Generate** again.

**Assertions**
- After step 2: a `text.edge-label` with text `yes` is visible on the canvas.
- After step 3: `#md` contains `-->|yes|`.
- After step 4: the `text.edge-label` is gone and `#md` contains a bare `-->`
  (no `|yes|`).

---

## Story 6 — Multi-select with a marquee and group-drag

**As** a user, **I want** to select several boxes by dragging a box around them and
move them together **so that** I can rearrange quickly.

**Steps**
1. Drop three boxes at roughly (200,150), (350,150), (500,150).
2. On empty canvas, mouse-press at (150,100) and drag to (560,220), then release
   (rubber-band over all three).
3. Read each box's current `x` (e.g. from the SVG attributes).
4. Press on one selected box and drag it +120px in x, release.

**Assertions**
- After step 2: all three `.node-rect` have the `selected` class; `#inspector`
  shows `3 boxes selected`.
- After step 4: **all three** boxes moved by ~+120px (group moved together), not
  just the dragged one.

---

## Story 7 — Shift-click toggles selection

**As** a user, **I want** to add/remove boxes from a selection with Shift **so that**
I can fine-tune a multi-selection.

**Steps**
1. Drop two boxes.
2. Click box A (single select).
3. Shift-click box B (both selected).
4. Shift-click box B again (B removed).

**Assertions**
- After step 3: `#inspector` shows `2 boxes selected`; both have `.selected`.
- After step 4: `#inspector` shows `Box`; only A has `.selected`.

---

## Story 8 — Delete removes nodes and detaches their arrows

**As** a user, **I want** deleting a box to clean up **so that** no dangling
references remain.

**Steps**
1. Build the Story-2 graph (Box 1 → Box 2, both ends attached).
2. Select `Box 2`, press `Delete`.
3. Click **Generate**.

**Assertions**
- One `.node-rect` remains.
- The arrow still exists (`path.edge-line`) but its head endpoint no longer has
  `.attached` (it was frozen free near the old anchor).
- `#md` has one node line and **no** `-->` edge line (an edge only emits when both
  ends are attached).

---

## Story 9 — Persistence across reload

**As** a user, **I want** my diagram to survive a refresh **so that** I don't lose
work.

**Steps**
1. Drop two boxes and an arrow; attach the arrow to both.
2. Reload the page.

**Assertions**
- Two `.node-rect` and one `path.edge-line` render after reload.
- Both endpoints are still `.attached`.

---

## Story 10 — Export then import round-trips the diagram

**As** a user, **I want** to export and re-import JSON **so that** I can share/back
up diagrams.

**Steps**
1. Build a small graph (e.g. a cylinder + a diamond + an arrow).
2. Click **Export JSON** and capture the download.
3. Click **Clear canvas** (canvas empties).
4. Click **Import JSON** and supply the downloaded file (`#import-file`).

**Assertions**
- After step 3: zero `.node-rect`.
- After step 4: node/edge counts and shapes match the pre-export graph; a
  follow-up **Generate** yields `#status.ok`.

---

## Story 11 — Invalid label still validates (escaping)

**As** a user, **I want** to type quotes/pipes in labels **so that** they don't break
the diagram.

**Steps**
1. Drop a box, set its label to `He said "hi" | bye`.
2. Set a connected arrow's label to `a|b "c"`.
3. Click **Generate**.

**Assertions**
- `#status` has class `ok` (escaping kept the markdown valid).
- `#md` contains the escaped forms (`&quot;`, and `&#124;` inside the edge label).

---

## Appendix — native drag-and-drop helper (palette → canvas)

Native HTML5 DnD needs a shared `DataTransfer`. A reusable Playwright helper:

```ts
async function paletteDrop(page, tileText: string, x: number, y: number) {
  const tile = page.locator('.palette-item', { hasText: tileText });
  const canvas = page.locator('#canvas');
  const box = await canvas.boundingBox();
  await tile.dispatchEvent('dragstart', { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  // simplest robust path: drive the app's drop handler directly
  await canvas.dispatchEvent('drop', {
    clientX: box!.x + x,
    clientY: box!.y + y,
    dataTransfer: await page.evaluateHandle(({ tool, shape }) => {
      const dt = new DataTransfer();
      dt.setData('text/tool', tool);
      if (shape) dt.setData('text/shape', shape);
      return dt;
    }, { tool: 'box', shape: 'rect' }),
  });
}
```

> Note: `text/tool` is `box` or `arrow`; `text/shape` is one of
> `rect|rounded|stadium|circle|diamond|hexagon|cylinder`. For canvas-internal
> drags (moving nodes, dragging endpoints, marquee) use `page.mouse` with
> `mousedown → mousemove → mouseup`, since those handlers listen on `document`,
> not via HTML5 DnD.
