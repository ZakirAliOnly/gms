"use client";

import { useState, useTransition } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { whatsappWebUrl, type WhatsAppDraft } from "@/lib/whatsapp";
import { getPaymentReceipt, getLatestPaymentReceipt, getRenewalWhatsAppMessage } from "./actions";

type Props = {
  source: { type: "payment" | "latest-payment" | "reminder"; id: string };
  memberName: string;
  disabled?: boolean;
};
export function MembershipWhatsAppAction({ source, memberName, disabled }: Props) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const label = `WhatsApp ${source.type !== "reminder" ? "receipt" : "renewal reminder"} for ${memberName}`;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={disabled ? "Cancelled membership" : label}
        disabled={disabled || pending}
        className="whatsapp-action border-border hover:bg-success-tint inline-flex size-11 shrink-0 items-center justify-center rounded-lg border disabled:opacity-50"
        onClick={() => {
          // Open during the click so browsers permit the async receipt lookup.
          const tab = window.open("about:blank", "_blank");
          if (!tab) {
            setError("Allow pop-ups to open WhatsApp Web, then try again.");
            return;
          }
          tab.opener = null;
          start(async () => {
            setError("");
            try {
              let draft: WhatsAppDraft | undefined;
              if (source.type === "reminder") {
                const result = await getRenewalWhatsAppMessage(source.id);
                draft = result.draft;
                if (!draft) throw new Error(result.error ?? "Renewal reminder could not load.");
              } else {
                const result = await (source.type === "payment"
                  ? getPaymentReceipt(source.id)
                  : getLatestPaymentReceipt(source.id));
                draft = result.invoice?.whatsapp;
                if (!draft) throw new Error(result.error ?? "WhatsApp receipt could not load.");
              }
              const url = whatsappWebUrl(draft);
              if (!url) throw new Error("A valid WhatsApp number is required.");
              if (!tab.closed) tab.location.replace(url);
            } catch (error) {
              tab.close();
              setError(
                error instanceof Error ? error.message : "Message could not load. Please try again."
              );
            }
          });
        }}
      >
        <WhatsAppIcon className={`size-5 ${pending ? "animate-pulse" : ""}`} />
      </button>
      {error && (
        <span role="alert" className="text-destructive max-w-48 text-xs">
          {error}
        </span>
      )}
    </>
  );
}
