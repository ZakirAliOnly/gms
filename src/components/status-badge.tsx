export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "success" | "danger" | "warning" | "neutral";
}) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  );
}
