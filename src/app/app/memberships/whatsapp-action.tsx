"use client";

import { useState, useTransition } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { WhatsAppMessageDialog } from "@/components/whatsapp-message-dialog";
import type { WhatsAppDraft } from "@/lib/whatsapp";
import { getPaymentReceipt, getLatestPaymentReceipt, getRenewalWhatsAppMessage } from "./actions";

type Props = {
  source: { type: "payment" | "latest-payment" | "reminder"; id: string };
  memberName: string;
  disabled?: boolean;
};
export function MembershipWhatsAppAction({ source, memberName, disabled }: Props) {
  const [draft, setDraft] = useState<WhatsAppDraft | null>(null);
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
        onClick={() =>
          start(async () => {
            setError("");
            try {
              if (source.type !== "reminder") {
                const result = await (source.type === "payment"
                  ? getPaymentReceipt(source.id)
                  : getLatestPaymentReceipt(source.id));
                if (result.invoice?.whatsapp) setDraft(result.invoice.whatsapp);
                else setError(result.error ?? "WhatsApp receipt could not load.");
              } else {
                const result = await getRenewalWhatsAppMessage(source.id);
                if (result.draft) setDraft(result.draft);
                else setError(result.error ?? "Renewal reminder could not load.");
              }
            } catch {
              setError("Message could not load. Please try again.");
            }
          })
        }
      >
        <WhatsAppIcon className={`size-5 ${pending ? "animate-pulse" : ""}`} />
      </button>
      {error && (
        <span role="alert" className="text-destructive max-w-48 text-xs">
          {error}
        </span>
      )}
      {draft && <WhatsAppMessageDialog draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
