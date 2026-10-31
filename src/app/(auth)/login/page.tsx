import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only same-origin paths survive; an absolute URL here would be an open
  // redirect after sign-in.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <main className={`login-screen flex min-h-svh items-center justify-center px-4 py-8 md:px-8`}>
      <div className="border-border bg-card flex w-full max-w-[420px] flex-col gap-8 rounded-lg border p-6 sm:p-8">
        <header className="flex flex-col items-center text-center">
          <Dumbbell className="text-primary mb-2 size-14" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-semibold">Golden GYM</h1>
          <p className="text-muted-foreground text-[13px] leading-[18px]">
            Secure administrative access
          </p>
        </header>

        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
