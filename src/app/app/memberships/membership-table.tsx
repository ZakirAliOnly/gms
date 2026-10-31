"use client";
import { EditAccess } from "@/components/module-access-provider";

import { useState } from "react";
import { Barcode, Pencil } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import type { MembershipRow, PackageOption } from "./data";
import { StatusPill } from "./status-pill";
import { RenewDialog } from "./renew-dialog";
import { EditMemberDialog } from "./edit-member-dialog";
import { MemberDetailsDialog } from "./member-details-dialog";
import { PhotoViewer } from "./photo-viewer";
import { BarcodeDialog, type BarcodeTarget } from "@/components/barcode-dialog";
import type { ExtraOption, MemberInitial } from "./member-form";

type PaymentMethod = { id: string; name: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCnic(digits: string | null): string | null {
  if (!digits) return null;
  return digits.length === 13
    ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
    : digits;
}

/** Turns a row into the shape the edit form seeds from. */
function toInitial(row: MembershipRow): MemberInitial {
  return {
    membershipId: row.id,
    name: row.memberName,
    phone: row.memberPhone,
    cnic: row.memberCnic,
    email: row.memberEmail,
    joinDate: row.joinDate.toISOString().slice(0, 10),
    packageId: row.packageId,
    photoUrl: row.memberPhotoUrl,
    extraIds: row.extraIds,
  };
}

export function MembershipTable({
  rows,
  paymentMethods,
  packages,
  extras,
}: {
  rows: MembershipRow[];
  paymentMethods: PaymentMethod[];
  /** Every active package plus, for editing, whatever a member is currently on. */
  packages: PackageOption[];
  extras: ExtraOption[];
}) {
  const [renewing, setRenewing] = useState<MembershipRow | null>(null);
  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [viewing, setViewing] = useState<MembershipRow | null>(null);
  const [showingBarcode, setShowingBarcode] = useState<BarcodeTarget | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; name: string } | null>(null);
  const canRenew = paymentMethods.length > 0;

  return (
    <>
      <div
        hidden={rows.length === 0}
        className="border-border bg-card overflow-x-auto rounded-lg border"
      >
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-border bg-primary-tint border-b">
              <th className="label-caps text-muted-foreground px-4 py-3">Member</th>
              <th className="label-caps text-muted-foreground px-4 py-3">Package</th>
              <th className="label-caps text-muted-foreground px-4 py-3">Joined</th>
              <th className="label-caps text-muted-foreground px-4 py-3">Next renewal</th>
              <th className="label-caps text-muted-foreground px-4 py-3">Status</th>
              <th className="label-caps text-muted-foreground px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-border border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.memberPhotoUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingPhoto({ url: row.memberPhotoUrl!, name: row.memberName })
                        }
                        className="hover:ring-primary shrink-0 rounded ring-offset-2 transition hover:ring-2"
                        title="View photo"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.memberPhotoUrl}
                          alt={row.memberName}
                          className="size-9 rounded object-cover"
                        />
                      </button>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="bg-secondary text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded text-[11px] font-bold"
                      >
                        {initials(row.memberName)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setViewing(row)}
                        className="text-foreground hover:text-primary block max-w-full truncate text-left text-sm font-medium transition-colors hover:underline"
                      >
                        {row.memberName}
                      </button>
                      <p className="data-mono text-muted-foreground truncate text-[12px]">
                        {row.memberBarcode}
                      </p>
                      {row.memberCnic && (
                        <p className="data-mono text-muted-foreground truncate text-[11px]">
                          {formatCnic(row.memberCnic)}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{row.packageName}</p>
                  <p className="data-mono text-muted-foreground text-[12px]">
                    {formatMoney(row.packagePrice)}
                  </p>
                  {row.extras.length > 0 && (
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      + {row.extras.map((x) => x.name).join(", ")} ({formatMoney(row.extrasTotal)})
                    </p>
                  )}
                </td>
                <td className="data-mono text-muted-foreground px-4 py-3">
                  {formatDate(row.joinDate)}
                </td>
                <td className="data-mono px-4 py-3">{formatDate(row.nextRenewalDate)}</td>
                <td className="px-4 py-3">
                  <StatusPill row={row} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setShowingBarcode({
                          title: row.memberName,
                          barcode: row.memberBarcode,
                          subtitle: row.packageName,
                        })
                      }
                      title="Show barcode"
                      className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
                    >
                      <Barcode className="size-4" aria-hidden="true" />
                      <span className="sr-only">Barcode for {row.memberName}</span>
                    </button>
                    <EditAccess module="memberships">
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        title="Edit member"
                        className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        <span className="sr-only">Edit {row.memberName}</span>
                      </button>
                    </EditAccess>
                    <EditAccess module="memberships">
                      <button
                        type="button"
                        onClick={() => setRenewing(row)}
                        disabled={!canRenew}
                        title={canRenew ? undefined : "Add a payment method first"}
                        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Renew
                      </button>
                    </EditAccess>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BarcodeDialog
        target={showingBarcode}
        open={showingBarcode !== null}
        onOpenChange={(next) => !next && setShowingBarcode(null)}
        heading="Membership barcode"
        description="Scan this code to look the member up at renewal time."
      />

      <PhotoViewer photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />

      {renewing && (
        <RenewDialog
          key={renewing.id}
          membershipId={renewing.id}
          memberName={renewing.memberName}
          packageFee={renewing.packagePrice}
          extras={renewing.extras}
          paymentMethods={paymentMethods}
          open={true}
          onOpenChange={(open) => !open && setRenewing(null)}
        />
      )}

      {editing && (
        <EditMemberDialog
          key={editing.id}
          packages={packages}
          extras={extras}
          initial={toInitial(editing)}
          open={true}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      {viewing && (
        <MemberDetailsDialog
          key={viewing.id}
          row={viewing}
          open={true}
          onOpenChange={(open) => !open && setViewing(null)}
        />
      )}
    </>
  );
}
