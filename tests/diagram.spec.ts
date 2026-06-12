import { expect, test } from '@playwright/test';
import {
  buildAttachedGraph,
  canvasPoint,
  clickCanvas,
  dragMouse,
  dropBox,
  dropArrow,
  generate,
  openApp,
  STORAGE_KEY,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Story 1: create a box from the palette', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);

  await expect(page.locator('.node-rect')).toHaveCount(1);
  await expect(page.locator('text.node-label')).toHaveText('Box 1');

  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || '{}'),
    STORAGE_KEY,
  );
  expect(stored.nodes).toHaveLength(1);
});

test('Story 2: two boxes + arrow generate validated mermaid', async ({ page }) => {
  await buildAttachedGraph(page);

  const md = await generate(page);
  expect(md).toContain('flowchart TD');
  expect(md).toMatch(/n\d+ --> n\d+/);

  await expect(page.locator('#status')).toHaveClass(/ok/);
  await expect(page.locator('#preview svg')).toBeVisible();
});

test('Story 3: change a box shape to cylinder', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);
  await clickCanvas(page, 300, 200);

  await expect(page.locator('#inspector h3')).toHaveText('Box');
  await page.locator('#inspector select').selectOption('cylinder');

  // main outline becomes a <path> and gets a rim decoration
  await expect(page.locator('#canvas path.node-rect')).toHaveCount(1);
  await expect(page.locator('#canvas .node-deco')).toHaveCount(1);

  const md = await generate(page);
  expect(md).toContain('@{ shape: cyl, label: "Box 1" }');
  await expect(page.locator('#status')).toHaveClass(/ok/);
});

test('Story 4: drag a diamond straight from the palette', async ({ page }) => {
  await dropBox(page, 'diamond', 300, 200);

  await expect(page.locator('#canvas polygon.node-rect')).toHaveCount(1);

  await clickCanvas(page, 300, 200);
  await expect(page.locator('#inspector select')).toHaveValue('diamond');

  const md = await generate(page);
  expect(md).toContain('@{ shape: diam');
});

test('Story 5: set and clear an edge label', async ({ page }) => {
  await buildAttachedGraph(page);

  // select the arrow by clicking its curve (stays near x=250 between the boxes)
  await clickCanvas(page, 250, 300);
  await expect(page.locator('#inspector h3')).toHaveText('Arrow');

  const label = page.locator('#inspector input[type=text]');
  await label.fill('yes');
  await expect(page.locator('text.edge-label')).toHaveText('yes');
  expect(await generate(page)).toContain('-->|yes|');

  await label.fill('');
  await expect(page.locator('text.edge-label')).toHaveCount(0);
  const md = await generate(page);
  expect(md).toMatch(/n\d+ --> n\d+/);
  expect(md).not.toContain('|yes|');
});

test('Story 6: marquee multi-select and group drag', async ({ page }) => {
  await dropBox(page, 'rect', 180, 150);
  await dropBox(page, 'rect', 360, 150);
  await dropBox(page, 'rect', 540, 150);

  // rubber-band over all three
  await dragMouse(page, await canvasPoint(page, 100, 90), await canvasPoint(page, 610, 210));
  await expect(page.locator('.node-rect.selected')).toHaveCount(3);
  await expect(page.locator('#inspector h3')).toHaveText('3 boxes selected');

  const before = await page.locator('.node-rect').first().boundingBox();

  // drag one selected box; the whole group should follow
  await dragMouse(page, await canvasPoint(page, 180, 150), await canvasPoint(page, 280, 150));

  const after = await page.locator('.node-rect').first().boundingBox();
  expect(after!.x - before!.x).toBeGreaterThan(80);
  await expect(page.locator('.node-rect.selected')).toHaveCount(3);
});

test('Story 7: shift-click toggles selection', async ({ page }) => {
  await dropBox(page, 'rect', 200, 150);
  await dropBox(page, 'rect', 450, 150);

  await clickCanvas(page, 200, 150);
  await expect(page.locator('#inspector h3')).toHaveText('Box');

  await clickCanvas(page, 450, 150, { shift: true });
  await expect(page.locator('#inspector h3')).toHaveText('2 boxes selected');
  await expect(page.locator('.node-rect.selected')).toHaveCount(2);

  await clickCanvas(page, 450, 150, { shift: true });
  await expect(page.locator('#inspector h3')).toHaveText('Box');
  await expect(page.locator('.node-rect.selected')).toHaveCount(1);
});

test('Story 8: deleting a box detaches its arrow', async ({ page }) => {
  await buildAttachedGraph(page);

  // select Box 2 (the lower box) and delete it
  await clickCanvas(page, 250, 450);
  await expect(page.locator('#inspector h3')).toHaveText('Box');
  await page.keyboard.press('Delete');

  await expect(page.locator('.node-rect')).toHaveCount(1);
  await expect(page.locator('path.edge-line')).toHaveCount(1); // arrow survives
  await expect(page.locator('.endpoint.attached')).toHaveCount(1); // only tail still attached

  const md = await generate(page);
  expect(md).not.toMatch(/-->/); // edge only emits when both ends are attached
});

test('Story 9: diagram persists across reload', async ({ page }) => {
  await buildAttachedGraph(page);
  await page.reload();

  await expect(page.locator('.node-rect')).toHaveCount(2);
  await expect(page.locator('path.edge-line')).toHaveCount(1);
  await expect(page.locator('.endpoint.attached')).toHaveCount(2);
});
