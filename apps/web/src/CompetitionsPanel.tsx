import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Club } from './ClubsPanel';

interface SportFormat {
  id: string;
  code: string;
  name: string;
  defaultStarterCount: number;
  defaultFinisherCount: number;
  sport: { id: string; code: string; name: string };
}

interface Season {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

interface Competition {
  id: string;
  clubId: string;
  name: string;
  starterCount: number;
  finisherCount: number;
  active: boolean;
  sportFormat: SportFormat;
  seasons: Season[];
}

interface CompetitionForm {
  name: string;
  sportFormatId: string;
  starterCount: string;
  finisherCount: string;
}

interface SeasonForm {
  label: string;
  startDate: string;
  endDate: string;
}

const EMPTY_COMPETITION: CompetitionForm = {
  name: '',
  sportFormatId: '',
  starterCount: '',
  finisherCount: '',
};
const EMPTY_SEASON: SeasonForm = { label: '', startDate: '', endDate: '' };

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message)
      ? body.message.join(' ')
      : (body.message ?? 'Une erreur est survenue.');
  } catch {
    return 'Une erreur est survenue.';
  }
}

export function CompetitionsPanel({ club, onBack }: { club: Club; onBack: () => void }) {
  const [formats, setFormats] = useState<SportFormat[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selected, setSelected] = useState<Competition | null>(null);
  const [competitionForm, setCompetitionForm] = useState<CompetitionForm>(EMPTY_COMPETITION);
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(EMPTY_SEASON);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [formatsResponse, competitionsResponse] = await Promise.all([
        fetch('/api/sport-formats', { credentials: 'include' }),
        fetch(`/api/clubs/${club.id}/competitions`, { credentials: 'include' }),
      ]);
      if (!formatsResponse.ok) throw new Error(await readError(formatsResponse));
      if (!competitionsResponse.ok) throw new Error(await readError(competitionsResponse));
      const formatsBody = (await formatsResponse.json()) as { formats: SportFormat[] };
      const competitionsBody = (await competitionsResponse.json()) as {
        competitions: Competition[];
      };
      setFormats(formatsBody.formats);
      setCompetitions(competitionsBody.competitions);
      setSelected((current) =>
        current
          ? (competitionsBody.competitions.find((item) => item.id === current.id) ?? null)
          : null,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [club.id]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function chooseFormat(formatId: string) {
    const format = formats.find((item) => item.id === formatId);
    setCompetitionForm((current) => ({
      ...current,
      sportFormatId: formatId,
      starterCount: format?.defaultStarterCount.toString() ?? '',
      finisherCount: format?.defaultFinisherCount.toString() ?? '',
    }));
  }

  function startEditing(competition: Competition) {
    setSelected(competition);
    setCompetitionForm({
      name: competition.name,
      sportFormatId: competition.sportFormat.id,
      starterCount: competition.starterCount.toString(),
      finisherCount: competition.finisherCount.toString(),
    });
    setSeasonForm(EMPTY_SEASON);
    setEditingSeason(null);
    setShowCreate(false);
    setError('');
    setNotice('');
  }

  function competitionPayload() {
    return {
      name: competitionForm.name,
      sportFormatId: competitionForm.sportFormatId,
      starterCount: Number(competitionForm.starterCount),
      finisherCount: Number(competitionForm.finisherCount),
    };
  }

  async function saveCompetition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        selected
          ? `/api/clubs/${club.id}/competitions/${selected.id}`
          : `/api/clubs/${club.id}/competitions`,
        {
          method: selected ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(competitionPayload()),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { competition: Competition };
      setCompetitions((current) =>
        selected
          ? current.map((item) => (item.id === body.competition.id ? body.competition : item))
          : [...current, body.competition],
      );
      setSelected(body.competition);
      setShowCreate(false);
      setNotice(selected ? 'Compétition modifiée.' : 'Compétition créée.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function changeCompetitionStatus(competition: Competition) {
    const action = competition.active ? 'désactiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} ${competition.name} ?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/clubs/${club.id}/competitions/${competition.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !competition.active }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { competition: Competition };
      setCompetitions((current) =>
        current.map((item) => (item.id === body.competition.id ? body.competition : item)),
      );
      if (selected?.id === body.competition.id) setSelected(body.competition);
      setNotice(body.competition.active ? 'Compétition réactivée.' : 'Compétition désactivée.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  function startEditingSeason(season: Season) {
    setEditingSeason(season);
    setSeasonForm({
      label: season.label,
      startDate: season.startDate ?? '',
      endDate: season.endDate ?? '',
    });
  }

  async function saveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const base = `/api/clubs/${club.id}/competitions/${selected.id}/seasons`;
      const response = await fetch(editingSeason ? `${base}/${editingSeason.id}` : base, {
        method: editingSeason ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: seasonForm.label,
          startDate: seasonForm.startDate || null,
          endDate: seasonForm.endDate || null,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { season: Season };
      const next = {
        ...selected,
        seasons: editingSeason
          ? selected.seasons.map((item) => (item.id === body.season.id ? body.season : item))
          : [...selected.seasons, body.season],
      };
      setSelected(next);
      setCompetitions((current) =>
        current.map((competition) => (competition.id === next.id ? next : competition)),
      );
      setSeasonForm(EMPTY_SEASON);
      setEditingSeason(null);
      setNotice(editingSeason ? 'Saison modifiée.' : 'Saison ajoutée.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function changeSeasonStatus(season: Season) {
    if (!selected) return;
    const action = season.active ? 'désactiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} la saison ${season.label} ?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/clubs/${club.id}/competitions/${selected.id}/seasons/${season.id}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !season.active }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { season: Season };
      const next = {
        ...selected,
        seasons: selected.seasons.map((item) => (item.id === body.season.id ? body.season : item)),
      };
      setSelected(next);
      setCompetitions((current) =>
        current.map((competition) => (competition.id === next.id ? next : competition)),
      );
      setNotice(body.season.active ? 'Saison réactivée.' : 'Saison désactivée.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="competitions-panel" aria-labelledby="competitions-title">
      <div className="competitions-panel__header">
        <div>
          <p className="panel-label">Club actif · {club.shortName}</p>
          <h3 id="competitions-title">Compétitions et saisons</h3>
          <p className="muted">
            Choisissez une déclinaison sportive, puis adaptez librement les titulaires et finisseurs
            pour cette compétition.
          </p>
        </div>
        <div className="competitions-panel__actions">
          <button className="button button--ghost" onClick={onBack} type="button">
            Retour aux clubs
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              setSelected(null);
              setCompetitionForm(EMPTY_COMPETITION);
              setShowCreate(true);
            }}
            type="button"
          >
            Créer une compétition
          </button>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}

      {(showCreate || selected) && (
        <div className="competition-editor">
          <div className="competition-editor__heading">
            <div>
              <p className="panel-label">{selected ? 'Configuration' : 'Nouvelle compétition'}</p>
              <h4>{selected?.name ?? 'Créer une compétition'}</h4>
            </div>
            <button
              className="table-action"
              onClick={() => {
                setSelected(null);
                setShowCreate(false);
              }}
              type="button"
            >
              Fermer
            </button>
          </div>
          <form className="competition-form" onSubmit={(event) => void saveCompetition(event)}>
            <label>
              Nom de la compétition
              <input
                maxLength={120}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, name: event.target.value })
                }
                required
                value={competitionForm.name}
              />
            </label>
            <label>
              Sport et déclinaison
              <select
                onChange={(event) => chooseFormat(event.target.value)}
                required
                value={competitionForm.sportFormatId}
              >
                <option value="">Choisir un format</option>
                {formats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.sport.name} · {format.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre de titulaires
              <input
                max={100}
                min={1}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, starterCount: event.target.value })
                }
                required
                type="number"
                value={competitionForm.starterCount}
              />
            </label>
            <label>
              Nombre de finisseurs
              <input
                max={100}
                min={0}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, finisherCount: event.target.value })
                }
                required
                type="number"
                value={competitionForm.finisherCount}
              />
            </label>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy ? 'Enregistrement…' : 'Enregistrer la compétition'}
            </button>
          </form>

          {selected && (
            <div className="seasons-editor">
              <div>
                <p className="panel-label">Historique</p>
                <h4>Saisons</h4>
              </div>
              <form className="season-form" onSubmit={(event) => void saveSeason(event)}>
                <label>
                  Libellé
                  <input
                    maxLength={80}
                    onChange={(event) =>
                      setSeasonForm({ ...seasonForm, label: event.target.value })
                    }
                    placeholder="2026-2027"
                    required
                    value={seasonForm.label}
                  />
                </label>
                <label>
                  Début facultatif
                  <input
                    onChange={(event) =>
                      setSeasonForm({ ...seasonForm, startDate: event.target.value })
                    }
                    type="date"
                    value={seasonForm.startDate}
                  />
                </label>
                <label>
                  Fin facultative
                  <input
                    onChange={(event) =>
                      setSeasonForm({ ...seasonForm, endDate: event.target.value })
                    }
                    type="date"
                    value={seasonForm.endDate}
                  />
                </label>
                <button className="button button--ghost" disabled={busy} type="submit">
                  {editingSeason ? 'Modifier la saison' : 'Ajouter la saison'}
                </button>
                {editingSeason && (
                  <button
                    className="table-action"
                    onClick={() => {
                      setEditingSeason(null);
                      setSeasonForm(EMPTY_SEASON);
                    }}
                    type="button"
                  >
                    Annuler la modification
                  </button>
                )}
              </form>
              <ul className="season-list">
                {selected.seasons.map((season) => (
                  <li className={season.active ? '' : 'is-disabled'} key={season.id}>
                    <span>
                      <strong>{season.label}</strong>
                      <small>
                        {season.startDate ?? 'Début libre'} → {season.endDate ?? 'Fin libre'}
                      </small>
                    </span>
                    <span
                      className={`status-pill status-pill--${season.active ? 'active' : 'disabled'}`}
                    >
                      {season.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="season-list__actions">
                      <button
                        className="table-action"
                        onClick={() => startEditingSeason(season)}
                        type="button"
                      >
                        Modifier
                      </button>
                      <button
                        className="table-action"
                        disabled={busy}
                        onClick={() => void changeSeasonStatus(season)}
                        type="button"
                      >
                        {season.active ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </span>
                  </li>
                ))}
                {selected.seasons.length === 0 && (
                  <li className="empty-state">Aucune saison enregistrée.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="competition-list" aria-label="Compétitions du club">
        {competitions.map((competition) => (
          <article className={competition.active ? '' : 'is-disabled'} key={competition.id}>
            <div>
              <p className="panel-label">{competition.sportFormat.sport.name}</p>
              <h4>{competition.name}</h4>
              <p className="muted">
                {competition.sportFormat.name} · {competition.starterCount} titulaires ·{' '}
                {competition.finisherCount} finisseurs
              </p>
              <span
                className={`status-pill status-pill--${competition.active ? 'active' : 'disabled'}`}
              >
                {competition.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="competition-list__actions">
              <button
                className="button button--ghost"
                onClick={() => startEditing(competition)}
                type="button"
              >
                Configurer et voir les saisons
              </button>
              <button
                className="table-action"
                disabled={busy}
                onClick={() => void changeCompetitionStatus(competition)}
                type="button"
              >
                {competition.active ? 'Désactiver' : 'Réactiver'}
              </button>
            </div>
          </article>
        ))}
        {!loading && competitions.length === 0 && (
          <p className="empty-state">Aucune compétition créée pour ce club.</p>
        )}
        {loading && <p className="empty-state">Chargement des compétitions…</p>}
      </div>
    </section>
  );
}
