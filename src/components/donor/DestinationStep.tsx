import { Field } from "@/components/shared/Field";

export type PublicProject = { id: string; name: string };
export type DonorIdentityForm = { name: string; email: string; phone: string; cpfCnpj: string };

type DestinationStepProps = {
  projects: PublicProject[];
  destination: string;
  donor: DonorIdentityForm;
  monthly: boolean;
  onDestinationChange: (value: string) => void;
  onDonorChange: (value: DonorIdentityForm) => void;
};

export function DestinationStep({ projects, destination, donor, monthly, onDestinationChange, onDonorChange }: DestinationStepProps) {
  const update = (field: keyof DonorIdentityForm, value: string) => onDonorChange({ ...donor, [field]: value });
  return (
    <div className="donor-step__stack">
      <fieldset className="donor-step__fieldset">
        <legend>Escolha o destino</legend>
        <div className="donor-options">
          <label className="donor-option">
            <input type="radio" name="destination" value="MOST_NEEDED" checked={destination === "MOST_NEEDED"} onChange={() => onDestinationChange("MOST_NEEDED")} />
            <span><strong>Onde for mais necessário</strong><small>A capela direciona conforme a necessidade atual</small></span>
          </label>
          {projects.map((project) => (
            <label className="donor-option" key={project.id}>
              <input type="radio" name="destination" value={project.id} checked={destination === project.id} onChange={() => onDestinationChange(project.id)} />
              <span><strong>{project.name}</strong></span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="donor-step__fieldset">
        <legend>{monthly ? "Identifique-se para a doação mensal" : "Quer receber recibo ou acessar seu histórico?"}</legend>
        <p>{monthly ? "A identificação é necessária para registrar a recorrência simulada." : "Estes dados são opcionais. Para recibo, informe um CPF ou CNPJ válido."}</p>
        <div className="donor-fields">
          <Field label="Nome" value={donor.name} onChange={(event) => update("name", event.target.value)} required={monthly} autoComplete="name" />
          <Field label="E-mail" type="email" value={donor.email} onChange={(event) => update("email", event.target.value)} required={monthly} autoComplete="email" />
          <Field label="Telefone" value={donor.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" />
          <Field label="CPF ou CNPJ" value={donor.cpfCnpj} onChange={(event) => update("cpfCnpj", event.target.value)} inputMode="numeric" />
        </div>
      </fieldset>
    </div>
  );
}
