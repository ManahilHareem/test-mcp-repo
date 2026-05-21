"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { BrandMark } from "@/components/brand/brand-mark";
import { getCurrentUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const user = await getCurrentUser();
        if (mounted && user) {
          router.replace(user.onboarding_complete ? "/dashboard" : "/onboarding");
          return;
        }
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-hero-glow px-6 py-16">
        <div className="rounded-full border border-line/30 bg-white/70 px-5 py-2 text-sm text-ink/70">
          Restoring your session...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-hero-glow px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:gap-10">
        <header className="flex items-center justify-between rounded-[1.75rem] border border-white/10 bg-ink px-4 py-3 text-parchment shadow-panel sm:rounded-full sm:px-5">
          <BrandMark subtitle="Private Access" />
          {/* <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-sm font-semibold text-gold">
            AL
          </div> */}
        </header>

        <section className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.38em] text-gold">Private access</p>
            <h1 className="max-w-xl font-serif text-3xl leading-tight text-ink sm:text-4xl lg:text-5xl">
              Welcome to TrueNorth. Your journey begins here.
            </h1>
            <p className="max-w-xl text-base leading-7 text-ink/72 sm:text-lg sm:leading-8">
              Sign in to continue your journey with persistent sessions and a smooth handoff into your personal space.
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                ["HttpOnly", "Session cookie"],
                ["Argon2", "Password hashing at rest"],
                ["5 / 15", "Login rate limit window"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-ink/8 bg-white/70 p-3 shadow-sm sm:rounded-3xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gold sm:text-sm sm:tracking-[0.26em]">{title}</p>
                  <p className="mt-1 text-xs leading-4 text-ink/75 sm:mt-2 sm:text-sm sm:leading-6">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <AuthCard />
        </section>
      </div>
    </main>
  );
}
