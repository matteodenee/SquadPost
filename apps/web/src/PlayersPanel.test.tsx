import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { PlayersPanel } from './PlayersPanel';

const club = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Barbarians Montpellier',
  shortName: 'BMR',
  primaryColor: '#A91234',
  secondaryColor: '#FFFFFF',
  primarySport: { code: 'RUGBY', name: 'Rugby' },
};

const player = {
  id: '33333333-3333-4333-8333-333333333333',
  clubId: club.id,
  userId: null,
  firstName: 'Lina',
  lastName: 'Martin',
  primaryPosition: 'Ailière',
  usualJerseyNumber: 11,
  active: true,
  compositionPhoto: null,
};

beforeEach(() => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PlayersPanel', () => {
  it('crée une fiche sans compte et recherche dans le club actif', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify({ player }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ players: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<PlayersPanel club={club} onBack={vi.fn()} />);
    await screen.findByText('Aucun joueur dans cet effectif.');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un joueur' }));
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Lina' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Martin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la fiche' }));

    expect(await screen.findByText('Joueur ajouté à l’effectif.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clubs/${club.id}/players`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Lina',
          lastName: 'Martin',
          primaryPosition: null,
          usualJerseyNumber: null,
        }),
      }),
    );

    fireEvent.change(screen.getByLabelText('Rechercher par prénom, nom ou poste'), {
      target: { value: 'ailière' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/clubs/${club.id}/players?search=aili%C3%A8re`, {
        credentials: 'include',
      }),
    );
  });

  it('prévisualise puis envoie le fichier original en multipart', async () => {
    const uploaded = {
      ...player,
      compositionPhoto: {
        mimeType: 'image/png',
        width: 10,
        height: 10,
        hasAlpha: true,
        url: '/api/player-photo',
      },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      if (options?.method === 'POST')
        return Promise.resolve(
          new Response(JSON.stringify({ player: uploaded }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      return Promise.resolve(
        new Response(JSON.stringify({ players: [player] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<PlayersPanel club={club} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Consulter / modifier' }));
    expect(screen.getByText(/Pour un meilleur rendu sur vos compositions/)).toHaveTextContent(
      'remove.bg',
    );
    const file = new File(['png-binary'], 'lina.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choisir une photo'), { target: { files: [file] } });
    expect(await screen.findByRole('img', { name: 'Aperçu de Lina Martin' })).toHaveAttribute(
      'src',
      'blob:preview',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la photo' }));

    await waitFor(() => {
      const uploadCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
      expect((uploadCall?.[1]?.body as FormData).get('photo')).toBe(file);
    });
  });

  it('recharge un effectif isolé lors du changement de club', async () => {
    const secondClub = { ...club, id: '44444444-4444-4444-8444-444444444444', name: 'Autre club' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ players: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const view = render(<PlayersPanel club={club} onBack={vi.fn()} />);
    await screen.findByText('Aucun joueur dans cet effectif.');
    view.rerender(<PlayersPanel club={secondClub} onBack={vi.fn()} />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/clubs/${secondClub.id}/players`, {
        credentials: 'include',
      }),
    );
  });
});
