import type { ReactNode } from "react";

import { AppTopBar } from "@/app/components/AppTopBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PageTone = "sender" | "receiver" | "neutral";

type TransferPageLayoutProps = {
  title: string;
  description: string;
  eyebrow?: string;
  tone?: PageTone;
  statusBadges?: Array<{
    label: string;
    variant?: "default" | "secondary" | "outline";
  }>;
  headerActions?: ReactNode;
  children: ReactNode;
};

const TONE_BACKGROUND_CLASS: Record<PageTone, string> = {
  sender:
    "bg-[radial-gradient(circle_at_20%_10%,color-mix(in_oklab,var(--color-primary)_15%,transparent)_0%,transparent_48%)]",
  receiver:
    "bg-[radial-gradient(circle_at_80%_12%,color-mix(in_oklab,var(--color-primary)_12%,transparent)_0%,transparent_52%)]",
  neutral:
    "bg-[radial-gradient(circle_at_50%_10%,color-mix(in_oklab,var(--color-muted)_30%,transparent)_0%,transparent_56%)]",
};

/**
 * Shared layout shell used by Sender and Receiver pages.
 */
export function TransferPageLayout({
  title,
  description,
  eyebrow,
  tone = "neutral",
  statusBadges,
  headerActions,
  children,
}: TransferPageLayoutProps) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-70 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0", TONE_BACKGROUND_CLASS[tone])}
      />

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

      <main
        id="main-content"
        className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8"
      >
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p>
            </div>

            {headerActions ? (
              <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
            ) : null}
          </div>

          {statusBadges && statusBadges.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {statusBadges.map((badge) => (
                <Badge
                  key={badge.label}
                  variant={badge.variant ?? "outline"}
                  className="rounded-full"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </section>

        {children}
      </main>
    </div>
  );
}
