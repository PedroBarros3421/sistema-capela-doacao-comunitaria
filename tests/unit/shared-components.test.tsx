import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Alert } from "@/components/shared/Alert";
import { AsyncState } from "@/components/shared/AsyncState";
import { Button } from "@/components/shared/Button";
import { Dialog } from "@/components/shared/Dialog";
import { Field } from "@/components/shared/Field";

describe("shared accessible components", () => {
  it("connects labels, hints and errors to fields", () => {
    render(<Field label="E-mail" hint="Usado para contato" error="E-mail inválido" />);

    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Usado para contato E-mail inválido");
  });

  it("announces errors and asynchronous progress", () => {
    render(<><Alert variant="error">Falha</Alert><AsyncState status="loading" /></>);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  });

  it("disables a loading button", () => {
    render(<Button loading>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Aguarde…" })).toBeDisabled();
  });

  it("provides a labelled modal and closes it", () => {
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} title="Confirmar ação">Conteúdo</Dialog>);

    expect(screen.getByRole("dialog", { name: "Confirmar ação" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
