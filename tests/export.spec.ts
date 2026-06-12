import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { buildAttachedGraph, generate, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Save SVG downloads the rendered preview as a standalone file', async ({ page }) => {
  await expect(page.locator('#save-svg-btn')).toBeDisabled();

  await buildAttachedGraph(page);
  await generate(page);
  await expect(page.locator('#save-svg-btn')).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-svg-btn').click();
  const dl = await downloadPromise;
  expect(dl.suggestedFilename()).toBe('diagram.svg');

  const content = readFileSync((await dl.path())!, 'utf8');
  expect(content).toContain('<svg');
  expect(content).toContain('Box 1'); // node labels survive serialization
  expect(content).toMatch(/<svg[^>]*width="\d+"/); // explicit natural size
});

test('Clear canvas disables Save SVG again', async ({ page }) => {
  await buildAttachedGraph(page);
  await generate(page);
  await expect(page.locator('#save-svg-btn')).toBeEnabled();

  await page.locator('#clear-btn').click();
  await expect(page.locator('#save-svg-btn')).toBeDisabled();
});
