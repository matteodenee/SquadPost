import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { MatchesPanel } from './MatchesPanel';

const club = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Barbarians Montpellier',
  shortName: 'BMR',
  primaryColor: '#A91234',
  secondaryColor: '#FFFFFF',
  primarySport: { code: 'RUGBY', name: 'Rugby' },
};
const opponent = {
  id: 'opponent-id',
  clubId: club.id,
  name: 'MHR',
  shortName: 'MHR',
  primaryColor: null,
  secondaryColor: null,
  active: true,
};
const competition = {
  id: 'competition-id',
  name: 'Championnat',
  active: true,
  seasons: [{ id: 'season-id', label: '2026-2027', active: true }],
};

afterEach(() => vi.restoreAllMocks());

describe('MatchesPanel', () => {
  it('crée un adversaire dans le club actif', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (options?.method === 'POST')
        return Promise.resolve(
          new Response(JSON.stringify({ opponent }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      const body = url.endsWith('/opponents')
        ? { opponents: [] }
        : url.endsWith('/matches')
          ? { matches: [] }
          : { competitions: [competition] };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    render(<MatchesPanel club={club} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Adversaires' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un adversaire' }));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'MHR' } });
    fireEvent.change(screen.getByLabelText('Nom court'), { target: { value: 'MHR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’adversaire' }));
    expect(await screen.findByText('Adversaire ajouté.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clubs/${club.id}/opponents`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('crée un match rattaché à une saison et un adversaire', async () => {
    const match = {
      id: 'match-id',
      clubId: club.id,
      round: 'Journée 4',
      scheduledAt: null,
      venue: 'Stade municipal',
      location: 'HOME',
      status: 'UPCOMING',
      clubScore: 24,
      opponentScore: 17,
      starterCount: 12,
      finisherCount: 6,
      sportName: 'Rugby',
      formatName: 'Rugby à 10',
      opponent,
      season: {
        id: 'season-id',
        label: '2026-2027',
        competition: { id: 'competition-id', name: 'Championnat' },
      },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (options?.method === 'POST')
        return Promise.resolve(
          new Response(JSON.stringify({ match }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      const body = url.endsWith('/opponents')
        ? { opponents: [opponent] }
        : url.endsWith('/matches')
          ? { matches: [] }
          : { competitions: [competition] };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    render(<MatchesPanel club={club} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un match' }));
    fireEvent.change(screen.getByLabelText('Saison'), { target: { value: 'season-id' } });
    fireEvent.change(screen.getByLabelText('Adversaire'), { target: { value: 'opponent-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le match' }));
    expect(await screen.findByText('Match créé.')).toBeInTheDocument();
    expect(screen.getByText(/12 titulaires/)).toBeInTheDocument();
    expect(screen.getByText('Journée 4 · Stade municipal · Domicile')).toBeInTheDocument();
    expect(screen.getByText('Score · 24 – 17')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Annulé' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clubs/${club.id}/matches`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
