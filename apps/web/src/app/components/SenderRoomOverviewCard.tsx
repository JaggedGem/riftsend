import { Clock3, Copy, Link2, QrCode, ShieldCheck, Wifi } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type RoomStat = {
  label: string;
  value: string;
  icon: typeof Wifi;
};

const ROOM_STATS: RoomStat[] = [
  {
    label: "Security",
    value: "End-to-end key ready",
    icon: ShieldCheck,
  },
  {
    label: "Connectivity",
    value: "Local + relay fallback",
    icon: Wifi,
  },
  {
    label: "Expires in",
    value: "27 minutes",
    icon: Clock3,
  },
];

/**
 * Placeholder card for sender room metadata and sharing actions.
 */
export function SenderRoomOverviewCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Session setup</CardTitle>
            <CardDescription className="max-w-xl text-sm leading-relaxed">
              Create a short-lived room and share only what this receiver needs.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Room online
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Room code
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.12em]">
            J7K4-9P
          </p>
          <p className="mt-1 text-xs text-muted-foreground">share.riftsend.app/r/J7K4-9P</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {ROOM_STATS.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-border/70 bg-background/80 p-3"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {stat.label}
                </div>
                <p className="mt-2 text-sm font-medium">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
        <Button size="sm" className="rounded-full">
          <Copy className="h-3.5 w-3.5" />
          Copy invite link
        </Button>
        <Button size="sm" variant="outline" className="rounded-full">
          <QrCode className="h-3.5 w-3.5" />
          Show QR
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full">
          <Link2 className="h-3.5 w-3.5" />
          Regenerate link
        </Button>
      </CardFooter>
    </Card>
  );
}
