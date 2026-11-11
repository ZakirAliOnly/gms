import Image from "next/image";
import {
  CalendarDays,
  CheckCircle2,
  IdCard,
  Layers,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import type { ScannerRecord } from "@/lib/member-scanner";

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
    </div>
  );
}
