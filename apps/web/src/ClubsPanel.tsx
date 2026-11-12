import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from 'react';

type ClubUserRole = 'PLAYER' | 'COM_MANAGER';

export interface Club {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  primarySport: { code: string; name: string };
}

interface ClubInvitation {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  token?: string;
}

interface ClubsPanelProps {
  role: ClubUserRole;
  onActiveClubChange?: (club: Club | null) => void;
  onOpenRoster?: () => void;
}

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

export function ClubsPanel({ role, onActiveClubChange, onOpenRoster }: ClubsPanelProps) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [clubForm, setClubForm] = useState({
    name: '',
    shortName: '',
    primaryColor: '#A91234',
    secondaryColor: '#FFFFFF',
  });
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationToken, setInvitationToken] = useState('');

  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? null;

  useEffect(() => {
    onActiveClubChange?.(selectedClub);
  }, [onActiveClubChange, selectedClub]);

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/clubs', { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { clubs: Club[] };
      setClubs(body.clubs);
      setSelectedClubId((current) => current ?? body.clubs[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvitations = useCallback(async (clubId: string) => {
    try {
      const response = await fetch(`/api/clubs/${clubId}/invitations`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { invitations: ClubInvitation[] };
      setInvitations(body.invitations);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chargement des invitations impossible.');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadClubs());
  }, [loadClubs]);

  useEffect(() => {
    if (role !== 'COM_MANAGER' || !selectedClubId) return;
    void Promise.resolve().then(() => loadInvitations(selectedClubId));
  }, [loadInvitations, role, selectedClubId]);

  function addClub(club: Club) {
    setClubs((current) =>
      current.some((existing) => existing.id === club.id) ? current : [...current, club],
    );
    setSelectedClubId(club.id);
  }

  async function handleCreateClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/clubs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...clubForm, primarySportCode: 'RUGBY' }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { club: Club };
      addClub(body.club);
      setClubForm({
        name: '',
        shortName: '',
        primaryColor: '#A91234',
        secondaryColor: '#FFFFFF',
      });
      setShowCreate(false);
      setNotice('Club créé. Vous pouvez maintenant inviter ses membres.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClub) return;
    setBusy(true);
    setError('');
    setNotice('');
    setGeneratedToken('');
    try {
      const response = await fetch(`/api/clubs/${selectedClub.id}/invitations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invitationEmail }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { invitation: ClubInvitation };
      setInvitations((current) => [body.invitation, ...current]);
      setGeneratedToken(body.invitation.token ?? '');
      setInvitationEmail('');
      setNotice('Invitation créée. Copiez son jeton maintenant : il ne sera plus affiché ensuite.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Création de l'invitation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/club-invitations/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invitationToken.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { club: Club };
      addClub(body.club);
      setInvitationToken('');
      setNotice(`Vous avez rejoint ${body.club.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'accepter l'invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="clubs-panel" aria-labelledby="clubs-title">
      <div className="clubs-panel__header">
        <div>
          <p className="panel-label">Espaces sportifs</p>
          <h3 id="clubs-title">Mes clubs</h3>
          <p className="muted">Sélectionnez le club dans lequel vous souhaitez travailler.</p>
        </div>
        {role === 'COM_MANAGER' && (
          <button
            className="button button--primary"
            onClick={() => setShowCreate(!showCreate)}
            type="button"
          >
            {showCreate ? 'Fermer' : 'Créer un club'}
          </button>
        )}
      </div>

      {role === 'COM_MANAGER' && showCreate && (
        <form className="club-form" onSubmit={(event) => void handleCreateClub(event)}>
          <h4>Nouveau club</h4>
          <label>
            Nom du club
            <input
              maxLength={120}
              onChange={(event) => setClubForm({ ...clubForm, name: event.target.value })}
              required
              value={clubForm.name}
            />
          </label>
          <label>
            Nom court
            <input
              maxLength={30}
              onChange={(event) => setClubForm({ ...clubForm, shortName: event.target.value })}
              required
              value={clubForm.shortName}
            />
          </label>
          <label>
            Couleur principale
            <input
              aria-label="Couleur principale"
              onChange={(event) => setClubForm({ ...clubForm, primaryColor: event.target.value })}
              type="color"
              value={clubForm.primaryColor}
            />
          </label>
          <label>
            Couleur secondaire
            <input
              aria-label="Couleur secondaire"
              onChange={(event) => setClubForm({ ...clubForm, secondaryColor: event.target.value })}
              type="color"
              value={clubForm.secondaryColor}
            />
          </label>
          <label>
            Sport principal
            <select disabled value="RUGBY">
              <option value="RUGBY">Rugby</option>
            </select>
          </label>
          <button className="button button--primary" disabled={busy} type="submit">
            {busy ? 'Création…' : 'Créer le club'}
          </button>
        </form>
      )}

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

      <div className="club-list" aria-label="Clubs accessibles">
        {clubs.map((club) => (
          <button
            aria-pressed={selectedClubId === club.id}
            className={`club-card${selectedClubId === club.id ? ' club-card--selected' : ''}`}
            key={club.id}
            onClick={() => setSelectedClubId(club.id)}
            style={{ '--club-primary': club.primaryColor } as CSSProperties}
            type="button"
          >
            <span className="club-card__mark" aria-hidden="true">
              {club.shortName.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{club.name}</strong>
              <small>{club.primarySport.name}</small>
            </span>
          </button>
        ))}
        {!loading && clubs.length === 0 && (
          <p className="empty-state">Vous n’êtes encore membre d’aucun club.</p>
        )}
        {loading && <p className="empty-state">Chargement des clubs…</p>}
      </div>

      <form className="invitation-accept" onSubmit={(event) => void handleAcceptInvitation(event)}>
        <div>
          <h4>Rejoindre avec une invitation</h4>
          <p className="muted">Le jeton doit avoir été envoyé à l’adresse e-mail de ce compte.</p>
        </div>
        <label>
          Jeton d’invitation
          <input
            autoComplete="off"
            minLength={40}
            onChange={(event) => setInvitationToken(event.target.value)}
            required
            value={invitationToken}
          />
        </label>
        <button className="button button--ghost" disabled={busy} type="submit">
          Rejoindre le club
        </button>
      </form>

      {role === 'COM_MANAGER' && selectedClub && (
        <div className="club-invitations">
          <div className="club-active-heading">
            <div>
              <p className="panel-label">Club actif</p>
              <h4>{selectedClub.name}</h4>
            </div>
            {onOpenRoster && (
              <button className="button button--ghost" onClick={onOpenRoster} type="button">
                Ouvrir l’effectif
              </button>
            )}
          </div>
          <form
            className="invitation-create"
            onSubmit={(event) => void handleCreateInvitation(event)}
          >
            <label>
              E-mail du membre à inviter
              <input
                onChange={(event) => setInvitationEmail(event.target.value)}
                required
                type="email"
                value={invitationEmail}
              />
            </label>
            <button className="button button--primary" disabled={busy} type="submit">
              Créer l’invitation
            </button>
          </form>
          {generatedToken && (
            <div className="invitation-token">
              <strong>Jeton à transmettre</strong>
              <code>{generatedToken}</code>
            </div>
          )}
          <ul className="invitation-list">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <span>
                  <strong>{invitation.email}</strong>
                  <small>
                    Expire le {new Date(invitation.expiresAt).toLocaleDateString('fr-FR')}
                  </small>
                </span>
                <span className={`status-pill status-pill--${invitation.status.toLowerCase()}`}>
                  {invitation.status === 'PENDING'
                    ? 'En attente'
                    : invitation.status === 'ACCEPTED'
                      ? 'Acceptée'
                      : 'Expirée'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
