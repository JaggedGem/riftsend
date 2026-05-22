import { LaptopMinimal, Smartphone, Tablet } from "lucide-react";

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

type PeerDevice = {
  name: string;
  channel: string;
  progress: number;
  icon: typeof LaptopMinimal;
  status: "Connected" | "Waiting" | "Completed";
};

const PEER_DEVICES: PeerDevice[] = [
  {
    name: "Bogdan’s MacBook",
    channel: "Direct P2P",
    progress: 72,
    icon: LaptopMinimal,
    status: "Connected",
  },
  {
    name: "QA iPad",
    channel: "Relay assisted",
    progress: 38,
    icon: Tablet,
    status: "Waiting",
  },
  {
    name: "Android test phone",
    channel: "Direct P2P",
    progress: 100,
    icon: Smartphone,
    status: "Completed",
  },
];

/**
 * Placeholder card showing how sender can manage receiver queue states.
 */
export function SenderTransferQueueCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <CardTitle className="text-lg tracking-tight">Delivery queue</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Live receiver status placeholders for multi-device handoffs.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-5">
        {PEER_DEVICES.map((device) => {
          const Icon = device.icon;

          return (
            <div
              key={device.name}
              className="rounded-xl border border-border/70 bg-background/85 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-border/70 bg-muted/50 p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{device.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{device.channel}</p>
                  </div>
                </div>

                <Badge
                  variant={device.status === "Connected" ? "default" : "secondary"}
                  className="rounded-full"
                >
                  {device.status}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${device.progress}%` }}
                  />
                </div>
                <p className="w-10 text-right text-xs text-muted-foreground">{device.progress}%</p>
              </div>
            </div>
          );
        })}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
        <Button size="sm" variant="outline" className="rounded-full">
          Pause all
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full">
          Prioritize active receiver
        </Button>
      </CardFooter>
    </Card>
  );
}
