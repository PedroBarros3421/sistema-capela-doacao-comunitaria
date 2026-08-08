"use client";

import { Suspense, type FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import { Field } from "@/components/shared/Field";

type PageState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function ConviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<PageState>({ status: "idle" });

  if (!token) {
    return (
      <main className="public-access-page">
        <div className="public-access-card">
          <Alert variant="error">
            Link de convite inválido ou ausente. Solicite um novo convite ao administrador.
          </Alert>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    const newPassword = form.get("newPassword") as string;

    try {
      const response = await fetch("/api/public/access/invitation", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setState({ status: "success" });
        return;
      }

      const data = await response.json() as { error: { message: string } };
      setState({ status: "error", message: data.error?.message ?? "Não foi possível ativar a conta." });
    } catch {
      setState({ status: "error", message: "Erro de conexão. Tente novamente." });
    }
  }

  return (
    <main className="public-access-page">
      <div className="public-access-card">
        <header>
          <h1>Ativar conta</h1>
          <p>Defina uma senha para acessar o painel administrativo.</p>
        </header>

        {state.status === "success" && (
          <Alert variant="success">
            Senha definida com sucesso. <a href="/admin/login">Acessar o painel</a>
          </Alert>
        )}
        {state.status === "error" && (
          <Alert variant="error">{state.message}</Alert>
        )}

        {state.status !== "success" && (
          <form onSubmit={handleSubmit} noValidate>
            <Field
              label="Nova senha"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={state.status === "submitting"}
            />
            <Button type="submit" loading={state.status === "submitting"}>Confirmar senha</Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={<main className="public-access-page" aria-busy="true" />}>
      <ConviteForm />
    </Suspense>
  );
}
