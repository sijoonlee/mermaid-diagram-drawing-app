import { expect, type Page } from '@playwright/test';

export const STORAGE_KEY = 'mermaid-draw:diagram';

/** Open a clean app: empty store, palette ready. */
export async function openApp(page: Page) {
  await page.goto('/');
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('#palette-items .palette-item').first()).toBeVisible();
}

/** Canvas-local (x,y) -> absolute page coordinates. */
export async function canvasPoint(page: Page, x: number, y: number) {
  const box = await page.locator('#canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  return { x: box.x + x, y: box.y + y };
}

/**
 * Palette -> canvas uses native HTML5 DnD. Playwright's dragTo is unreliable for
 * that, so we dispatch a `drop` carrying a real DataTransfer at a canvas point.
 */
async function dropTool(page: Page, tool: 'box' | 'arrow', shape: string | null, x: number, y: number) {
  const canvas = page.locator('#canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found');
  const dataTransfer = await page.evaluateHandle(
    ({ tool, shape }) => {
      const dt = new DataTransfer();
      dt.setData('text/tool', tool);
      if (shape) dt.setData('text/shape', shape);
      return dt;
    },
    { tool, shape },
  );
  await canvas.dispatchEvent('drop', {
    dataTransfer,
    clientX: box.x + x,
    clientY: box.y + y,
  });
}

export const dropBox = (page: Page, shape: string, x: number, y: number) =>
  dropTool(page, 'box', shape, x, y);

export const dropArrow = (page: Page, x: number, y: number) =>
  dropTool(page, 'arrow', null, x, y);

/** Canvas-internal drag (moving nodes / endpoints / marquee) via real mouse events. */
export async function dragMouse(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { shift?: boolean } = {},
) {
  if (opts.shift) await page.keyboard.down('Shift');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  if (opts.shift) await page.keyboard.up('Shift');
}

/** Click a canvas point (selects whatever node/edge is there). */
export async function clickCanvas(page: Page, x: number, y: number, opts: { shift?: boolean } = {}) {
  const p = await canvasPoint(page, x, y);
  // page.mouse.click has no modifiers option, so hold Shift via the keyboard.
  if (opts.shift) await page.keyboard.down('Shift');
  await page.mouse.click(p.x, p.y);
  if (opts.shift) await page.keyboard.up('Shift');
}

/**
 * Build the headline graph: Box 1 (top) --> Box 2 (bottom), arrow attached at
 * Box 1's bottom and Box 2's top. Returns the key canvas-local coordinates.
 */
export async function buildAttachedGraph(page: Page) {
  await dropBox(page, 'rect', 250, 150); // Box 1, spans (190,120)-(310,180)
  await dropArrow(page, 250, 300); //        endpoints at (200,300) tail, (300,300) head
  await dropBox(page, 'rect', 250, 450); // Box 2, spans (190,420)-(310,480)

  // head (target) -> Box 2 top anchor
  await dragMouse(page, await canvasPoint(page, 300, 300), await canvasPoint(page, 250, 420));
  // tail (source) -> Box 1 bottom anchor
  await dragMouse(page, await canvasPoint(page, 200, 300), await canvasPoint(page, 250, 180));

  await expect(page.locator('.endpoint.attached')).toHaveCount(2);
}

export async function generate(page: Page) {
  await page.locator('#generate-btn').click();
  return page.locator('#md').inputValue();
}
