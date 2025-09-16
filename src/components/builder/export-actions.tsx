"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Share2, Copy } from "lucide-react";

export interface ExportActionsProps {
  exportData: Record<string, unknown>;
}

export function ExportActions({ exportData }: ExportActionsProps) {
  const [message, setMessage] = useState<string>("");
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const json = JSON.stringify(exportData);
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
    return `${window.location.origin}/builder?share=${encoded}`;
  }, [exportData]);

  async function handleExport() {
    try {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `train-composition-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Composition exported as JSON.");
    } catch (error) {
      console.error(error);
      setMessage("Failed to export composition.");
    }
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Train composition",
          url: shareUrl,
        });
        setMessage("Shared using system share dialog.");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Share link copied to clipboard.");
    } catch (error) {
      console.error(error);
      setMessage("Unable to share at this time.");
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Export & Share</CardTitle>
        <CardDescription>Download the composition as JSON or share a link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" className="w-full" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export JSON
        </Button>
        <Button type="button" variant="secondary" className="w-full" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        {shareUrl && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setMessage("Share URL copied to clipboard.");
              } catch (error) {
                console.error(error);
                setMessage("Failed to copy share URL.");
              }
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy share URL
          </Button>
        )}
        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
