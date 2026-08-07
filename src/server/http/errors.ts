import { ZodError } from "zod";

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: FieldErrors,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Os dados informados são inválidos", fieldErrors?: FieldErrors) {
    super("VALIDATION_ERROR", message, 422, fieldErrors);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Autenticação necessária") {
    super("UNAUTHENTICATED", message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Você não tem permissão para esta ação") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "O recurso está em conflito com o estado atual") {
    super("CONFLICT", message, 409);
  }
}

function zodFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_form";
    fields[field] = [...(fields[field] ?? []), issue.message];
  }
  return fields;
}

export function mapException(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new ValidationError(undefined, zodFieldErrors(error));

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (code === "P2002") return new ConflictError("Já existe um registro com estes dados");
    if (code === "P2025") return new NotFoundError();
  }

  return new AppError("INTERNAL_ERROR", "Não foi possível concluir a solicitação", 500);
}
