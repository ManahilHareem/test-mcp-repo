"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ProfileShell } from "@/components/profile/profile-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import type { SessionUser, UserProfile } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.replace("/login");
          return;
        }

        const currentProfile = await getCurrentProfile();
        if (mounted) {
          setUser(currentUser);
          setProfile(currentProfile);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16">
        <div className="rounded-full border border-ink/10 bg-white px-5 py-2 text-sm text-ink/70">
          Loading your profile...
        </div>
      </main>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return <ProfileShell profile={profile} user={user} />;
}
