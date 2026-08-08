"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import { Field } from "@/components/shared/Field";

type LoginState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/admin";
  const [state, setState] = useState<LoginState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push(returnTo);
        return;
      }

      const data = await response.json() as { error: { code: string; message: string } };
      const message = data.error?.message ?? "Não foi possível autenticar. Tente novamente.";
      setState({ status: "error", message });
    } catch {
      setState({ status: "error", message: "Erro de conexão. Tente novamente." });
    }
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <header>
          <h1>Acesso ao painel</h1>
          <p>Área restrita à equipe interna da Capela.</p>
        </header>

        {state.status === "error" && (
          <Alert variant="error">
            {state.message}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="E-mail"
            name="email"
            type="email"
            autoComplete="username"
            required
            disabled={state.status === "submitting"}
          />
          <Field
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={state.status === "submitting"}
          />

          <Button
            type="submit"
            variant="primary"
            size="large"
            loading={state.status === "submitting"}
          >
            Entrar
          </Button>
        </form>

        <footer>
          <a href="/acesso/redefinir">Esqueci minha senha</a>
        </footer>
      </div>
    </main>
  );
}
