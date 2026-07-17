import { Link, isRouteErrorResponse, useLocation, useRouteError } from "react-router";

import { AppTopBar } from "@/app/components/AppTopBar";
import { Button } from "@/components/ui/button";

function getStatusSummary(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText || "Route Error"}`;
  }

  return "404 Route not found";
}

function getErrorDetail(error: unknown): string {
  if (!isRouteErrorResponse(error)) {
    return "No route matched this URL.";
  }

  if (typeof error.data === "string" && error.data.trim().length > 0) {
    return error.data;
  }

  return "The route exists in neither index nor child route definitions.";
}

/**
 * 404 error page used as the router's error boundary.
 *
 * Displays the route status, path, and a contextual error detail message,
 * with a link back to the landing page.
 */
export function NotFoundPage() {
  const error = useRouteError();
  const location = useLocation();
  const statusSummary = getStatusSummary(error);
  const errorDetail = getErrorDetail(error);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-65 dark:opacity-45"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <AppTopBar className="bg-background/86 backdrop-blur-md" />

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-65px)] w-full max-w-400 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <section className="w-full max-w-2xl space-y-5 rounded-2xl border border-border/70 bg-card/92 p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="font-mono text-6xl font-semibold tracking-tight sm:text-7xl">404</p>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Page not found</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              The page you requested does not exist or is no longer available.
            </p>
          </div>

          <Button asChild className="rounded-full">
            <Link to="/">Back to main page</Link>
          </Button>

          <div className="space-y-2 border-t border-border/60 pt-4 font-mono text-xs text-muted-foreground">
            <p>{`status: ${statusSummary}`}</p>
            <p>{`path: ${location.pathname || "/"}`}</p>
            <p>{`detail: ${errorDetail}`}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
