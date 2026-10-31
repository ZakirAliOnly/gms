import { ActionToolbar } from "./action-toolbar";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="label-caps text-muted-foreground">{eyebrow}</p>}
        <h1 className="mt-1">{title}</h1>
        {description && <p className="page-header-description">{description}</p>}
      </div>
      {action && <ActionToolbar>{action}</ActionToolbar>}
    </header>
  );
}
