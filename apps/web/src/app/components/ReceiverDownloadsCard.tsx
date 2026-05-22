import { FileText, FolderDown, ImageIcon, PackageCheck } from "lucide-react";

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

type DownloadItem = {
  name: string;
  size: string;
  progress: number;
  icon: typeof FileText;
  status: "Queued" | "Downloading" | "Complete";
};

const DOWNLOAD_ITEMS: DownloadItem[] = [
  {
    name: "preview-sheet.txt",
    size: "12 KB",
    progress: 100,
    icon: FileText,
    status: "Complete",
  },
  {
    name: "team-photo.png",
    size: "4.3 MB",
    progress: 56,
    icon: ImageIcon,
    status: "Downloading",
  },
  {
    name: "full-release-package.zip",
    size: "1.4 GB",
    progress: 0,
    icon: PackageCheck,
    status: "Queued",
  },
];

/**
 * Placeholder queue for receiver-side download progress and storage actions.
 */
export function ReceiverDownloadsCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">Download queue</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Watch staged downloads and choose where each file should be saved.
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full">
            2.0 GB total
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-5">
        {DOWNLOAD_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.name}
              className="rounded-xl border border-border/70 bg-background/85 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-border/70 bg-muted/50 p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.size}</p>
                  </div>
                </div>

                <Badge
                  variant={item.status === "Downloading" ? "default" : "secondary"}
                  className="rounded-full"
                >
                  {item.status}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <p className="w-10 text-right text-xs text-muted-foreground">{item.progress}%</p>
              </div>
            </div>
          );
        })}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
        <Button size="sm" className="rounded-full">
          <FolderDown className="h-3.5 w-3.5" />
          Set save location
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground">
          Verify all checksums
        </Button>
      </CardFooter>
    </Card>
  );
}
