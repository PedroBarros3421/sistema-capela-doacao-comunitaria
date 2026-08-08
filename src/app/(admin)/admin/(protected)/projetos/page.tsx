"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";

type Project = { id: string; name: string; status: "ACTIVE" | "INACTIVE"; createdAt: string };

export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/projects")
      .then(async (response) => {
        const body = await response.json() as { data?: Project[]; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar os projetos");
        return body.data ?? [];
      })
      .then(setProjects)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível criar o projeto");
      event.currentTarget.reset();
      setLoading(true);
      load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro de conexão" });
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(project: Project) {
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: project.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível atualizar o projeto");
      setLoading(true);
      load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro de conexão" });
    }
  }

  return (
    <div className="admin-projects-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Governança</p>
          <h1>Projetos</h1>
          <p className="page-header__description">Cadastre destinos de doações e controle sua disponibilidade.</p>
        </div>
      </header>

      <form className="project-form" onSubmit={createProject} aria-label="Criar novo projeto">
        <label>Nome do projeto<input name="name" required maxLength={120} /></label>
        <Button type="submit" loading={creating}>Criar projeto</Button>
      </form>

      {message && <Alert variant={message.kind}>{message.text}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {loading ? <p aria-busy="true">Carregando projetos…</p> : projects.length === 0 ? (
        <p className="empty-state" role="status">Nenhum projeto cadastrado.</p>
      ) : (
        <div className="table-scroll">
          <table aria-label="Projetos cadastrados">
            <thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.status === "ACTIVE" ? "Ativo" : "Inativo"}</td>
                  <td>
                    <button type="button" onClick={() => void toggleStatus(project)}>
                      {project.status === "ACTIVE" ? "Desativar" : "Reativar"}
                    </button>
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
