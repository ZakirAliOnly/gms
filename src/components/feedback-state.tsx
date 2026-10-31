import { Inbox, TriangleAlert } from "lucide-react";
export function FeedbackState({
  title,
  description,
  error = false,
  action,
}: {
  title: string;
  description: string;
  error?: boolean;
  action?: React.ReactNode;
}) {
  const Icon = error ? TriangleAlert : Inbox;
  return (
    <div className="panel empty-state" role={error ? "alert" : undefined}>
      <Icon aria-hidden="true" />
      <p>{title}</p>
      <small>{description}</small>
      {action}
    </div>
  );
}
export function PageSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading page">
      <span className="sr-only">Loading your workspace…</span>
      <div className="skeleton-line w-64" />
      <div className="skeleton-line mt-3 w-96 max-w-full" />
      <div className="dashboard-kpis">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="panel skeleton-card" />
        ))}
      </div>
      <div className="panel skeleton-large mt-6" />
    </main>
  );
}
