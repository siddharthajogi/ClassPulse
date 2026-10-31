import { test, expect } from '@playwright/test';

test('smoke test - landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ClassPulse/i);
});
