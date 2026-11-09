import { expect, test } from '@playwright/test';

test('affiche la page de connexion SquadPost', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 401 }));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
});

test('permet d’ouvrir le formulaire de création d’un compte joueur', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 401 }));
  await page.goto('/');

  await page.getByRole('button', { name: 'Créer un compte' }).click();

  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
  await expect(page.getByText('Votre nouveau compte sera créé avec le rôle Joueur.')).toBeVisible();
  await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
});
