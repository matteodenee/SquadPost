import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('présente une inscription réservée aux joueurs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Créer un compte' }));

    expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument();
    expect(
      screen.getByText('Votre nouveau compte sera créé avec le rôle Joueur.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeInTheDocument();
    expect(screen.queryByText('Responsable communication')).not.toBeInTheDocument();
  });

  it('inscrit un joueur puis affiche son profil', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 'player-1',
              email: 'nouveau@squadpost.local',
              role: 'PLAYER',
              permissions: ['profile:read:self'],
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Créer un compte' }));
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'nouveau@squadpost.local' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'Un-mot-de-passe-2026!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'Un-mot-de-passe-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte joueur' }));

    expect(await screen.findByRole('heading', { name: 'Mon profil' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nouveau@squadpost.local',
        password: 'Un-mot-de-passe-2026!',
      }),
    });
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
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const body = url.startsWith('/api/admin/users')
        ? { users: [] }
        : {
            user: {
              id: 'user-1',
              email: 'test@squadpost.local',
              firstName: null,
              lastName: null,
              role,
              permissions: permissionsByRole[role],
            },
          };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(roleLabel)).toBeInTheDocument();
    expect(screen.getByText(permissionLabel)).toBeInTheDocument();
  });
});
