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

test('affiche les clubs et les invitations dans le dashboard COM_MANAGER', async ({ page }) => {
  const clubId = '22222222-2222-4222-8222-222222222222';
  await page.route('**/api/auth/me', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'communication@squadpost.local',
          firstName: 'Morgan',
          lastName: 'Communication',
          role: 'COM_MANAGER',
          permissions: ['dashboard:access'],
        },
      }),
    }),
  );
  await page.route('**/api/clubs', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        clubs: [
          {
            id: clubId,
            name: 'Barbarians Montpellier',
            shortName: 'Barbarians',
            primaryColor: '#A91234',
            secondaryColor: '#FFFFFF',
            primarySport: { code: 'RUGBY', name: 'Rugby' },
          },
        ],
      }),
    }),
  );
  await page.route(`**/api/clubs/${clubId}/invitations`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ invitations: [] }),
    }),
  );
  await page.route(`**/api/clubs/${clubId}/players`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        players: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            clubId,
            userId: null,
            firstName: 'Lina',
            lastName: 'Martin',
            primaryPosition: 'Ailière',
            usualJerseyNumber: 11,
            active: true,
            compositionPhoto: null,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/sport-formats', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        formats: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            code: 'RUGBY_10',
            name: 'Rugby à 10',
            defaultStarterCount: 10,
            defaultFinisherCount: 5,
            sport: { id: 'sport-id', code: 'RUGBY', name: 'Rugby' },
          },
        ],
      }),
    }),
  );
  await page.route(`**/api/clubs/${clubId}/competitions`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ competitions: [] }),
    }),
  );

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Tableau de bord communication' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mes clubs' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Barbarians Montpellier/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer un club' })).toBeVisible();
  await expect(page.getByLabel('E-mail du membre à inviter')).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir l’effectif' }).click();
  await expect(
    page.getByRole('heading', { name: 'Effectif de Barbarians Montpellier' }),
  ).toBeVisible();
  await expect(page.getByText('Lina Martin')).toBeVisible();
  await page.getByRole('button', { name: 'Retour aux clubs' }).click();
  await page.getByRole('button', { name: 'Compétitions et saisons' }).click();
  await expect(page.getByRole('heading', { name: 'Compétitions et saisons' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer une compétition' })).toBeVisible();
});
