"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { FormField } from "./form-field";

function subscribe(callback: () => void) {
  window.addEventListener("gym-preferences", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("gym-preferences", callback);
    window.removeEventListener("storage", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem("gym-motion") ?? "system";
  } catch {
    return "system";
  }
}
function useMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => "system");
}
export function AppearancePreferences() {
  const motion = useMotion();
  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);
  return null;
}
export function DisplayPreferences() {
  const motion = useMotion();
  return (
    <FormField
      id="motion-preference"
      label="Motion preference"
      hint="Saved on this browser. Touch targets and navigation stay the same."
    >
      <select
        id="motion-preference"
        value={motion}
        aria-describedby="motion-preference-hint"
        className="border-input rounded-lg border px-3 py-2"
        onChange={(event) => {
          try {
            localStorage.setItem("gym-motion", event.target.value);
            window.dispatchEvent(new Event("gym-preferences"));
            toast.success("Display preference saved");
          } catch {
            toast.error("This browser could not save your preference.");
          }
        }}
      >
        <option value="system">Follow device preference</option>
        <option value="reduce">Reduce animations</option>
      </select>
    </FormField>
  );
}
