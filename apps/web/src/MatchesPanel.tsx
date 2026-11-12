import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Club } from './ClubsPanel';

type MatchLocation = 'HOME' | 'AWAY' | 'NEUTRAL';
type MatchStatus = 'UPCOMING' | 'FINISHED' | 'CANCELLED';

interface Opponent {
  id: string;
  clubId: string;
  name: string;
  shortName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  active: boolean;
}

interface CompetitionOption {
  id: string;
  name: string;
  active: boolean;
  seasons: { id: string; label: string; active: boolean }[];
}

interface ClubMatch {
  id: string;
  clubId: string;
  round: string | null;
  scheduledAt: string | null;
  venue: string | null;
  location: MatchLocation | null;
  status: MatchStatus;
  clubScore: number | null;
  opponentScore: number | null;
  starterCount: number;
  finisherCount: number;
  sportName: string;
  formatName: string;
  opponent: Opponent;
  season: { id: string; label: string; competition: { id: string; name: string } };
}

const EMPTY_OPPONENT = {
  name: '',
  shortName: '',
  primaryColor: '',
  secondaryColor: '',
};
const EMPTY_MATCH = {
  seasonId: '',
  opponentId: '',
  round: '',
  scheduledAt: '',
  venue: '',
  location: '' as MatchLocation | '',
  clubScore: '',
  opponentScore: '',
};

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const LOCATION_LABELS: Record<MatchLocation, string> = {
  HOME: 'Domicile',
  AWAY: 'Extérieur',
  NEUTRAL: 'Terrain neutre',
};

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

export function MatchesPanel({ club, onBack }: { club: Club; onBack: () => void }) {
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [matches, setMatches] = useState<ClubMatch[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [tab, setTab] = useState<'matches' | 'opponents'>('matches');
  const [opponentForm, setOpponentForm] = useState(EMPTY_OPPONENT);
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH);
  const [editingOpponent, setEditingOpponent] = useState<Opponent | null>(null);
  const [editingMatch, setEditingMatch] = useState<ClubMatch | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [opponentsResponse, matchesResponse, competitionsResponse] = await Promise.all([
        fetch(`/api/clubs/${club.id}/opponents`, { credentials: 'include' }),
        fetch(`/api/clubs/${club.id}/matches`, { credentials: 'include' }),
        fetch(`/api/clubs/${club.id}/competitions`, { credentials: 'include' }),
      ]);
      for (const response of [opponentsResponse, matchesResponse, competitionsResponse]) {
        if (!response.ok) throw new Error(await readError(response));
      }
      setOpponents(((await opponentsResponse.json()) as { opponents: Opponent[] }).opponents);
      setMatches(((await matchesResponse.json()) as { matches: ClubMatch[] }).matches);
      setCompetitions(
        ((await competitionsResponse.json()) as { competitions: CompetitionOption[] }).competitions,
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

  function openOpponentForm(opponent?: Opponent) {
    setTab('opponents');
    setEditingOpponent(opponent ?? null);
    setOpponentForm(
      opponent
        ? {
            name: opponent.name,
            shortName: opponent.shortName,
            primaryColor: opponent.primaryColor ?? '',
            secondaryColor: opponent.secondaryColor ?? '',
          }
        : EMPTY_OPPONENT,
    );
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function openMatchForm(match?: ClubMatch) {
    setTab('matches');
    setEditingMatch(match ?? null);
    setMatchForm(
      match
        ? {
            seasonId: match.season.id,
            opponentId: match.opponent.id,
            round: match.round ?? '',
            scheduledAt: match.scheduledAt ? toLocalDateTimeInput(match.scheduledAt) : '',
            venue: match.venue ?? '',
            location: match.location ?? '',
            clubScore: match.clubScore?.toString() ?? '',
            opponentScore: match.opponentScore?.toString() ?? '',
          }
        : EMPTY_MATCH,
    );
    setShowForm(true);
    setError('');
    setNotice('');
  }

  async function saveOpponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        editingOpponent
          ? `/api/clubs/${club.id}/opponents/${editingOpponent.id}`
          : `/api/clubs/${club.id}/opponents`,
        {
          method: editingOpponent ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...opponentForm,
            primaryColor: opponentForm.primaryColor || null,
            secondaryColor: opponentForm.secondaryColor || null,
          }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { opponent: Opponent };
      setOpponents((current) =>
        editingOpponent
          ? current.map((item) => (item.id === body.opponent.id ? body.opponent : item))
          : [...current, body.opponent],
      );
      setShowForm(false);
      setEditingOpponent(null);
      setNotice(editingOpponent ? 'Adversaire modifié.' : 'Adversaire ajouté.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function saveMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        editingMatch
          ? `/api/clubs/${club.id}/matches/${editingMatch.id}`
          : `/api/clubs/${club.id}/matches`,
        {
          method: editingMatch ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seasonId: matchForm.seasonId,
            opponentId: matchForm.opponentId,
            round: matchForm.round || null,
            scheduledAt: matchForm.scheduledAt
              ? new Date(matchForm.scheduledAt).toISOString()
              : null,
            venue: matchForm.venue || null,
            location: matchForm.location || null,
            clubScore: matchForm.clubScore === '' ? null : Number(matchForm.clubScore),
            opponentScore: matchForm.opponentScore === '' ? null : Number(matchForm.opponentScore),
          }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { match: ClubMatch };
      setMatches((current) =>
        editingMatch
          ? current.map((item) => (item.id === body.match.id ? body.match : item))
          : [...current, body.match],
      );
      setShowForm(false);
      setEditingMatch(null);
      setNotice(editingMatch ? 'Match modifié.' : 'Match créé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function changeOpponentStatus(opponent: Opponent) {
    if (!window.confirm(`${opponent.active ? 'Désactiver' : 'Réactiver'} ${opponent.name} ?`))
      return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/clubs/${club.id}/opponents/${opponent.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !opponent.active }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { opponent: Opponent };
      setOpponents((current) =>
        current.map((item) => (item.id === body.opponent.id ? body.opponent : item)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function changeMatchStatus(match: ClubMatch, status: MatchStatus) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/clubs/${club.id}/matches/${match.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { match: ClubMatch };
      setMatches((current) =>
        current.map((item) => (item.id === body.match.id ? body.match : item)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  const seasonOptions = competitions.flatMap((competition) =>
    competition.active
      ? competition.seasons
          .filter((season) => season.active)
          .map((season) => ({
            id: season.id,
            label: `${competition.name} · ${season.label}`,
          }))
      : [],
  );

  return (
    <section className="matches-panel" aria-labelledby="matches-title">
      <div className="matches-panel__header">
        <div>
          <p className="panel-label">Club actif · {club.shortName}</p>
          <h3 id="matches-title">Adversaires et matchs</h3>
          <p className="muted">
            Les capacités de la compétition sont figées à la création du match pour préserver
            l’historique.
          </p>
        </div>
        <button className="button button--ghost" onClick={onBack} type="button">
          Retour aux clubs
        </button>
      </div>

      <div className="match-tabs" role="tablist" aria-label="Gestion sportive">
        <button
          aria-selected={tab === 'matches'}
          onClick={() => {
            setTab('matches');
            setShowForm(false);
          }}
          role="tab"
          type="button"
        >
          Matchs
        </button>
        <button
          aria-selected={tab === 'opponents'}
          onClick={() => {
            setTab('opponents');
            setShowForm(false);
          }}
          role="tab"
          type="button"
        >
          Adversaires
        </button>
      </div>

      <div className="matches-toolbar">
        <div>
          <p className="panel-label">{tab === 'matches' ? 'Calendrier manuel' : 'Base du club'}</p>
          <h4>{tab === 'matches' ? 'Matchs' : 'Adversaires'}</h4>
        </div>
        <button
          className="button button--primary"
          onClick={() => (tab === 'matches' ? openMatchForm() : openOpponentForm())}
          type="button"
        >
          {tab === 'matches' ? 'Créer un match' : 'Ajouter un adversaire'}
        </button>
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

      {showForm && tab === 'opponents' && (
        <form className="sport-form" onSubmit={(event) => void saveOpponent(event)}>
          <h4>{editingOpponent ? 'Modifier l’adversaire' : 'Nouvel adversaire'}</h4>
          <label>
            Nom
            <input
              required
              maxLength={120}
              value={opponentForm.name}
              onChange={(event) => setOpponentForm({ ...opponentForm, name: event.target.value })}
            />
          </label>
          <label>
            Nom court
            <input
              required
              maxLength={30}
              value={opponentForm.shortName}
              onChange={(event) =>
                setOpponentForm({ ...opponentForm, shortName: event.target.value })
              }
            />
          </label>
          <label>
            Couleur principale facultative
            <input
              aria-label="Couleur principale de l’adversaire"
              type="color"
              value={opponentForm.primaryColor || '#000000'}
              onChange={(event) =>
                setOpponentForm({ ...opponentForm, primaryColor: event.target.value })
              }
            />
          </label>
          <label>
            Couleur secondaire facultative
            <input
              aria-label="Couleur secondaire de l’adversaire"
              type="color"
              value={opponentForm.secondaryColor || '#FFFFFF'}
              onChange={(event) =>
                setOpponentForm({ ...opponentForm, secondaryColor: event.target.value })
              }
            />
          </label>
          <button className="button button--primary" disabled={busy} type="submit">
            Enregistrer l’adversaire
          </button>
        </form>
      )}

      {showForm && tab === 'matches' && (
        <form className="sport-form" onSubmit={(event) => void saveMatch(event)}>
          <h4>{editingMatch ? 'Modifier le match' : 'Nouveau match'}</h4>
          <label>
            Saison
            <select
              required
              value={matchForm.seasonId}
              onChange={(event) => setMatchForm({ ...matchForm, seasonId: event.target.value })}
            >
              <option value="">Choisir une saison</option>
              {seasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Adversaire
            <select
              required
              value={matchForm.opponentId}
              onChange={(event) => setMatchForm({ ...matchForm, opponentId: event.target.value })}
            >
              <option value="">Choisir un adversaire</option>
              {opponents
                .filter((opponent) => opponent.active)
                .map((opponent) => (
                  <option key={opponent.id} value={opponent.id}>
                    {opponent.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Journée facultative
            <input
              maxLength={80}
              value={matchForm.round}
              onChange={(event) => setMatchForm({ ...matchForm, round: event.target.value })}
            />
          </label>
          <label>
            Date et heure facultatives
            <input
              type="datetime-local"
              value={matchForm.scheduledAt}
              onChange={(event) => setMatchForm({ ...matchForm, scheduledAt: event.target.value })}
            />
          </label>
          <label>
            Lieu facultatif
            <input
              maxLength={160}
              value={matchForm.venue}
              onChange={(event) => setMatchForm({ ...matchForm, venue: event.target.value })}
            />
          </label>
          <label>
            Configuration
            <select
              value={matchForm.location}
              onChange={(event) =>
                setMatchForm({ ...matchForm, location: event.target.value as MatchLocation | '' })
              }
            >
              <option value="">Non précisée</option>
              <option value="HOME">Domicile</option>
              <option value="AWAY">Extérieur</option>
              <option value="NEUTRAL">Terrain neutre</option>
            </select>
          </label>
          <label>
            Score du club facultatif
            <input
              min={0}
              max={999}
              step={1}
              type="number"
              value={matchForm.clubScore}
              onChange={(event) => setMatchForm({ ...matchForm, clubScore: event.target.value })}
            />
          </label>
          <label>
            Score adverse facultatif
            <input
              min={0}
              max={999}
              step={1}
              type="number"
              value={matchForm.opponentScore}
              onChange={(event) =>
                setMatchForm({ ...matchForm, opponentScore: event.target.value })
              }
            />
          </label>
          <button
            className="button button--primary"
            disabled={
              busy || seasonOptions.length === 0 || opponents.every((opponent) => !opponent.active)
            }
            type="submit"
          >
            Enregistrer le match
          </button>
        </form>
      )}

      {tab === 'opponents' && (
        <div className="sport-list">
          {opponents.map((opponent) => (
            <article className={opponent.active ? '' : 'is-disabled'} key={opponent.id}>
              <div>
                <strong>{opponent.name}</strong>
                <span>{opponent.shortName}</span>
              </div>
              <span
                className={`status-pill status-pill--${opponent.active ? 'active' : 'disabled'}`}
              >
                {opponent.active ? 'Actif' : 'Inactif'}
              </span>
              <div>
                <button
                  className="table-action"
                  onClick={() => openOpponentForm(opponent)}
                  type="button"
                >
                  Modifier
                </button>
                <button
                  className="table-action"
                  disabled={busy}
                  onClick={() => void changeOpponentStatus(opponent)}
                  type="button"
                >
                  {opponent.active ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </article>
          ))}
          {!loading && opponents.length === 0 && (
            <p className="empty-state">Aucun adversaire enregistré.</p>
          )}
        </div>
      )}

      {tab === 'matches' && (
        <div className="sport-list">
          {matches.map((match) => (
            <article key={match.id}>
              <div>
                <strong>
                  {club.shortName} · {match.opponent.name}
                </strong>
                <span>
                  {match.season.competition.name} · {match.season.label}
                </span>
                <span>
                  {match.formatName} · {match.starterCount} titulaires · {match.finisherCount}{' '}
                  finisseurs
                </span>
                <span>
                  {match.scheduledAt
                    ? new Date(match.scheduledAt).toLocaleString('fr-FR')
                    : 'Date à définir'}
                </span>
                {(match.round || match.venue || match.location) && (
                  <span>
                    {[match.round, match.venue, match.location && LOCATION_LABELS[match.location]]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
                {(match.clubScore !== null || match.opponentScore !== null) && (
                  <span>
                    Score · {match.clubScore ?? '—'} – {match.opponentScore ?? '—'}
                  </span>
                )}
              </div>
              <select
                aria-label={`Statut de ${match.opponent.name}`}
                disabled={busy}
                value={match.status}
                onChange={(event) =>
                  void changeMatchStatus(match, event.target.value as MatchStatus)
                }
              >
                <option value="UPCOMING">À venir</option>
                <option value="FINISHED">Terminé</option>
                <option value="CANCELLED">Annulé</option>
              </select>
              <button className="table-action" onClick={() => openMatchForm(match)} type="button">
                Modifier
              </button>
            </article>
          ))}
          {!loading && matches.length === 0 && <p className="empty-state">Aucun match créé.</p>}
          {loading && <p className="empty-state">Chargement…</p>}
        </div>
      )}
    </section>
  );
}
