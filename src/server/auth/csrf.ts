const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function hasTrustedOrigin(request: Request, applicationUrl: string): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(applicationUrl).origin;
  } catch {
    return false;
  }
}
