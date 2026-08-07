"use client";

import { useState } from "react";

import { Button } from "@/components/shared/Button";

export function VolunteerHelp({ contact }: { contact?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="volunteer-help" aria-label="Ajuda durante a doação">
      <Button type="button" variant="secondary" size="large" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Chamar um voluntário
      </Button>
      {open ? (
        <div className="volunteer-help__details" role="status">
          <strong>Você não precisa fazer isso sozinho.</strong>
          <p>Peça ajuda a um voluntário da capela para seguir cada etapa.</p>
          {contact ? <a href={`tel:${contact}`}>Ligar para {contact}</a> : null}
        </div>
      ) : null}
    </aside>
  );
}
