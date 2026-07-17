import { useState } from "react";
import { Fingerprint, ShieldCheck, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type TrustItem = {
  id: string;
  label: string;
  detail: string;
};

const TRUST_ITEMS: TrustItem[] = [
  {
    id: "require-fingerprint",
    label: "Require fingerprint match",
    detail: "Accept files only from verified sender fingerprints.",
  },
  {
    id: "quarantine",
    label: "Quarantine unknown types",
    detail: "Hold unrecognized file types for manual review.",
  },
  {
    id: "auto-clean",
    label: "Auto-clean temp chunks",
    detail: "Delete temporary transfer chunks after successful merge.",
  },
];

/**
 * Placeholder trust controls for receiver-side safety policies.
 */
export function ReceiverTrustCenterCard() {
  const [trustState, setTrustState] = useState<Record<string, boolean>>({
    "require-fingerprint": true,
    quarantine: true,
    "auto-clean": true,
  });

  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Trust center</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Placeholder safety checks before writing data to disk.
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full">
            <Fingerprint className="mr-1 h-3 w-3" />
            Fingerprint verified
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/85 p-3"
          >
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>

            <Switch
              checked={Boolean(trustState[item.id])}
              onCheckedChange={(checked) =>
                setTrustState((current) => ({
                  ...current,
                  [item.id]: checked,
                }))
              }
              aria-label={`${item.label} toggle`}
            />
          </div>
        ))}

        <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
          <div className="flex items-start gap-2">
            {trustState["require-fingerprint"] ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
            ) : (
              <ShieldOff className="mt-0.5 h-4 w-4 text-destructive" />
            )}
            <p className="text-xs text-muted-foreground">
              Placeholder trust gate: all policies must pass before writing files.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
