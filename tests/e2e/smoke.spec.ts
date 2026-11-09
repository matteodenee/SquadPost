import { expect, test } from '@playwright/test';

test('affiche la page de connexion SquadPost', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 401 }));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
});
