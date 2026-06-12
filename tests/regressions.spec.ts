import { expect, test } from '@playwright/test';
import {
  canvasPoint,
  clickCanvas,
  dragMouse,
  dropArrow,
  dropBox,
  generate,
  openApp,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('double-click renames a box', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);

  page.on('dialog', (d) => d.accept('Renamed'));
  const p = await canvasPoint(page, 300, 200);
  await page.mouse.dblclick(p.x, p.y);

  await expect(page.locator('text.node-label')).toHaveText('Renamed');
  // the inspector shows the selected box and must pick up the new name too
  await expect(page.locator('#inspector input[type=text]')).toHaveValue('Renamed');
});

test('double-click labels an arrow', async ({ page }) => {
  await dropArrow(page, 250, 300);

  page.on('dialog', (d) => d.accept('yes'));
  const p = await canvasPoint(page, 250, 300);
  await page.mouse.dblclick(p.x, p.y);

  await expect(page.locator('text.edge-label')).toHaveText('yes');
});

test('inspector follows endpoint attachment made on the canvas', async ({ page }) => {
  await dropBox(page, 'rect', 250, 150);
  await dropArrow(page, 250, 300);

  await clickCanvas(page, 250, 300);
  await expect(page.locator('#inspector h3')).toHaveText('Arrow');
  await expect(page.locator('#inspector .insp-row').last()).toContainText('unattached');

  // drag the head endpoint onto Box 1's bottom anchor
  await dragMouse(page, await canvasPoint(page, 300, 300), await canvasPoint(page, 250, 180));
  await expect(page.locator('.endpoint.attached')).toHaveCount(1);

  await expect(page.locator('#inspector .insp-row').last()).toContainText('Box 1');
});

test('Backspace inside the shape dropdown does not delete the box', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);
  await clickCanvas(page, 300, 200);
  await expect(page.locator('#inspector h3')).toHaveText('Box');

  await page.locator('#inspector select').focus();
  await page.keyboard.press('Backspace');

  await expect(page.locator('.node-rect')).toHaveCount(1);
});

test('empty box label still generates valid mermaid', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);
  await clickCanvas(page, 300, 200);
  await page.locator('#inspector input[type=text]').fill('');

  const md = await generate(page);
  expect(md).toMatch(/n\d+\["n\d+"\]/); // label falls back to the node id
  await expect(page.locator('#status')).toHaveClass(/ok/);
});

test('invalid import is rejected without corrupting the diagram', async ({ page }) => {
  await dropBox(page, 'rect', 300, 200);

  const badFiles = [
    '{"nodes":[{"bogus":true}],"edges":[]}', // node without id/label/coords
    '{"nodes":[{"id":"n9","label":"a"}],"edges":[]}', // node without x/y/w/h
    '{"nodes":[],"edges":[{"id":"e1","source":{"kind":"attached","nodeId":"ghost","side":"top"},"target":{"kind":"free","x":0,"y":0}}]}', // edge attached to a missing node
  ];
  for (const json of badFiles) {
    const rejected = await page.evaluate((content) => {
      return new Promise<boolean>((resolve) => {
        const input = document.getElementById('import-file') as HTMLInputElement;
        const dt = new DataTransfer();
        dt.items.add(new File([content], 'd.json', { type: 'application/json' }));
        input.files = dt.files;
        window.alert = () => resolve(true); // alert means load() returned false
        input.dispatchEvent(new Event('change'));
        setTimeout(() => resolve(false), 700);
      });
    }, json);
    expect(rejected).toBe(true);
  }

  // the existing diagram must be untouched by the failed imports
  await expect(page.locator('.node-rect')).toHaveCount(1);
  await expect(page.locator('text.node-label')).toHaveText('Box 1');
});
