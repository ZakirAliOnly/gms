"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Maximize, Minimize, ScanLine } from "lucide-react";
import { useWorkspaceBase } from "@/components/workspace-link";

export function ScannerSession({
  query,
  scanKey,
  children,
}: {
  query: string;
  scanKey: string;
  children: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const router = useRouter();
  const base = useWorkspaceBase();
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const newScan = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const input = surface.current?.querySelector<HTMLInputElement>("#scanner-code");
    if (input) {
      input.value = "";
      input.focus();
    }
    router.replace(`${base}/memberships/scanner`, { scroll: false });
  }, [router, base]);

  useEffect(() => {
    if (!query) return;
    // Each completed lookup (including the same barcode) gets its own 15 seconds.
    timer.current = window.setTimeout(newScan, 15000);
    const pause = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
    window.addEventListener("scanner-lookup-start", pause);
    return () => {
      pause();
      window.removeEventListener("scanner-lookup-start", pause);
    };
  }, [query, scanKey, newScan]);

  useEffect(() => {
    const changed = () => {
      setFullscreen(document.fullscreenElement === surface.current);
      surface.current?.querySelector<HTMLInputElement>("#scanner-code")?.focus();
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function toggleFullscreen() {
    setError("");
    try {
      if (document.fullscreenElement === surface.current) await document.exitFullscreen();
      else if (surface.current?.requestFullscreen) await surface.current.requestFullscreen();
      else
        setError(
          "Full screen is not supported by this browser. Use your browser's full-screen mode."
        );
    } catch {
      setError("Full screen could not open. Try again or use your browser's full-screen mode.");
    }
  }

  return (
    <div ref={surface} className="scanner-kiosk">
      <div className="scanner-session-toolbar">
        <p className="text-muted-foreground text-sm" role="status">
          {query
            ? "Profile clears automatically after 15 seconds."
            : "Ready to scan a member barcode."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="dashboard-action"
            aria-pressed={fullscreen}
          >
            {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <button type="button" onClick={newScan} className="dashboard-action is-primary">
            <ScanLine aria-hidden="true" />
            New Scan
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive mb-3 text-sm">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
