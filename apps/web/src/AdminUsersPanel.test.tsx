import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { AdminUsersPanel } from './AdminUsersPanel';

const player = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'camille@squadpost.local',
  firstName: 'Camille',
  lastName: 'Joueur',
  role: 'PLAYER',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('AdminUsersPanel', () => {
  it('affiche la liste et recherche par nom ou e-mail', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [player] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<AdminUsersPanel currentUserId="admin-id" />);
    expect(await screen.findByText('Camille Joueur')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rechercher par nom ou e-mail'), {
      target: { value: 'camille' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/users?search=camille', {
        credentials: 'include',
      }),
    );
  });

  it('utilise une action et une confirmation dédiées pour promouvoir un ADMIN', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ users: [player] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { ...player, role: 'ADMIN' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AdminUsersPanel currentUserId="admin-id" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gérer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Promouvoir ADMIN' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/admin/users/${player.id}/promote-admin`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ confirmation: 'PROMOUVOIR ADMIN' }),
      }),
    );
    expect(window.confirm).toHaveBeenCalledOnce();
  });
});
