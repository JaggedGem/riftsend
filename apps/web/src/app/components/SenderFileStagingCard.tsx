import { FileArchive, FileVideo2, FileText, Plus, Trash2 } from "lucide-react";

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

type StagedFile = {
  name: string;
  size: string;
  progress: number;
  icon: typeof FileText;
  kind: string;
};

const STAGED_FILES: StagedFile[] = [
  {
    name: "Q2-product-demo.mp4",
    size: "842 MB",
    progress: 0,
    icon: FileVideo2,
    kind: "Video",
  },
  {
    name: "launch-assets.zip",
    size: "186 MB",
    progress: 64,
    icon: FileArchive,
    kind: "Archive",
  },
  {
    name: "handoff-checklist.txt",
    size: "12 KB",
    progress: 100,
    icon: FileText,
    kind: "Text",
  },
];

/**
 * Placeholder card for selecting files and tracking staged payloads.
 */
export function SenderFileStagingCard() {
  return (
    <Card className="gap-5 border border-border/75 bg-card/95 py-0 shadow-lg shadow-black/5">
      <CardHeader className="gap-3 border-b border-border/60 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg tracking-tight">File staging</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Drag, queue, and prioritize files before broadcasting to the receiver.
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full">
            1.02 GB queued
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/35 p-5">
          <p className="text-sm font-medium">Drop files here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Placeholder for multi-file picker and folder ingestion.
          </p>
        </div>

        <div className="space-y-3">
          {STAGED_FILES.map((file) => {
            const Icon = file.icon;

            return (
              <div
                key={file.name}
                className="rounded-xl border border-border/70 bg-background/85 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-border/70 bg-muted/50 p-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {file.kind} • {file.size}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {file.progress === 0
                      ? "Pending"
                      : file.progress === 100
                        ? "Ready"
                        : "Preparing"}
                  </Badge>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
        <Button size="sm" className="rounded-full">
          <Plus className="h-3.5 w-3.5" />
          Add files
        </Button>
        <Button size="sm" variant="outline" className="rounded-full">
          <Trash2 className="h-3.5 w-3.5" />
          Clear queue
        </Button>
      </CardFooter>
    </Card>
  );
}
