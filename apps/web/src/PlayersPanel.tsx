import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Club } from './ClubsPanel';

interface PlayerPhoto {
  mimeType: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  url: string;
}

interface Player {
  id: string;
  clubId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  primaryPosition: string | null;
  usualJerseyNumber: number | null;
  active: boolean;
  compositionPhoto: PlayerPhoto | null;
}

interface PlayerForm {
  firstName: string;
  lastName: string;
  primaryPosition: string;
  usualJerseyNumber: string;
}

const EMPTY_FORM: PlayerForm = {
  firstName: '',
  lastName: '',
  primaryPosition: '',
  usualJerseyNumber: '',
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

function playerPayload(form: PlayerForm) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    primaryPosition: form.primaryPosition || null,
    usualJerseyNumber: form.usualJerseyNumber ? Number(form.usualJerseyNumber) : null,
  };
}

export function PlayersPanel({ club, onBack }: { club: Club; onBack: () => void }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<PlayerForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Player | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPlayers = useCallback(
    async (query = '') => {
      setLoading(true);
      setError('');
      try {
        const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : '';
        const response = await fetch(`/api/clubs/${club.id}/players${suffix}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as { players: Player[] };
        setPlayers(body.players);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Chargement de l’effectif impossible.');
      } finally {
        setLoading(false);
      }
    },
    [club.id],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadPlayers());
  }, [loadPlayers]);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo]);

  useEffect(() => {
    if (!photoPreview) return;
    const preview = photoPreview;
    return () => URL.revokeObjectURL(preview);
  }, [photoPreview]);

  function startEditing(player: Player) {
    setEditing(player);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      primaryPosition: player.primaryPosition ?? '',
      usualJerseyNumber: player.usualJerseyNumber?.toString() ?? '',
    });
    setPhoto(null);
    setShowCreate(false);
    setError('');
    setNotice('');
  }

  async function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const url = editing
        ? `/api/clubs/${club.id}/players/${editing.id}`
        : `/api/clubs/${club.id}/players`;
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerPayload(form)),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { player: Player };
      setPlayers((current) =>
        editing
          ? current.map((player) => (player.id === body.player.id ? body.player : player))
          : [...current, body.player],
      );
      setEditing(body.player);
      setShowCreate(false);
      setNotice(editing ? 'Joueur modifié.' : 'Joueur ajouté à l’effectif.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(player: Player) {
    const action = player.active ? 'désactiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} ${player.firstName} ${player.lastName} ?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/clubs/${club.id}/players/${player.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !player.active }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { player: Player };
      setPlayers((current) =>
        current.map((item) => (item.id === body.player.id ? body.player : item)),
      );
      if (editing?.id === body.player.id) setEditing(body.player);
      setNotice(body.player.active ? 'Joueur réactivé.' : 'Joueur désactivé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Modification du statut impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto() {
    if (!editing || !photo) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = new FormData();
      data.append('photo', photo);
      const response = await fetch(`/api/clubs/${club.id}/players/${editing.id}/photo`, {
        method: 'POST',
        credentials: 'include',
        body: data,
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { player: Player };
      setPlayers((current) =>
        current.map((player) => (player.id === body.player.id ? body.player : player)),
      );
      setEditing(body.player);
      setPhoto(null);
      setNotice('Photo de composition enregistrée sans recadrage ni transformation.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi de la photo impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="players-panel" aria-labelledby="roster-title">
      <div className="players-panel__header">
        <div>
          <p className="panel-label">Club actif · {club.shortName}</p>
          <h3 id="roster-title">Effectif de {club.name}</h3>
          <p className="muted">Les fiches joueur peuvent exister sans compte SquadPost associé.</p>
        </div>
        <div className="players-panel__actions">
          <button className="button button--ghost" onClick={onBack} type="button">
            Retour aux clubs
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY_FORM);
              setPhoto(null);
              setShowCreate(true);
            }}
            type="button"
          >
            Ajouter un joueur
          </button>
        </div>
      </div>

      <form
        className="player-search"
        onSubmit={(event) => {
          event.preventDefault();
          void loadPlayers(search);
        }}
      >
        <label>
          Rechercher par prénom, nom ou poste
          <input onChange={(event) => setSearch(event.target.value)} value={search} />
        </label>
        <button className="button button--ghost" type="submit">
          Rechercher
        </button>
      </form>

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

      {(showCreate || editing) && (
        <div className="player-editor">
          <div className="player-editor__heading">
            <div>
              <p className="panel-label">{editing ? 'Fiche joueur' : 'Nouvelle fiche'}</p>
              <h4>{editing ? `${editing.firstName} ${editing.lastName}` : 'Ajouter un joueur'}</h4>
            </div>
            <button
              className="table-action"
              onClick={() => {
                setEditing(null);
                setShowCreate(false);
                setPhoto(null);
              }}
              type="button"
            >
              Fermer
            </button>
          </div>
          <form className="player-form" onSubmit={(event) => void savePlayer(event)}>
            <label>
              Prénom
              <input
                required
                maxLength={80}
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
            </label>
            <label>
              Nom
              <input
                required
                maxLength={80}
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </label>
            <label>
              Poste principal (facultatif)
              <input
                maxLength={80}
                value={form.primaryPosition}
                onChange={(event) => setForm({ ...form, primaryPosition: event.target.value })}
              />
            </label>
            <label>
              Numéro habituel (facultatif)
              <input
                min={1}
                max={999}
                type="number"
                value={form.usualJerseyNumber}
                onChange={(event) => setForm({ ...form, usualJerseyNumber: event.target.value })}
              />
            </label>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy ? 'Enregistrement…' : 'Enregistrer la fiche'}
            </button>
          </form>

          {editing && (
            <div className="photo-editor">
              <div className="photo-preview">
                {photoPreview || editing.compositionPhoto?.url ? (
                  <img
                    alt={`Aperçu de ${editing.firstName} ${editing.lastName}`}
                    src={photoPreview || editing.compositionPhoto?.url}
                  />
                ) : (
                  <span>Aucune photo</span>
                )}
              </div>
              <div>
                <h5>Photo de composition</h5>
                <p className="muted">
                  Pour un meilleur rendu sur vos compositions, utilisez une photo détourée avec un
                  fond transparent. Vous pouvez préparer votre image sur remove.bg, puis l’importer
                  au format PNG. Le fichier original est conservé sans zoom, recadrage ni
                  modification du visage.
                </p>
                <label>
                  Choisir une photo
                  <input
                    accept="image/png,image/jpeg"
                    type="file"
                    onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  className="button button--ghost"
                  disabled={!photo || busy}
                  onClick={() => void uploadPhoto()}
                  type="button"
                >
                  Envoyer la photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="players-table-wrap">
        <table className="players-table">
          <thead>
            <tr>
              <th>Joueur</th>
              <th>Poste</th>
              <th>N°</th>
              <th>Compte</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className={player.active ? '' : 'is-disabled'} key={player.id}>
                <td>
                  <strong>
                    {player.firstName} {player.lastName}
                  </strong>
                </td>
                <td>{player.primaryPosition ?? '—'}</td>
                <td>{player.usualJerseyNumber ?? '—'}</td>
                <td>{player.userId ? 'Associé' : 'Non associé'}</td>
                <td>
                  <span
                    className={`status-pill status-pill--${player.active ? 'active' : 'disabled'}`}
                  >
                    {player.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="player-row-actions">
                  <button
                    className="table-action"
                    onClick={() => startEditing(player)}
                    type="button"
                  >
                    Consulter / modifier
                  </button>
                  <button
                    className="table-action"
                    disabled={busy}
                    onClick={() => void changeStatus(player)}
                    type="button"
                  >
                    {player.active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && players.length === 0 && (
          <p className="empty-state">Aucun joueur dans cet effectif.</p>
        )}
        {loading && <p className="empty-state">Chargement de l’effectif…</p>}
      </div>
    </section>
  );
}

export function MyPlayerProfilesPanel() {
  const [players, setPlayers] = useState<
    (Player & { club: Pick<Club, 'id' | 'name' | 'shortName'> })[]
  >([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/me/player-profiles', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const body = (await response.json()) as {
          players: (Player & { club: Pick<Club, 'id' | 'name' | 'shortName'> })[];
        };
        setPlayers(body.players);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Chargement impossible.'),
      );
  }, []);

  return (
    <section className="players-panel" aria-labelledby="my-player-profiles-title">
      <p className="panel-label">Données sportives</p>
      <h3 id="my-player-profiles-title">Mes fiches joueur</h3>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="my-player-profiles">
        {players.map((player) => (
          <article key={player.id}>
            {player.compositionPhoto && <img alt="" src={player.compositionPhoto.url} />}
            <div>
              <strong>
                {player.firstName} {player.lastName}
              </strong>
              <span>{player.club.name}</span>
              <span>
                {player.primaryPosition ?? 'Poste non renseigné'}
                {player.usualJerseyNumber ? ` · n° ${player.usualJerseyNumber}` : ''}
              </span>
            </div>
          </article>
        ))}
        {!error && players.length === 0 && (
          <p className="empty-state">Aucune fiche joueur n’est encore associée à votre compte.</p>
        )}
      </div>
    </section>
  );
}
