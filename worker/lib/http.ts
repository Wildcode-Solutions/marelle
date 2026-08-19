const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const CAPACITOR_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost"]);

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function allowedOrigin(request: Request, configuredOrigins = ""): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  const configured = configuredOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    origin === requestOrigin ||
    LOCAL_ORIGIN.test(origin) ||
    CAPACITOR_ORIGINS.has(origin) ||
    configured.includes(origin)
  ) {
    return origin;
  }

  return null;
}

export function corsHeaders(request: Request, configuredOrigins = ""): Record<string, string> {
  const origin = allowedOrigin(request, configuredOrigins);

  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400",
    ...(origin ? { "Access-Control-Allow-Credentials": "true" } : {}),
    Vary: "Origin",
  };
}

export function assertAllowedOrigin(request: Request, configuredOrigins = ""): void {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(request, configuredOrigins)) {
    throw new HttpError(403, "Origin not allowed");
  }
}

export async function readJsonObject(
  request: Request,
  maxBytes = 16_384,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Le corps de la requête doit être au format JSON.");
  }

  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, "Le corps de la requête est trop volumineux.");
  }

  if (!request.body) {
    throw new HttpError(400, "Le corps de la requête est vide.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Le corps de la requête est trop volumineux.");
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new HttpError(400, "Le corps JSON est invalide.");
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "Le corps JSON doit être un objet.");
  }

  return value as Record<string, unknown>;
}

export function json(request: Request, data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  for (const [name, value] of Object.entries(corsHeaders(request))) {
    headers.set(name, value);
  }

  return Response.json(data, { ...init, headers });
}

export function applyCors(
  response: Response,
  request: Request,
  configuredOrigins = "",
): Response {
  for (const [name, value] of Object.entries(corsHeaders(request, configuredOrigins))) {
    response.headers.set(name, value);
  }
  return response;
}

export function preflight(request: Request, configuredOrigins = ""): Response {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(request, configuredOrigins)) {
    return json(request, { error: "Origin not allowed" }, { status: 403 });
  }

  return new Response(null, { status: 204, headers: corsHeaders(request, configuredOrigins) });
}
