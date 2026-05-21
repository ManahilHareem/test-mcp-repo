"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getCurrentOnboardingQuestion, getCurrentUser } from "@/lib/auth";
import type { OnboardingQuestionResponse, SessionUser } from "@/lib/api";

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<OnboardingQuestionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        const requestedQuestionKey = searchParams.get("question") || undefined;
        const reviewIncomplete = searchParams.get("review") === "1";
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.replace("/login");
          return;
        }

        if (currentUser.onboarding_complete && !requestedQuestionKey && !reviewIncomplete) {
          router.replace("/dashboard");
          return;
        }

        const questionState = await getCurrentOnboardingQuestion(requestedQuestionKey, reviewIncomplete);

        if (mounted) {
          setUser(currentUser);
          setState(questionState);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16">
        <div className="rounded-full border border-ink/10 bg-white px-5 py-2 text-sm text-ink/70">
          Loading onboarding...
        </div>
      </main>
    );
  }

  if (!user || !state) {
    return null;
  }

  return (
    <OnboardingShell
      initialState={state}
      onComplete={() => router.replace("/settings?welcome=1")}
      reviewMode={searchParams.get("review") === "1"}
      user={user}
    />
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16">
          <div className="rounded-full border border-ink/10 bg-white px-5 py-2 text-sm text-ink/70">
            Loading onboarding...
          </div>
        </main>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
