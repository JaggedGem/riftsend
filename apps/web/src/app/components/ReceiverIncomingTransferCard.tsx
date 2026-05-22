import { Clock3, FileArchive, ShieldCheck } from "lucide-react";

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

/**
 * Placeholder card for incoming transfer preview and decision actions.
 */
export function ReceiverIncomingTransferCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Incoming payload</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Preview file manifest, size, and sender trust before downloading.
            </CardDescription>
          </div>
          <Badge className="rounded-full">Awaiting confirmation</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
          <p className="text-sm font-medium">launch-assets.zip</p>
          <p className="mt-1 text-xs text-muted-foreground">186 MB • archive • 132 files</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/85 p-3">
            <p className="text-xs text-muted-foreground">Sender</p>
            <p className="mt-1 text-sm font-medium">RiftSend Demo Host</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/85 p-3">
            <p className="text-xs text-muted-foreground">ETA</p>
            <p className="mt-1 text-sm font-medium">~28 sec</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/85 p-3">
            <p className="text-xs text-muted-foreground">Integrity hash</p>
            <p className="mt-1 font-mono text-xs font-medium">a6be...91df</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/85 p-3">
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Placeholder check: sender fingerprint matches your trusted devices.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
        <Button size="sm" className="rounded-full">
          <FileArchive className="h-3.5 w-3.5" />
          Accept transfer
        </Button>
        <Button size="sm" variant="outline" className="rounded-full">
          Ask sender to retry manifest
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Snooze request
        </Button>
      </CardFooter>
    </Card>
  );
}
