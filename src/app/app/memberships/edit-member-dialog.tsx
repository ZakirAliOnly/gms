"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useActionState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateMembership, type ActionState } from "./actions";
import type { PackageOption } from "./data";
import { MemberForm, type ExtraOption, type MemberInitial } from "./member-form";

function EditMemberDialogContent({
  packages,
  extras,
  initial,
  open,
  onOpenChange,
}: {
  packages: PackageOption[];
  extras: ExtraOption[];
  initial: MemberInitial;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateMembership, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>{initial.name}</DialogDescription>
        </DialogHeader>

        <MemberForm
          state={state}
          action={action}
          formRef={formRef}
          packages={packages}
          extras={extras}
          initial={initial}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditMemberDialog(props: React.ComponentProps<typeof EditMemberDialogContent>) {
  return (
    <EditAccess module="memberships">
      <EditMemberDialogContent {...props} />
    </EditAccess>
  );
}
