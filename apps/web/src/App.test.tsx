import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('affiche la connexion lorsque la session est absente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse e-mail')).toBeInTheDocument();
  });

  it.each([
    ['PLAYER', 'Mon profil', 'Joueur', 'Voir mes propres informations'],
    [
      'COM_MANAGER',
      'Tableau de bord communication',
      'Responsable communication',
      'Gérer les joueurs',
    ],
    [
      'ADMIN',
      'Administration SquadPost',
      'Administrateur SquadPost',
      'Attribuer ou changer un rôle',
    ],
  ])('affiche le bon espace pour le rôle %s', async (role, heading, roleLabel, permissionLabel) => {
    const permissionsByRole: Record<string, string[]> = {
      PLAYER: ['profile:read:self'],
      COM_MANAGER: ['dashboard:access', 'players:manage'],
      ADMIN: ['dashboard:access', 'users:assign-role'],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'test@squadpost.local',
            role,
            permissions: permissionsByRole[role],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(roleLabel)).toBeInTheDocument();
    expect(screen.getByText(permissionLabel)).toBeInTheDocument();
  });
});
