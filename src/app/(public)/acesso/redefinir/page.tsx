"use client";

import { Suspense, type FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import { Field } from "@/components/shared/Field";

type PageState =
  | { view: "request"; status: "idle" }
  | { view: "request"; status: "submitting" }
  | { view: "request"; status: "success"; message: string }
  | { view: "request"; status: "error"; message: string }
  | { view: "set"; status: "idle" }
  | { view: "set"; status: "submitting" }
  | { view: "set"; status: "success" }
  | { view: "set"; status: "error"; message: string };

function RedefinirSenhaForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>(
    token ? { view: "set", status: "idle" } : { view: "request", status: "idle" },
  );

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ view: "request", status: "submitting" });

    const form = new FormData(event.currentTarget);
    const email = form.get("email") as string;

    try {
      const response = await fetch("/api/public/access/password-reset-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as { message: string };
      setState({ view: "request", status: "success", message: data.message });
    } catch {
      setState({ view: "request", status: "error", message: "Erro ao processar a solicitação." });
    }
  }

  async function handleSetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ view: "set", status: "submitting" });

    const form = new FormData(event.currentTarget);
    const newPassword = form.get("newPassword") as string;

    try {
      const response = await fetch("/api/public/access/password-reset", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setState({ view: "set", status: "success" });
        return;
      }

      const data = await response.json() as { error: { message: string } };
      setState({ view: "set", status: "error", message: data.error?.message ?? "Erro ao redefinir senha." });
    } catch {
      setState({ view: "set", status: "error", message: "Erro de conexão. Tente novamente." });
    }
  }

  if (state.view === "request") {
    return (
      <main className="public-access-page">
        <div className="public-access-card">
          <header>
            <h1>Recuperar senha</h1>
            <p>Informe seu e-mail e enviaremos as instruções.</p>
          </header>

          {state.status === "success" && (
            <Alert variant="info">{state.message}</Alert>
          )}
          {state.status === "error" && (
            <Alert variant="error">{state.message}</Alert>
          )}

          {state.status !== "success" && (
            <form onSubmit={handleRequestSubmit} noValidate>
              <Field label="E-mail" name="email" type="email" required disabled={state.status === "submitting"} />
              <Button type="submit" loading={state.status === "submitting"}>Enviar instruções</Button>
            </form>
          )}

          <footer>
            <a href="/admin/login">Voltar ao login</a>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="public-access-page">
      <div className="public-access-card">
        <header>
          <h1>Definir nova senha</h1>
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
          <form onSubmit={handleSetSubmit} noValidate>
            <Field
              label="Nova senha"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={state.status === "submitting"}
            />
            <Button type="submit" loading={state.status === "submitting"}>Definir senha</Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<main className="public-access-page" aria-busy="true" />}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
