"use client";

import { type FormEvent, useEffect, useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import { Field } from "@/components/shared/Field";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type ProfileState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type PasswordState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

const ROLE_LABELS: Record<string, string> = {
  GENERAL_ADMIN: "Administrador Geral",
  FINANCE: "Financeiro",
  INVENTORY_VOLUNTEER: "Voluntário de Estoque",
};

export default function PerfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>({ status: "idle" });
  const [passwordState, setPasswordState] = useState<PasswordState>({ status: "idle" });

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json() as Promise<{ data: User }>)
      .then(({ data }) => setUser(data))
      .catch(() => {});
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });

      if (response.ok) {
        const { data } = await response.json() as { data: User };
        setUser(data);
        setProfileState({ status: "success", message: "Perfil atualizado." });
        return;
      }
      const err = await response.json() as { error: { message: string } };
      setProfileState({ status: "error", message: err.error?.message ?? "Erro ao atualizar." });
    } catch {
      setProfileState({ status: "error", message: "Erro de conexão." });
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/me/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });

      if (response.ok) {
        setPasswordState({ status: "success" });
        (event.target as HTMLFormElement).reset();
        return;
      }
      const err = await response.json() as { error: { message: string } };
      setPasswordState({ status: "error", message: err.error?.message ?? "Erro ao alterar senha." });
    } catch {
      setPasswordState({ status: "error", message: "Erro de conexão." });
    }
  }

  if (!user) {
    return <p aria-busy="true">Carregando perfil…</p>;
  }

  return (
    <div className="admin-profile-page">
      <header>
        <h1>Meu Perfil</h1>
        <dl className="admin-profile-meta">
          <dt>E-mail</dt><dd>{user.email}</dd>
          <dt>Papel</dt><dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
        </dl>
      </header>

      <section aria-labelledby="profile-section">
        <h2 id="profile-section">Dados básicos</h2>

        {profileState.status === "success" && <Alert variant="success">{profileState.message}</Alert>}
        {profileState.status === "error" && <Alert variant="error">{profileState.message}</Alert>}

        <form onSubmit={handleProfileSubmit} noValidate>
          <Field
            label="Nome"
            name="name"
            defaultValue={user.name}
            required
            disabled={profileState.status === "submitting"}
          />
          <Button type="submit" loading={profileState.status === "submitting"}>Salvar</Button>
        </form>
      </section>

      <section aria-labelledby="password-section">
        <h2 id="password-section">Trocar senha</h2>

        {passwordState.status === "success" && (
          <Alert variant="success">Senha alterada com sucesso.</Alert>
        )}
        {passwordState.status === "error" && (
          <Alert variant="error">{passwordState.message}</Alert>
        )}

        <form onSubmit={handlePasswordSubmit} noValidate>
          <Field
            label="Senha atual"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={passwordState.status === "submitting"}
          />
          <Field
            label="Nova senha"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={passwordState.status === "submitting"}
          />
          <Button type="submit" loading={passwordState.status === "submitting"}>Alterar senha</Button>
        </form>
      </section>
    </div>
  );
}
