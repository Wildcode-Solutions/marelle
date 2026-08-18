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

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return null;
  }

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin || LOCAL_ORIGIN.test(origin) || CAPACITOR_ORIGINS.has(origin)) {
    return origin;
  }

  return null;
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = allowedOrigin(request);

  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(
  request: Request,
  data: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  for (const [name, value] of Object.entries(corsHeaders(request))) {
    headers.set(name, value);
  }

  return Response.json(data, { ...init, headers });
}

export function preflight(request: Request): Response {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(request)) {
    return json(request, { error: "Origin not allowed" }, { status: 403 });
  }

  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
