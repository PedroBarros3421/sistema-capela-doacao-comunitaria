"use client";

import { useCallback, useEffect, useState } from "react";

import { UserForm, ROLE_LABELS } from "@/components/admin/UserForm";
import { Alert } from "@/components/shared/Alert";

type User = {
  id: string;
  name: string;
  email: string;
  role: "GENERAL_ADMIN" | "FINANCE" | "INVENTORY_VOLUNTEER";
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "BLOCKED";
  failedLoginCount: number;
  lastLoginAt: string | null;
};

const STATUS_LABELS: Record<User["status"], string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rowMessage, setRowMessage] = useState<{ userId: string; text: string } | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/users?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json() as { data?: User[]; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar os usuários");
        return body.data ?? [];
      })
      .then(setUsers)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function updateUser(userId: string, patch: Record<string, string>) {
    setRowMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível atualizar o usuário");
      setLoading(true);
      load();
    } catch (error) {
      setRowMessage({ userId, text: error instanceof Error ? error.message : "Erro de conexão" });
    }
  }

  async function unlockUser(userId: string) {
    setRowMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/unlock`, { method: "POST" });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível desbloquear o usuário");
      setLoading(true);
      load();
    } catch (error) {
      setRowMessage({ userId, text: error instanceof Error ? error.message : "Erro de conexão" });
    }
  }

  async function resendInvitation(userId: string) {
    setRowMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/invitation`, { method: "POST" });
      const body = await response.json() as { data?: { invitationUrl: string }; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível reenviar o convite");
      setRowMessage({ userId, text: `Novo link: ${body.data?.invitationUrl}` });
    } catch (error) {
      setRowMessage({ userId, text: error instanceof Error ? error.message : "Erro de conexão" });
    }
  }

  return (
    <div className="admin-users-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Governança</p>
          <h1>Usuários</h1>
          <p className="page-header__description">Crie contas, altere papéis e gerencie bloqueios.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm} aria-controls="user-form-panel">
          {showForm ? "Cancelar" : "Novo usuário"}
        </button>
      </header>

      {showForm && (
        <section id="user-form-panel" aria-labelledby="form-heading">
          <h2 id="form-heading" className="sr-only">Formulário de novo usuário</h2>
          <UserForm onSuccess={() => { setShowForm(false); setLoading(true); load(); }} />
        </section>
      )}

      <form role="search" aria-label="Filtrar usuários" onSubmit={(e) => e.preventDefault()}>
        <label>Status
          <select value={statusFilter} onChange={(e) => { setLoading(true); setStatusFilter(e.target.value); }}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? <p aria-busy="true">Carregando usuários…</p> : users.length === 0 ? (
        <p className="empty-state" role="status">Nenhum usuário encontrado.</p>
      ) : (
        <div className="table-scroll">
          <table aria-label="Usuários cadastrados">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      aria-label={`Papel de ${user.name}`}
                      onChange={(e) => void updateUser(user.id, { role: e.target.value })}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td>{STATUS_LABELS[user.status]}</td>
                  <td className="user-actions">
                    {user.status === "ACTIVE" && (
                      <button type="button" onClick={() => void updateUser(user.id, { status: "INACTIVE" })}>Desativar</button>
                    )}
                    {user.status === "INACTIVE" && (
                      <button type="button" onClick={() => void updateUser(user.id, { status: "ACTIVE" })}>Reativar</button>
                    )}
                    {user.status === "BLOCKED" && (
                      <button type="button" onClick={() => void unlockUser(user.id)}>Desbloquear</button>
                    )}
                    {user.status !== "ACTIVE" && (
                      <button type="button" onClick={() => void resendInvitation(user.id)}>Reenviar convite</button>
                    )}
                    {rowMessage?.userId === user.id && <p className="user-actions__message">{rowMessage.text}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
