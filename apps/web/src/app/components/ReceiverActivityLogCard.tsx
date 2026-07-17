import { Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RECEIVER_LOG_ITEMS = [
  "11:09:04 receiver workspace initialized",
  "11:09:07 invite code pasted (J7K4-9P)",
  "11:09:09 signaling handshake started",
  "11:09:13 sender fingerprint validated",
  "11:09:18 manifest received (3 files)",
  "11:09:21 transfer accepted by user",
  "11:09:24 writing chunks to temporary storage",
  "11:09:29 background integrity check running",
];

/**
 * Placeholder event stream for receiver diagnostics and debugging.
 */
export function ReceiverActivityLogCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Receiver events</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Placeholder telemetry for connection, download, and integrity phases.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full">
            <Terminal className="mr-1 h-3 w-3" />
            Diagnostics enabled
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-3">
          {RECEIVER_LOG_ITEMS.map((item) => (
            <p key={item} className="font-mono text-xs text-muted-foreground">
              {item}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
