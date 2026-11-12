import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { CompetitionsPanel } from './CompetitionsPanel';

const club = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Barbarians Montpellier',
  shortName: 'BMR',
  primaryColor: '#A91234',
  secondaryColor: '#FFFFFF',
  primarySport: { code: 'RUGBY', name: 'Rugby' },
};
const format = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'RUGBY_10',
  name: 'Rugby à 10',
  defaultStarterCount: 10,
  defaultFinisherCount: 5,
  sport: { id: 'sport-id', code: 'RUGBY', name: 'Rugby' },
};
const competition = {
  id: '44444444-4444-4444-8444-444444444444',
  clubId: club.id,
  name: 'Championnat universitaire',
  starterCount: 12,
  finisherCount: 6,
  active: true,
  sportFormat: format,
  seasons: [],
};

afterEach(() => vi.restoreAllMocks());

describe('CompetitionsPanel', () => {
  it('préremplit la déclinaison puis permet de personnaliser la compétition', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (options?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify({ competition }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      const body = url === '/api/sport-formats' ? { formats: [format] } : { competitions: [] };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<CompetitionsPanel club={club} onBack={vi.fn()} />);
    await screen.findByText('Aucune compétition créée pour ce club.');
    fireEvent.click(screen.getByRole('button', { name: 'Créer une compétition' }));
    fireEvent.change(screen.getByLabelText('Nom de la compétition'), {
      target: { value: 'Championnat universitaire' },
    });
    fireEvent.change(screen.getByLabelText('Sport et déclinaison'), {
      target: { value: format.id },
    });
    expect(screen.getByLabelText('Nombre de titulaires')).toHaveValue(10);
    expect(screen.getByLabelText('Nombre de finisseurs')).toHaveValue(5);
    fireEvent.change(screen.getByLabelText('Nombre de titulaires'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Nombre de finisseurs'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la compétition' }));

    expect(await screen.findByText('Compétition créée.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clubs/${club.id}/competitions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Championnat universitaire',
          sportFormatId: format.id,
          starterCount: 12,
          finisherCount: 6,
        }),
      }),
    );
  });

  it('ajoute une saison avec des dates facultatives', async () => {
    const season = {
      id: '55555555-5555-4555-8555-555555555555',
      label: '2026-2027',
      startDate: null,
      endDate: null,
      active: true,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (options?.method === 'POST') {
        return Promise.resolve(
          new Response(JSON.stringify({ season }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      const body =
        url === '/api/sport-formats' ? { formats: [format] } : { competitions: [competition] };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(<CompetitionsPanel club={club} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Configurer et voir les saisons' }));
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: '2026-2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la saison' }));

    expect(await screen.findByText('Saison ajoutée.')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/clubs/${club.id}/competitions/${competition.id}/seasons`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ label: '2026-2027', startDate: null, endDate: null }),
        }),
      ),
    );
  });
});
