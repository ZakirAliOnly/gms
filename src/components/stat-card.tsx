import Link from "@/components/workspace-link";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  emphasis = false,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  emphasis?: boolean;
  tone?: "primary" | "success" | "danger" | "info";
}) {
  const body = (
    <>
      <span className="stat-icon">
        <Icon aria-hidden="true" />
      </span>
      <div className="stat-copy">
        <p className="stat-label">{label}</p>
        <p className="stat-value" data-emphasis={emphasis}>
          {value}
        </p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
      <Icon className="stat-watermark" aria-hidden="true" />
    </>
  );
  return href ? (
    <Link href={href} className="stat-card" data-tone={tone}>
      {body}
    </Link>
  ) : (
    <div className="stat-card" data-tone={tone}>
      {body}
    </div>
  );
}
