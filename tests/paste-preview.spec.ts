import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('pasting mermaid into the textarea renders a live preview', async ({ page }) => {
  await page
    .locator('#md')
    .fill('flowchart TD\n    a["Hello"] --> b["World"]');

  await expect(page.locator('#status')).toHaveClass(/ok/);
  await expect(page.locator('#preview svg')).toBeVisible();
  await expect(page.locator('#preview')).toContainText('Hello');
  // a pasted diagram can be exported too
  await expect(page.locator('#save-svg-btn')).toBeEnabled();
});

test('invalid pasted mermaid shows the parse error', async ({ page }) => {
  await page.locator('#md').fill('flowchart TD\n    a -->');

  await expect(page.locator('#status')).toHaveClass(/err/);
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await expect(page.locator('#save-svg-btn')).toBeDisabled();
});

test('emptying the textarea clears the preview', async ({ page }) => {
  await page.locator('#md').fill('flowchart TD\n    a --> b');
  await expect(page.locator('#preview svg')).toBeVisible();

  await page.locator('#md').fill('');
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await expect(page.locator('#status')).toHaveText('');
  await expect(page.locator('#save-svg-btn')).toBeDisabled();
});

test('fixing invalid mermaid recovers the preview', async ({ page }) => {
  await page.locator('#md').fill('flowchart TD\n    a -->');
  await expect(page.locator('#status')).toHaveClass(/err/);

  await page.locator('#md').fill('flowchart TD\n    a --> b');
  await expect(page.locator('#status')).toHaveClass(/ok/);
  await expect(page.locator('#preview svg')).toBeVisible();
});
