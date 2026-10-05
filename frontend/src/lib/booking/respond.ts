import "server-only";

// Small helpers for the booking route handlers: every response is `no-store`, and errors made by the
// website itself use the backend's error body shape.

export function noStoreJson(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function errorJson(status: number, code: string, message: string, requestId: string, headers: Record<string, string> = {}): Response {
  return noStoreJson({ error: { code, message, requestId } }, status, headers);
}
