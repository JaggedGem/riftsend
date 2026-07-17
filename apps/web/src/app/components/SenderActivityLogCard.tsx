import { Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SENDER_LOG_ITEMS = [
  "11:08:13 room created (J7K4-9P)",
  "11:08:15 sender channel initialized",
  "11:08:21 receiver discovered on local network",
  "11:08:24 manifest sent (3 files)",
  "11:08:29 transfer chunking calibrated to 64 KiB",
  "11:08:31 receiver accepted transfer request",
  "11:08:37 delivery pace raised to 8.7 MB/s",
  "11:08:42 checksum watchdog armed",
];

/**
 * Placeholder stream for sender-side diagnostics and event sequencing.
 */
export function SenderActivityLogCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Activity timeline</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Dev-facing placeholder feed for signaling and WebRTC diagnostics.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full">
            <Terminal className="mr-1 h-3 w-3" />
            Verbose mode
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-3">
          {SENDER_LOG_ITEMS.map((item) => (
            <p key={item} className="font-mono text-xs text-muted-foreground">
              {item}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
