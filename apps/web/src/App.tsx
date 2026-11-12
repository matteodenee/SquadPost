import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminUsersPanel } from './AdminUsersPanel';
import { ClubsPanel, type Club } from './ClubsPanel';
import { CompetitionsPanel } from './CompetitionsPanel';
import { MyPlayerProfilesPanel, PlayersPanel } from './PlayersPanel';

type UserRole = 'PLAYER' | 'COM_MANAGER' | 'ADMIN';

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  permissions: string[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  PLAYER: 'Joueur',
  COM_MANAGER: 'Responsable communication',
  ADMIN: 'Administrateur SquadPost',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  PLAYER: 'Vous pouvez consulter les informations de votre propre compte.',
  COM_MANAGER:
    'Votre espace est prêt pour les futures fonctions de gestion sportive et de communication.',
  ADMIN: 'Votre espace est prêt pour la future administration globale des comptes SquadPost.',
};

const DASHBOARD_TITLES: Record<UserRole, string> = {
  PLAYER: 'Mon profil',
  COM_MANAGER: 'Tableau de bord communication',
  ADMIN: 'Administration SquadPost',
};

const PERMISSION_LABELS: Record<string, string> = {
  'profile:read:self': 'Voir mes propres informations',
  'dashboard:access': 'Accéder au tableau de bord',
  'players:manage': 'Gérer les joueurs',
  'roster:manage': 'Gérer l’effectif',
  'lineups:manage': 'Préparer les compositions',
  'visuals:generate': 'Générer les visuels',
  'matches:manage': 'Gérer les matchs',
  'publications:manage': 'Gérer les publications',
  'users:read': 'Voir tous les utilisateurs',
  'users:create': 'Créer un utilisateur',
  'users:update': 'Modifier un utilisateur',
  'users:deactivate': 'Désactiver un utilisateur',
  'users:delete': 'Supprimer un utilisateur',
  'users:assign-role': 'Attribuer ou changer un rôle',
};

async function readApiError(response: Response): Promise<string> {
  const fallback = 'Une erreur est survenue. Réessayez dans un instant.';
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? fallback);
  } catch {
    return fallback;
  }
}

export function App() {
  const [status, setStatus] = useState<'loading' | 'guest' | 'authenticated'>('loading');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [dashboardView, setDashboardView] = useState<'overview' | 'roster' | 'competitions'>(
    'overview',
  );

  const handleActiveClubChange = useCallback((club: Club | null) => {
    setActiveClub(club);
  }, []);

  useEffect(() => {
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('guest');
        const body = (await response.json()) as { user: AuthenticatedUser };
        setUser(body.user);
        setStatus('authenticated');
      })
      .catch(() => setStatus('guest'));
  }, []);

  function changeAuthMode(mode: 'login' | 'register') {
    setAuthMode(mode);
    setError('');
    setPassword('');
    setPasswordConfirmation('');
  }

  async function handleAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authMode === 'register' && password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      const body = (await response.json()) as { user: AuthenticatedUser };
      setUser(body.user);
      setPassword('');
      setPasswordConfirmation('');
      setStatus('authenticated');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentification impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setActiveClub(null);
    setDashboardView('overview');
    setStatus('guest');
  }

  if (status === 'loading') {
    return (
      <main className="auth-shell auth-shell--loading">
        <p className="loading-message">Chargement de SquadPost…</p>
      </main>
    );
  }

  if (status === 'authenticated' && user) {
    return (
      <main className="dashboard-shell">
        <header className="dashboard-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              SP
            </span>
            <div>
              <p className="eyebrow">Espace personnel</p>
              <h1>SquadPost</h1>
            </div>
          </div>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void handleLogout()}
          >
            Se déconnecter
          </button>
        </header>

        <section className="dashboard-content" aria-labelledby="dashboard-title">
          <div className="welcome-row">
            <div>
              <p className="muted">Connecté avec {user.email}</p>
              <h2 id="dashboard-title">{DASHBOARD_TITLES[user.role]}</h2>
            </div>
          </div>

          {dashboardView === 'overview' && (
            <div className="dashboard-grid">
              <article className="panel role-panel">
                <p className="panel-label">Mon compte</p>
                <h3>{user.email}</h3>
                <span className={`role-badge role-badge--${user.role.toLowerCase()}`}>
                  {ROLE_LABELS[user.role]}
                </span>
                <p>{ROLE_DESCRIPTIONS[user.role]}</p>
              </article>

              <article className="panel permissions-panel">
                <p className="panel-label">Accès préparés</p>
                <h3>Autorisations du rôle</h3>
                <ul className="permission-list">
                  {user.permissions.map((permission) => (
                    <li key={permission}>
                      <span aria-hidden="true">✓</span>
                      {PERMISSION_LABELS[permission] ?? permission}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          )}

          {dashboardView === 'overview' && user.role === 'ADMIN' && (
            <AdminUsersPanel currentUserId={user.id} />
          )}
          {dashboardView === 'overview' &&
            (user.role === 'PLAYER' || user.role === 'COM_MANAGER') && (
              <ClubsPanel
                onActiveClubChange={handleActiveClubChange}
                onOpenRoster={
                  user.role === 'COM_MANAGER' && activeClub
                    ? () => setDashboardView('roster')
                    : undefined
                }
                onOpenCompetitions={
                  user.role === 'COM_MANAGER' && activeClub
                    ? () => setDashboardView('competitions')
                    : undefined
                }
                role={user.role}
              />
            )}
          {dashboardView === 'overview' && user.role === 'PLAYER' && <MyPlayerProfilesPanel />}
          {dashboardView === 'roster' && user.role === 'COM_MANAGER' && activeClub && (
            <PlayersPanel club={activeClub} onBack={() => setDashboardView('overview')} />
          )}
          {dashboardView === 'competitions' && user.role === 'COM_MANAGER' && activeClub && (
            <CompetitionsPanel club={activeClub} onBack={() => setDashboardView('overview')} />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro" aria-labelledby="app-title">
        <div className="brand-lockup brand-lockup--large">
          <span className="brand-mark" aria-hidden="true">
            SP
          </span>
          <p className="eyebrow">Communication sportive</p>
        </div>
        <h1 id="app-title">
          Votre équipe.
          <br />
          Votre image.
        </h1>
        <p className="auth-summary">
          Retrouvez votre espace SquadPost avec les accès correspondant à votre rôle.
        </p>
      </section>

      <section className="login-card" aria-labelledby="auth-title">
        <div className="auth-mode-switch" aria-label="Choisir une action" role="group">
          <button
            aria-pressed={authMode === 'login'}
            className={authMode === 'login' ? 'active' : ''}
            onClick={() => changeAuthMode('login')}
            type="button"
          >
            Connexion
          </button>
          <button
            aria-pressed={authMode === 'register'}
            className={authMode === 'register' ? 'active' : ''}
            onClick={() => changeAuthMode('register')}
            type="button"
          >
            Créer un compte
          </button>
        </div>

        <div>
          <p className="panel-label">Accès sécurisé</p>
          <h2 id="auth-title">{authMode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
          <p className="muted">
            {authMode === 'login'
              ? 'Utilisez votre compte SquadPost.'
              : 'Votre nouveau compte sera créé avec le rôle Joueur.'}
          </p>
        </div>

        <form onSubmit={(event) => void handleAuthentication(event)}>
          <label>
            Adresse e-mail
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@votreclub.fr"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Mot de passe
            <input
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              maxLength={128}
              minLength={12}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="12 caractères minimum"
              required
              type="password"
              value={password}
            />
          </label>
          {authMode === 'register' && (
            <label>
              Confirmer le mot de passe
              <input
                autoComplete="new-password"
                maxLength={128}
                minLength={12}
                name="passwordConfirmation"
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                placeholder="Saisissez à nouveau votre mot de passe"
                required
                type="password"
                value={passwordConfirmation}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--primary" disabled={submitting} type="submit">
            {submitting
              ? authMode === 'login'
                ? 'Connexion…'
                : 'Création…'
              : authMode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte joueur'}
          </button>
        </form>

        {import.meta.env.DEV && authMode === 'login' && (
          <aside className="demo-hint">
            <strong>Comptes de démonstration</strong>
            <span>player@, communication@ ou admin@squadpost.local</span>
            <span>Mot de passe : SquadPost-demo-2026!</span>
          </aside>
        )}
      </section>
    </main>
  );
}
