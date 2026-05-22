import { useEffect, useRef, useState } from "react";
import {
  DiscoveryPeersOverlay,
  type DiscoveryPeer,
} from "@/app/components/DiscoveryPeersOverlay";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Download,
  Moon,
  SendHorizontal,
  Sun,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router";

type ThemeMode = "light" | "dark";

type RoleOption = {
  id: string;
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: typeof SendHorizontal;
  variant: "default" | "outline";
  cardClassName: string;
};

const THEME_STORAGE_KEY = "riftsend-theme";
const EDGE_SPAWN_LIMIT = 8;
const EMPTY_DISCOVERY_PEERS: DiscoveryPeer[] = [];

/**
 * Creates a per-load placement seed used by discovery-card positioning.
 * Uses cryptographic randomness when available, with a Math.random fallback.
 *
 * @returns A non-zero 32-bit positive seed.
 */
function createPlacementSeed(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  if (typeof window.crypto !== "undefined") {
    const seedBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(seedBuffer);
    return seedBuffer[0] || 1;
  }

  return Math.max(1, Math.floor(Math.random() * 0xffffffff));
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: "sender",
    href: "/s",
    title: "Sender",
    description: "Create a room, choose files, and share one secure link.",
    cta: "Start Sending",
    icon: SendHorizontal,
    variant: "default",
    cardClassName:
      "border-primary/30 bg-primary text-primary-foreground ring-primary/25",
  },
  {
    id: "receiver",
    href: "/r",
    title: "Receiver",
    description: "Join by code or link and collect files without friction.",
    cta: "Start Receiving",
    icon: Download,
    variant: "outline",
    cardClassName: "border-border/80 bg-background text-foreground",
  },
];

/**
 * Resolves the initial theme from persisted preference or system preference.
 *
 * @returns The initial theme mode for first render.
 */
function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const persistedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (persistedTheme === "light" || persistedTheme === "dark") {
    return persistedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Landing page entry with role selection and ambient discovery overlay.
 */
export function LandingPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    getInitialTheme(),
  );
  const [isLocalDiscoverable, setIsLocalDiscoverable] = useState(true);
  const nearbyPeers = EMPTY_DISCOVERY_PEERS;
  const [placementSeed] = useState(() => createPlacementSeed());
  const roleCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-70 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="rounded-md text-sm font-semibold tracking-[0.14em] text-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none"
          >
            RIFTSEND
          </Link>

          <Button
            onClick={() =>
              setThemeMode((current) => (current === "dark" ? "light" : "dark"))
            }
            aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
            variant="outline"
            size="icon-sm"
            className="rounded-full border-border/70 bg-card/80 backdrop-blur-sm"
          >
            {themeMode === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <main
        id="main-content"
        className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center justify-center overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      >
        <DiscoveryPeersOverlay
          peers={nearbyPeers}
          anchorRef={roleCardRef}
          edgeSpawnLimit={EDGE_SPAWN_LIMIT}
          placementSeed={placementSeed}
        />

        <section className="relative flex w-full justify-center">
          <div className="relative w-full max-w-3xl">
            <Card
              ref={roleCardRef}
              className="max-h-full w-full overflow-y-auto border-border/75 bg-card/95 py-0 shadow-2xl shadow-black/8 backdrop-blur-sm"
            >
              <CardHeader className="items-center px-6 pt-8 text-center sm:px-10 sm:pt-10">
                <CardTitle className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  Choose your role
                </CardTitle>
                <CardDescription className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Sender starts the room. Receiver joins it. RiftSend keeps both
                  flows clear and fast.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3 px-6 pb-0 sm:grid-cols-2 sm:gap-4 sm:px-10">
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isPrimaryOption = option.variant === "default";

                  return (
                    <Card
                      key={option.id}
                      className={cn(
                        "h-full gap-4 rounded-2xl border py-0 ring-1 transition-colors duration-200",
                        option.cardClassName,
                      )}
                    >
                      <CardHeader className="gap-3 px-5 pt-5">
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isPrimaryOption
                              ? "text-primary-foreground"
                              : "text-primary",
                          )}
                        />
                        <CardTitle
                          className={cn(
                            "text-xl tracking-tight",
                            isPrimaryOption
                              ? "text-primary-foreground"
                              : "text-foreground",
                          )}
                        >
                          {option.title}
                        </CardTitle>
                        <CardDescription
                          className={cn(
                            "text-sm leading-relaxed",
                            isPrimaryOption
                              ? "text-primary-foreground/85"
                              : "text-muted-foreground",
                          )}
                        >
                          {option.description}
                        </CardDescription>
                      </CardHeader>

                      <CardFooter className="px-5 pb-5">
                        <Button
                          asChild
                          variant={option.variant}
                          size="lg"
                          className={cn(
                            "w-full justify-between rounded-xl",
                            isPrimaryOption &&
                              "border border-primary-foreground/20 bg-primary-foreground/12 text-primary-foreground hover:bg-primary-foreground/18",
                          )}
                        >
                          <Link to={option.href}>
                            {option.cta}
                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/button:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </CardContent>

              <CardFooter className="flex-col gap-4 px-6 pb-8 pt-6 sm:px-10 sm:pb-10">
                <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {isLocalDiscoverable ? (
                    <>
                      <Wifi className="h-4 w-4" />
                      Your device is discoverable on the local network
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4" />
                      Your device is undiscoverable on the local network
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={isLocalDiscoverable}
                    onCheckedChange={(checked) =>
                      setIsLocalDiscoverable(checked)
                    }
                    aria-label={
                      isLocalDiscoverable
                        ? "Make me undiscoverable on the local network"
                        : "Make me discoverable on the local network"
                    }
                  />
                  Toggle local discoverability
                </div>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
