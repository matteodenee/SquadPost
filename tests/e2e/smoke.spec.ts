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

test('affiche la gestion des utilisateurs uniquement dans le dashboard ADMIN', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'admin@squadpost.local',
          firstName: 'Alex',
          lastName: 'Admin',
          role: 'ADMIN',
          permissions: ['dashboard:access', 'users:read'],
        },
      }),
    }),
  );
  await page.route('**/api/admin/users', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            email: 'player@squadpost.local',
            firstName: 'Camille',
            lastName: 'Joueur',
            role: 'PLAYER',
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    }),
  );

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Administration SquadPost' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible();
  await expect(page.getByText('Camille Joueur')).toBeVisible();
});
