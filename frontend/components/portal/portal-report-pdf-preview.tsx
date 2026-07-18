"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { base64PdfToObjectUrl, downloadBase64Pdf } from "@/lib/download-base64-pdf";
import type { PortalReportPdfFile } from "@/lib/portal-report-export";

export type { PortalReportPdfFile };

/** Hide Chrome PDF chrome + fit page width so the report is readable (not tiny + dual pane). */
const PDF_VIEWER_PARAMS = "#toolbar=0&navpanes=0&scrollbar=1&view=FitH";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  file: PortalReportPdfFile | null;
};

export function PortalReportPdfPreviewDialog({ open, onOpenChange, title, file }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file?.content) {
      setPreviewUrl(null);
      return;
    }

    const url = base64PdfToObjectUrl(file.content);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  const iframeSrc = useMemo(
    () => (previewUrl ? `${previewUrl}${PDF_VIEWER_PARAMS}` : null),
    [previewUrl],
  );

  const handleDownload = () => {
    if (!file) return;
    downloadBase64Pdf(file.filename, file.content);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(96vw,1100px)] max-w-[1100px] flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 space-y-0 pr-8">
          <DialogTitle className="text-left">{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-[#525659]">
          {iframeSrc ? (
            <iframe
              title={title}
              src={iframeSrc}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
              No preview available
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            className="bg-gold text-navy hover:bg-gold-dark"
            disabled={!file}
            onClick={handleDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
