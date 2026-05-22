import { Link, useParams } from "react-router";
import { SendHorizontal, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReceiverActivityLogCard } from "@/app/components/ReceiverActivityLogCard";
import { ReceiverDownloadsCard } from "@/app/components/ReceiverDownloadsCard";
import { ReceiverEntryCard } from "@/app/components/ReceiverEntryCard";
import { ReceiverIncomingTransferCard } from "@/app/components/ReceiverIncomingTransferCard";
import { ReceiverTrustCenterCard } from "@/app/components/ReceiverTrustCenterCard";
import { TransferPageLayout } from "@/app/components/TransferPageLayout";

const RECEIVER_STATUS_BADGES = [
  { label: "Role: Receiver", variant: "secondary" as const },
  { label: "Invite-ready", variant: "outline" as const },
  { label: "Integrity checks staged", variant: "secondary" as const },
];

export function ReceiverPage() {
  const { code } = useParams();
  const initialRoomCode = code?.trim().toUpperCase();

  return (
    <TransferPageLayout
      tone="receiver"
      eyebrow="Receiver workspace"
      title="Join quickly, verify sender trust, and receive safely"
      description="This placeholder receiver flow covers room entry, transfer acceptance, download orchestration, and post-transfer safety checks."
      statusBadges={RECEIVER_STATUS_BADGES}
      headerActions={
        <>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/s">
              <SendHorizontal className="h-3.5 w-3.5" />
              Open sender
            </Link>
          </Button>
          {initialRoomCode ? (
            <Badge variant="secondary" className="rounded-full">
              Joining room: {initialRoomCode}
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full">
              No code prefilled
            </Badge>
          )}
          <Badge variant="secondary" className="rounded-full">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Placeholder mode
          </Badge>
        </>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr] 2xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          <ReceiverEntryCard initialRoomCode={initialRoomCode} />
          <ReceiverIncomingTransferCard />
          <ReceiverDownloadsCard />
        </div>

        <div className="grid gap-4">
          <ReceiverTrustCenterCard />
          <ReceiverActivityLogCard />
        </div>
      </section>
    </TransferPageLayout>
  );
}
