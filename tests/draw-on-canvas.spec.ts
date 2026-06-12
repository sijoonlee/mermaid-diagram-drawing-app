import { expect, test } from '@playwright/test';
import { dropBox, generate, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

const FLOW = 'flowchart TD\n    a["Start"] --> b{"Choose"}\n    b -->|yes| c["Done"]';

test('Draw on canvas builds editable boxes and arrows from text', async ({ page }) => {
  await page.locator('#md').fill(FLOW);
  await page.locator('#draw-btn').click();

  await expect(page.locator('#status')).toHaveText('✓ Drew 3 boxes and 2 arrows');
  await expect(page.locator('.node-rect')).toHaveCount(3);
  await expect(page.locator('polygon.node-rect')).toHaveCount(1); // the diamond
  await expect(page.locator('path.edge-line')).toHaveCount(2);
  await expect(page.locator('.endpoint.attached')).toHaveCount(4);
  await expect(page.locator('text.edge-label')).toHaveText('yes');
  await expect(page.locator('text.node-label').first()).toHaveText('Start');
});

test('a drawn diagram round-trips through Generate', async ({ page }) => {
  await page.locator('#md').fill(FLOW);
  await page.locator('#draw-btn').click();

  const md = await generate(page);
  expect(md).toContain('a --> b');
  expect(md).toContain('b -->|yes| c');
  expect(md).toContain('a["Start"]');
  await expect(page.locator('#status')).toHaveClass(/ok/);
});

test('Draw keeps the position of a box that is already on the canvas', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);
  await generate(page);
  const before = await page.locator('.node-rect').boundingBox();

  const md = await page.locator('#md').inputValue();
  await page.locator('#md').fill(md.replace('Box 1', 'Renamed'));
  await page.locator('#draw-btn').click();

  await expect(page.locator('text.node-label')).toHaveText('Renamed');
  const after = await page.locator('.node-rect').boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
});

test('typed mermaid shapes map onto canvas shapes', async ({ page }) => {
  await page.locator('#md').fill('flowchart TD\n    d@{ shape: cyl, label: "DB" }');
  await page.locator('#draw-btn').click();

  await expect(page.locator('#canvas path.node-rect')).toHaveCount(1); // cylinder body
  await expect(page.locator('#canvas .node-deco')).toHaveCount(1); // cylinder rim
  await expect(page.locator('text.node-label')).toHaveText('DB');
});

test('Draw rejects non-flowchart diagrams with a readable error', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);
  await page.locator('#md').fill('sequenceDiagram\n    Alice->>Bob: hi');
  await page.locator('#draw-btn').click();

  await expect(page.locator('#status')).toHaveClass(/err/);
  await expect(page.locator('#status')).toContainText('Only flowcharts');
  // the canvas must be untouched by the failed draw
  await expect(page.locator('.node-rect')).toHaveCount(1);
});
