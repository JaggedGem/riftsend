import { Link } from "react-router";
import { Compass, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SenderActivityLogCard } from "@/app/components/SenderActivityLogCard";
import { SenderDeliveryControlsCard } from "@/app/components/SenderDeliveryControlsCard";
import { SenderFileStagingCard } from "@/app/components/SenderFileStagingCard";
import { SenderRoomOverviewCard } from "@/app/components/SenderRoomOverviewCard";
import { SenderTransferQueueCard } from "@/app/components/SenderTransferQueueCard";
import { TransferPageLayout } from "@/app/components/TransferPageLayout";

const SENDER_STATUS_BADGES = [
  { label: "Role: Sender", variant: "secondary" as const },
  { label: "Encrypted channel placeholder", variant: "outline" as const },
  { label: "WebRTC handshake ready", variant: "secondary" as const },
];

/**
 * Sender workspace page.
 *
 * Lays out room creation, file staging, delivery queue, control toggles,
 * and diagnostics. Currently renders placeholder cards — real state wiring
 * is the next step.
 */
export function SenderPage() {
  return (
    <TransferPageLayout
      tone="sender"
      eyebrow="Sender workspace"
      title="Prepare, verify, and deliver files with confidence"
      description="This workspace is structured for the complete sender flow: room creation, payload staging, transfer policy controls, and diagnostics."
      statusBadges={SENDER_STATUS_BADGES}
      headerActions={
        <>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/r">
              <Compass className="h-3.5 w-3.5" />
              Preview receiver
            </Link>
          </Button>
          <Badge variant="secondary" className="rounded-full">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Placeholder mode
          </Badge>
        </>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr] 2xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          <SenderRoomOverviewCard />
          <SenderFileStagingCard />
          <SenderTransferQueueCard />
        </div>

        <div className="grid gap-4">
          <SenderDeliveryControlsCard />
          <SenderActivityLogCard />
        </div>
      </section>
    </TransferPageLayout>
  );
}
