"use client";

import { useId } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { WhatsAppIcon } from "./whatsapp-icon";
import { whatsappWebUrl, type WhatsAppDraft } from "@/lib/whatsapp";

export function WhatsAppMessageDialog({
  draft,
  onClose,
}: {
  draft: WhatsAppDraft;
  onClose: () => void;
}) {
  const messageId = useId();
  const url = whatsappWebUrl(draft);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>WhatsApp message</DialogTitle>
          <DialogDescription>
            Review the message, then open WhatsApp Web and click Send there.
          </DialogDescription>
        </DialogHeader>
        <p className="min-w-0 text-sm break-words">
          <strong>To:</strong> {draft.recipient}
          {draft.phone ? ` (+${draft.phone})` : ""}
        </p>
        {!url && (
          <p role="alert" className="text-destructive text-sm">
            The member needs a valid WhatsApp number. Update this number in their profile (for Pakistan, use
            03XXXXXXXXX) before opening WhatsApp.
          </p>
        )}
        <div className="grid min-w-0 gap-2 text-sm font-medium">
          <label htmlFor={messageId}>Message preview</label>
          <textarea
            id={messageId}
            readOnly
            value={draft.message}
            rows={13}
            className="border-input bg-background w-full min-w-0 resize-y rounded-lg border p-3 font-mono text-sm leading-6"
          />
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="dashboard-action">
            Close
          </button>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="dashboard-action whatsapp-action"
            >
              <WhatsAppIcon className="size-5" />
              Open WhatsApp Web
            </a>
          ) : (
            <button type="button" disabled className="dashboard-action disabled:opacity-50">
              Open WhatsApp Web
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
