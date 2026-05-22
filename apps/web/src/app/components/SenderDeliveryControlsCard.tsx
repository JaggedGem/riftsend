import { useState } from "react";
import { Gauge, LockKeyhole, ScanSearch, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type SenderControl = {
  id: string;
  title: string;
  description: string;
  icon: typeof Gauge;
};

const CONTROL_DEFINITIONS: SenderControl[] = [
  {
    id: "adaptive-speed",
    title: "Adaptive speed",
    description: "Auto-tune chunking for Wi-Fi and relay stability.",
    icon: Gauge,
  },
  {
    id: "post-verify",
    title: "Post-transfer verify",
    description: "Run checksum validation after each file completes.",
    icon: ScanSearch,
  },
  {
    id: "strict-encryption",
    title: "Strict encryption",
    description: "Require ephemeral key exchange before transfer starts.",
    icon: LockKeyhole,
  },
];

/**
 * Placeholder control panel for sender-side reliability and security settings.
 */
export function SenderDeliveryControlsCard() {
  const [enabledControls, setEnabledControls] = useState<Record<string, boolean>>({
    "adaptive-speed": true,
    "post-verify": true,
    "strict-encryption": true,
  });

  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Delivery controls</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Placeholder toggles for throughput, trust, and resilience strategy.
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full">
            <Settings2 className="mr-1 h-3 w-3" />
            Policy profile: Balanced
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        {CONTROL_DEFINITIONS.map((control) => {
          const Icon = control.icon;

          return (
            <div
              key={control.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/85 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-border/70 bg-muted/50 p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{control.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{control.description}</p>
                </div>
              </div>

              <Switch
                checked={Boolean(enabledControls[control.id])}
                onCheckedChange={(checked) =>
                  setEnabledControls((current) => ({
                    ...current,
                    [control.id]: checked,
                  }))
                }
                aria-label={`${control.title} toggle`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
