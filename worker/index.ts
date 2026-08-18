import { HttpError, json, preflight } from "./lib/http";
import { dashboard } from "./routes/dashboard";
import { subjects } from "./routes/subjects";

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflight(request);
  }

  const url = new URL(request.url);

  if (request.method !== "GET") {
    return json(request, { error: "Method not allowed" }, { status: 405 });
  }

  switch (url.pathname) {
    case "/api/health": {
      await env.DB.prepare("SELECT 1").first();
      return json(request, { status: "ok", services: { database: "ok" } });
    }
    case "/api/dashboard":
      return dashboard(request, env);
    case "/api/subjects":
      return subjects(request, env);
    default:
      return json(request, { error: "Not found" }, { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(request, { error: error.message }, { status: error.status });
      }

      console.error(
        JSON.stringify({
          message: "Unhandled request error",
          method: request.method,
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      );

      return json(request, { error: "Internal server error" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
