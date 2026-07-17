import type { ReactNode } from "react";
import { Link } from "react-router";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThemeMode } from "@/app/useThemeMode";

type AppTopBarProps = {
  className?: string;
  contentClassName?: string;
  rightSlot?: ReactNode;
};

/**
 * Shared app header used across all routes.
 */
export function AppTopBar({ className, contentClassName, rightSlot }: AppTopBarProps) {
  const { themeMode, toggleThemeMode } = useThemeMode();

  return (
    <header className={cn("relative z-30 border-b border-border/60", className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8",
          contentClassName,
        )}
      >
        <Link
          to="/"
          className="rounded-md text-sm font-semibold tracking-[0.14em] text-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none"
        >
          RIFTSEND
        </Link>

        <div className="flex items-center gap-2">
          {rightSlot}
          <Button
            onClick={toggleThemeMode}
            aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
            variant="outline"
            size="icon-sm"
            className="rounded-full border-border/70 bg-card/80 backdrop-blur-sm"
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
