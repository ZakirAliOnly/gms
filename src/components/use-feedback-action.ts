"use client";
import { useActionState } from "react";
import { toast } from "sonner";

/** Complete modal/reset work in the submit handler, once per successful action. */
export function useFeedbackAction<S extends { ok?: boolean; error?: string }, P>(
  action: (state: Awaited<S>, payload: P) => Promise<S>,
  initial: Awaited<S>,
  onSuccess: () => void
) {
  return useActionState<S, P>(async (previous, payload) => {
    const result = await action(previous, payload);
    if (result.ok) {
      onSuccess();
      toast.success("Saved successfully");
    } else if (result.error) toast.error(result.error);
    return result;
  }, initial);
}
