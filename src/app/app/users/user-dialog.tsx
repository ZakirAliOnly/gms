"use client";
import { useState } from "react";
import { UserPlus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { useFeedbackAction } from "@/components/use-feedback-action";
import { MODULES } from "@/lib/module-access";
import { saveUser, type UserState } from "./actions";
import { useFormStatus } from "react-dom";
export type BranchUserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  moduleAccess: string[];
  editableModules: string[];
  isBranchManager: boolean;
};
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="dashboard-action is-primary" disabled={pending}>
      {pending ? "Saving…" : "Save user"}
    </button>
  );
}
export function UserDialog({ user }: { user?: BranchUserRow }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string[]>(user?.moduleAccess ?? []);
  const [edit, setEdit] = useState<string[]>(user?.editableModules ?? []);
  const [state, action] = useFeedbackAction<UserState, FormData>(saveUser, {}, () =>
    setOpen(false)
  );
  const input = "border-input bg-background w-full rounded-lg border px-3 py-2";
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setView(user?.moduleAccess ?? []);
          setEdit(user?.editableModules ?? []);
        }
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={`dashboard-action ${user ? "" : "is-primary"}`}>
          {user ? (
            <Pencil className="size-4" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
          {user ? `Edit ${user.name}` : "New user"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{user ? "Edit branch user" : "New branch user"}</DialogTitle>
          <DialogDescription>
            Access applies only to this branch. Edit includes creating, changing and deleting
            records in that module.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4" autoComplete="off">
          {user && <input name="id" type="hidden" value={user.id} />}
          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          <FormField id="staff-name" label="Name">
            <input
              id="staff-name"
              name="name"
              required
              maxLength={100}
              defaultValue={user?.name}
              className={input}
            />
          </FormField>
          <FormField id="staff-email" label="Login email">
            <input
              id="staff-email"
              name="email"
              type="email"
              required
              defaultValue={user?.email}
              className={input}
            />
          </FormField>
          <FormField
            id="staff-password"
            label={user ? "New password (leave blank to keep)" : "Password"}
            hint="At least 12 characters; maximum 72 UTF-8 bytes."
          >
            <input
              id="staff-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required={!user}
              minLength={12}
              className={input}
            />
          </FormField>
          <FormField id="staff-status" label="Status">
            <select
              id="staff-status"
              name="status"
              defaultValue={user?.status ?? "ACTIVE"}
              className={input}
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </FormField>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Module permissions</legend>
            <p className="text-muted-foreground mb-3 text-xs">
              Dashboard, reports and data viewer can expose financial summaries or records from
              other modules. Grant them deliberately. User management is reserved for branch
              managers.
            </p>
            <div className="permission-grid">
              <div>Module</div>
              <div>View</div>
              <div>Edit</div>
              {MODULES.map((module) => (
                <PermissionRow
                  key={module.key}
                  label={module.label}
                  module={module.key}
                  view={view.includes(module.key)}
                  edit={edit.includes(module.key)}
                  onView={(checked) => {
                    setView((values) =>
                      checked
                        ? [...values, module.key]
                        : values.filter((value) => value !== module.key)
                    );
                    if (!checked)
                      setEdit((values) => values.filter((value) => value !== module.key));
                  }}
                  onEdit={(checked) => {
                    setEdit((values) =>
                      checked
                        ? [...values, module.key]
                        : values.filter((value) => value !== module.key)
                    );
                    if (checked)
                      setView((values) =>
                        values.includes(module.key) ? values : [...values, module.key]
                      );
                  }}
                />
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <button type="button" className="dashboard-action" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function PermissionRow({
  label,
  module,
  view,
  edit,
  onView,
  onEdit,
}: {
  label: string;
  module: string;
  view: boolean;
  edit: boolean;
  onView: (value: boolean) => void;
  onEdit: (value: boolean) => void;
}) {
  return (
    <>
      <span className="permission-label">{label}</span>
      <label className="permission-check">
        <span className="sr-only">View {label}</span>
        <input
          type="checkbox"
          name="moduleAccess"
          value={module}
          checked={view}
          onChange={(event) => onView(event.target.checked)}
        />
      </label>
      <label className="permission-check">
        <span className="sr-only">Edit {label}</span>
        <input
          type="checkbox"
          name="editableModules"
          value={module}
          checked={edit}
          onChange={(event) => onEdit(event.target.checked)}
        />
      </label>
    </>
  );
}
