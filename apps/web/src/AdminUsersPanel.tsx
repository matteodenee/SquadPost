import { FormEvent, useCallback, useEffect, useState } from 'react';

type UserRole = 'PLAYER' | 'COM_MANAGER' | 'ADMIN';

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminUsersPanelProps {
  currentUserId: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  PLAYER: 'Joueur',
  COM_MANAGER: 'Responsable communication',
  ADMIN: 'Administrateur',
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(' ');
    return body.message ?? 'Une erreur est survenue.';
  } catch {
    return 'Une erreur est survenue.';
  }
}

export function AdminUsersPanel({ currentUserId }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'PLAYER' as 'PLAYER' | 'COM_MANAGER',
  });

  const selectedUser = users.find((user) => user.id === selectedId) ?? null;

  const loadUsers = useCallback(async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const parameters = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : '';
      const response = await fetch(`/api/admin/users${parameters}`, { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { users: AdminUser[] };
      setUsers(body.users);
      setSelectedId((current) =>
        current && body.users.some((user) => user.id === current) ? current : null,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadUsers());
  }, [loadUsers]);

  function replaceUser(updatedUser: AdminUser) {
    setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
  }

  async function sendUserAction(
    path: string,
    options: RequestInit,
    successMessage: string,
  ): Promise<AdminUser | null> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { user: AdminUser };
      replaceUser(body.user);
      setNotice(successMessage);
      return body.user;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action impossible.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { user: AdminUser };
      setUsers((current) => [body.user, ...current]);
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', role: 'PLAYER' });
      setShowCreate(false);
      setSelectedId(body.user.id);
      setNotice('Utilisateur créé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;
    const form = new FormData(event.currentTarget);
    await sendUserAction(
      `/api/admin/users/${selectedUser.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          email: form.get('email'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
        }),
      },
      'Informations mises à jour.',
    );
  }

  async function handleRoleChange(user: AdminUser, role: 'PLAYER' | 'COM_MANAGER') {
    await sendUserAction(
      `/api/admin/users/${user.id}/role`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
      'Rôle mis à jour.',
    );
  }

  async function handlePromotion(user: AdminUser) {
    if (!window.confirm(`Promouvoir ${user.email} administrateur global de SquadPost ?`)) return;
    await sendUserAction(
      `/api/admin/users/${user.id}/promote-admin`,
      { method: 'POST', body: JSON.stringify({ confirmation: 'PROMOUVOIR ADMIN' }) },
      'Utilisateur promu administrateur.',
    );
  }

  async function handleStatusChange(user: AdminUser) {
    const action = user.active ? 'désactiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} le compte ${user.email} ?`)) return;
    await sendUserAction(
      `/api/admin/users/${user.id}/status`,
      { method: 'PATCH', body: JSON.stringify({ active: !user.active }) },
      user.active ? 'Compte désactivé et sessions invalidées.' : 'Compte réactivé.',
    );
  }

  return (
    <section className="admin-users" aria-labelledby="users-title">
      <div className="admin-users__header">
        <div>
          <p className="panel-label">Gestion globale</p>
          <h3 id="users-title">Utilisateurs</h3>
          <p className="muted">Recherchez, créez et gérez les comptes SquadPost.</p>
        </div>
        <button
          className="button button--primary"
          onClick={() => setShowCreate(!showCreate)}
          type="button"
        >
          {showCreate ? 'Fermer' : 'Créer un utilisateur'}
        </button>
      </div>

      {showCreate && (
        <form
          className="admin-form admin-form--create"
          onSubmit={(event) => void handleCreate(event)}
        >
          <h4>Nouveau compte</h4>
          <label>
            Prénom
            <input
              maxLength={80}
              onChange={(event) => setCreateForm({ ...createForm, firstName: event.target.value })}
              value={createForm.firstName}
            />
          </label>
          <label>
            Nom
            <input
              maxLength={80}
              onChange={(event) => setCreateForm({ ...createForm, lastName: event.target.value })}
              value={createForm.lastName}
            />
          </label>
          <label>
            Adresse e-mail
            <input
              onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              required
              type="email"
              value={createForm.email}
            />
          </label>
          <label>
            Mot de passe temporaire
            <input
              maxLength={128}
              minLength={12}
              onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
              required
              type="password"
              value={createForm.password}
            />
          </label>
          <label>
            Rôle initial
            <select
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  role: event.target.value as 'PLAYER' | 'COM_MANAGER',
                })
              }
              value={createForm.role}
            >
              <option value="PLAYER">Joueur</option>
              <option value="COM_MANAGER">Responsable communication</option>
            </select>
          </label>
          <button className="button button--primary" disabled={busy} type="submit">
            {busy ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
      )}

      <form
        className="user-search"
        onSubmit={(event) => {
          event.preventDefault();
          void loadUsers(search);
        }}
      >
        <label>
          Rechercher par nom ou e-mail
          <input
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom ou adresse e-mail"
            type="search"
            value={search}
          />
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

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={!user.active ? 'is-disabled' : ''}>
                <td>
                  <strong>
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Sans nom'}
                  </strong>
                  <span>{user.email}</span>
                </td>
                <td>
                  <span className={`role-badge role-badge--${user.role.toLowerCase()}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td>
                  <span
                    className={`status-pill status-pill--${user.active ? 'active' : 'disabled'}`}
                  >
                    {user.active ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td>
                  <button
                    className="table-action"
                    onClick={() => setSelectedId(user.id)}
                    type="button"
                  >
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && <p className="empty-state">Aucun utilisateur trouvé.</p>}
        {loading && <p className="empty-state">Chargement des utilisateurs…</p>}
      </div>

      {selectedUser && (
        <div className="user-editor">
          <div className="user-editor__heading">
            <div>
              <p className="panel-label">Compte sélectionné</p>
              <h4>{selectedUser.email}</h4>
            </div>
            <button className="table-action" onClick={() => setSelectedId(null)} type="button">
              Fermer
            </button>
          </div>

          <form
            className="admin-form"
            key={selectedUser.updatedAt}
            onSubmit={(event) => void handleUpdate(event)}
          >
            <label>
              Prénom
              <input defaultValue={selectedUser.firstName ?? ''} maxLength={80} name="firstName" />
            </label>
            <label>
              Nom
              <input defaultValue={selectedUser.lastName ?? ''} maxLength={80} name="lastName" />
            </label>
            <label>
              Adresse e-mail
              <input defaultValue={selectedUser.email} name="email" required type="email" />
            </label>
            <button className="button button--ghost" disabled={busy} type="submit">
              Enregistrer les informations
            </button>
          </form>

          <div className="user-editor__actions">
            <label>
              Rôle
              <select
                disabled={busy || selectedUser.id === currentUserId}
                onChange={(event) => {
                  const role = event.target.value;
                  if (role === 'PLAYER' || role === 'COM_MANAGER')
                    void handleRoleChange(selectedUser, role);
                }}
                value={selectedUser.role}
              >
                <option value="PLAYER">Joueur</option>
                <option value="COM_MANAGER">Responsable communication</option>
                {selectedUser.role === 'ADMIN' && <option value="ADMIN">Administrateur</option>}
              </select>
            </label>
            {selectedUser.role !== 'ADMIN' && selectedUser.id !== currentUserId && (
              <button
                className="button button--sensitive"
                disabled={busy || !selectedUser.active}
                onClick={() => void handlePromotion(selectedUser)}
                type="button"
              >
                Promouvoir ADMIN
              </button>
            )}
            <button
              className={selectedUser.active ? 'button button--danger' : 'button button--ghost'}
              disabled={busy || (selectedUser.active && selectedUser.id === currentUserId)}
              onClick={() => void handleStatusChange(selectedUser)}
              type="button"
            >
              {selectedUser.active ? 'Désactiver le compte' : 'Réactiver le compte'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
