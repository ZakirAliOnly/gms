"use client";
import { FeedbackState } from "./feedback-state";
export function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <FeedbackState
        error
        title="This page couldn't load"
        description="Try loading the page again. If the problem continues, contact your administrator."
        action={
          <button type="button" onClick={reset} className="dashboard-action is-primary mt-4">
            Try again
          </button>
        }
      />
    </main>
  );
}
