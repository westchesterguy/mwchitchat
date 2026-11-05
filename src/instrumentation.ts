import type { Instrumentation } from "next";

/**
 * Any request that throws is recorded for the developer page's Health tab,
 * with the path and the error, never the request body.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/log");
  const e = err as Error & { digest?: string };
  await logError("request", e.message || e.name || "Unknown error", {
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    kind: context.routeType,
    digest: e.digest ?? null,
  });
};
