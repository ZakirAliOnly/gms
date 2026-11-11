import { UserCheck } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { ScannerProfileCard } from "./scanner-profile-card";
import { scannerRenewalStatus, type ScannerRecord } from "@/lib/member-scanner";

export function MemberScannerReport({ record }: { record: ScannerRecord }) {
  const { profile } = record;
  const renewal = scannerRenewalStatus(profile);
  const tone = renewal.pending
    ? "danger"
    : renewal.label === "Cancelled" || !profile.membership
      ? "neutral"
      : renewal.label === "Upcoming renewal"
        ? "warning"
        : "success";
  return (
    <section className="scanner-result" aria-label="Member scan result">
      <div className="scanner-summary">
        <StatCard
          label="Renewal status"
          value={renewal.label}
          hint={renewal.detail}
          icon={UserCheck}
          tone={tone === "danger" ? "danger" : tone === "success" ? "success" : "primary"}
        />
      </div>
      <ScannerProfileCard profile={profile} status={renewal.label} tone={tone} />
    </section>
  );
}
