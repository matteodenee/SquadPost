import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { ClubsPanel } from './ClubsPanel';

const club = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Barbarians Montpellier',
  shortName: 'Barbarians',
  primaryColor: '#A91234',
  secondaryColor: '#FFFFFF',
  primarySport: { code: 'RUGBY', name: 'Rugby' },
};

afterEach(() => vi.restoreAllMocks());

describe('ClubsPanel', () => {
  it('permet à PLAYER de rejoindre un club sans proposer sa création', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ clubs: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ club }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    render(<ClubsPanel role="PLAYER" />);
    await screen.findByText('Vous n’êtes encore membre d’aucun club.');
    expect(screen.queryByRole('button', { name: 'Créer un club' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Jeton d’invitation'), {
      target: { value: 'a'.repeat(43) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le club' }));

    expect(
      await screen.findByText('Vous avez rejoint Barbarians Montpellier.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/club-invitations/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'a'.repeat(43) }),
      }),
    );
  });

  it('permet à COM_MANAGER de créer un club', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/clubs' && options?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify({ club }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.includes('/invitations')) {
        return Promise.resolve(
          new Response(JSON.stringify({ invitations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ clubs: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<ClubsPanel role="COM_MANAGER" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un club' }));
    fireEvent.change(screen.getByLabelText('Nom du club'), {
      target: { value: 'Barbarians Montpellier' },
    });
    fireEvent.change(screen.getByLabelText('Nom court'), {
      target: { value: 'Barbarians' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le club' }));

    expect(
      await screen.findByText('Club créé. Vous pouvez maintenant inviter ses membres.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/clubs',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
