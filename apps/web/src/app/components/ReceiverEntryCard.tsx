import { useState } from "react";
import { Link2, QrCode, ShieldCheck } from "lucide-react";

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

type ReceiverEntryCardProps = {
  initialRoomCode?: string;
};

/**
 * Placeholder entry surface for joining a sender room.
 */
export function ReceiverEntryCard({ initialRoomCode }: ReceiverEntryCardProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");

  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Join a room</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Enter a code or paste a link to connect with the sender.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Awaiting room
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Room code
          </span>
          <input
            type="text"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="AB12-CD"
            className="h-11 w-full rounded-xl border border-border/80 bg-background px-4 font-mono text-sm tracking-[0.12em] outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
            aria-label="Room code"
            autoComplete="off"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background/85 p-3">
            <p className="text-sm font-medium">Session trust</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verify sender fingerprint before accepting files.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/85 p-3">
            <p className="text-sm font-medium">Storage target</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Placeholder for save-to-folder preferences and retention policy.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
        <Button size="sm" className="rounded-full">
          Join room
        </Button>
        <Button size="sm" variant="outline" className="rounded-full">
          <QrCode className="h-3.5 w-3.5" />
          Scan QR
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full">
          <Link2 className="h-3.5 w-3.5" />
          Paste invite link
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          View trust tips
        </Button>
      </CardFooter>
    </Card>
  );
}
