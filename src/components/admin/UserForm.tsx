"use client";

import { type FormEvent, useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";

const ROLE_LABELS: Record<string, string> = {
  GENERAL_ADMIN: "Administrador geral",
  FINANCE: "Financeiro",
  INVENTORY_VOLUNTEER: "Voluntário de estoque",
};

export function UserForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    setInvitationUrl(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), role: form.get("role") }),
      });
      const body = await response.json() as { data?: { invitationUrl: string }; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível criar o usuário");
      setMessage({ kind: "success", text: "Usuário criado. Compartilhe o link de definição de senha abaixo." });
      setInvitationUrl(body.data?.invitationUrl ?? null);
      event.currentTarget.reset();
      onSuccess();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro de conexão" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="user-form" onSubmit={submit} aria-label="Criar novo usuário">
      <fieldset disabled={loading}>
        <legend>Novo usuário</legend>
        {message && <Alert variant={message.kind}>{message.text}</Alert>}
        {invitationUrl && (
          <p>
            Link de convite: <a href={invitationUrl}>{invitationUrl}</a>
          </p>
        )}
        <label>Nome<input name="name" required maxLength={160} /></label>
        <label>E-mail<input name="email" type="email" required /></label>
        <label>Papel
          <select name="role" required defaultValue="FINANCE">
            {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </fieldset>
      <Button type="submit" loading={loading}>Criar usuário</Button>
    </form>
  );
}

export { ROLE_LABELS };
