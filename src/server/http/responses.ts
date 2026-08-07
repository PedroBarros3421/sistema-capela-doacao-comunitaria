import { mapException } from "@/server/http/errors";

type SuccessOptions = {
  status?: number;
  headers?: HeadersInit;
  meta?: Record<string, unknown>;
};

export function successResponse<T>(data: T, options: SuccessOptions = {}): Response {
  return Response.json(
    options.meta ? { data, meta: options.meta } : { data },
    { status: options.status ?? 200, headers: options.headers },
  );
}

export function noContentResponse(headers?: HeadersInit): Response {
  return new Response(null, { status: 204, headers });
}

export function errorResponse(error: unknown, requestId?: string): Response {
  const mapped = mapException(error);
  return Response.json(
    {
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.fieldErrors ? { fieldErrors: mapped.fieldErrors } : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
    { status: mapped.status },
  );
}
