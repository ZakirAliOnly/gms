import { PageHeader } from "./page-header";
import { DisplayPreferences } from "./display-preferences";
import { Settings, UserRound, Palette } from "lucide-react";

export function SettingsView({
  name,
  email,
  role,
  workspace,
  location,
}: {
  name: string;
  email: string;
  role: string;
  workspace: string;
  location?: string;
}) {
  return (
    <main>
      <PageHeader
        title="Settings"
        description="Your workspace, account information, and display preferences."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>
            <Settings aria-hidden="true" />
            Workspace
          </h2>
          <dl>
            <Setting label="Gym" value="Golden GYM" />
            <Setting label="Workspace" value={workspace} />
            {location && <Setting label="Location" value={location} />}
            <Setting label="Time zone" value="Asia/Karachi" />
            <Setting label="Currency" value="PKR — Pakistani Rupee" />
          </dl>
          <p className="text-muted-foreground mt-4 text-xs">
            Contact your administrator to change workspace details.
          </p>
        </section>
        <section className="panel settings-panel">
          <h2>
            <UserRound aria-hidden="true" />
            Your account
          </h2>
          <dl>
            <Setting label="Name" value={name} />
            <Setting label="Email" value={email} />
            <Setting label="Access" value={role} />
          </dl>
          <p className="text-muted-foreground mt-4 text-xs">
            Account access and credentials are managed by your administrator.
          </p>
        </section>
        <section className="panel settings-panel">
          <h2>
            <Palette aria-hidden="true" />
            Appearance
          </h2>
          <div className="theme-preview">
            <span aria-hidden="true" />
            Golden GYM · Warm brown theme
          </div>
          <DisplayPreferences />
        </section>
      </div>
    </main>
  );
}
function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
