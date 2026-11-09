import Image from "next/image";
import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  IdCard,
  Layers,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import type { ScannerRecord } from "@/lib/member-scanner";
import { ScannerPrintButton } from "./scanner-controls";

export function ScannerProfileCard({
  profile,
  status,
  tone,
}: {
  profile: ScannerRecord["profile"];
  status: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const membership = profile.membership;
  const fields = [
    { label: "Member ID", value: profile.barcode, icon: IdCard },
    { label: "Joined", value: formatDate(new Date(profile.joinedAt)), icon: CalendarDays },
    { label: "WhatsApp number", value: profile.phone || "—", icon: Phone },
    { label: "CNIC", value: profile.cnic || "—", icon: IdCard },
    { label: "Email", value: profile.email || "—", icon: Mail },
    { label: "Package", value: membership?.packageName ?? "No membership", icon: Layers },
  ];
  return (
    <div className="scanner-member-grid">
      <section className="panel scanner-member-card" aria-label="Member profile">
        <div className="scanner-portrait">
          {profile.photoUrl ? (
            <Image
              src={profile.photoUrl}
              unoptimized
              alt={profile.name}
              width={300}
              height={340}
              className="scanner-photo"
            />
          ) : (
            <div className="scanner-photo-placeholder">
              <UserRound aria-hidden="true" />
              <span>No member photo</span>
            </div>
          )}
        </div>
        <div className="scanner-member-details">
          <header className="scanner-member-heading">
            <div className="min-w-0">
              <h2>{profile.name}</h2>
              <p>
                <MapPin aria-hidden="true" />
                {profile.branchName}
              </p>
            </div>
            <StatusBadge tone={tone}>
              {tone === "success" && <CheckCircle2 className="size-4" aria-hidden="true" />}
              {status}
            </StatusBadge>
          </header>
          <dl className="scanner-profile">
            {fields.map(({ label, value, icon: Icon }) => (
              <div key={label} className="scanner-profile-field">
                <Icon aria-hidden="true" />
                <div className="min-w-0">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <aside className="panel scanner-package-card">
        <section aria-labelledby="scanner-package-title" className="scanner-package-content">
          <h2 id="scanner-package-title">
            <Dumbbell aria-hidden="true" />
            Membership package
          </h2>
          <p className="scanner-package-name">{membership?.packageName ?? "No membership"}</p>
          {membership ? (
            <>
              <p className="text-muted-foreground text-sm">
                Membership since {formatDate(new Date(membership.startDate))}
              </p>
              {membership.extras.length > 0 && (
                <ul className="scanner-extra-list">
                  {membership.extras.map((extra, index) => (
                    <li key={`${extra.name}-${index}`}>
                      <span>{extra.name}</span>
                      <strong>{formatMoneyPrecise(extra.fee)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No membership is recorded.</p>
          )}
          <Dumbbell className="scanner-package-watermark" aria-hidden="true" />
        </section>
        <section className="scanner-quick-actions" aria-labelledby="scanner-actions-title">
          <h2 id="scanner-actions-title">
            <Zap aria-hidden="true" />
            Quick actions
          </h2>
          <ScannerPrintButton memberId={profile.id} compact />
          <p className="text-muted-foreground mt-3 text-xs">
            Read-only profile. Prints the complete payment history.
          </p>
        </section>
      </aside>
    </div>
  );
}
