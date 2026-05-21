"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAdminTrueNorth, updateAdminTrueNorth } from "@/lib/api";
import { BrandMark } from "@/components/brand/brand-mark";
import Link from "next/link";

export default function AdminPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) { router.replace("/login"); return; }
        if (user.role !== "admin") { router.replace("/dashboard"); return; }

        const data = await getAdminTrueNorth();
        if (mounted) setContent(data.content);
      } catch {
        if (mounted) setError("Failed to load TrueNorth.md.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [router]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateAdminTrueNorth(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [content]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment">
        <div className="rounded-full border border-ink/10 bg-white px-5 py-2 text-sm text-ink/70">
          Loading admin panel...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-parchment px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-ink px-4 py-4 text-parchment shadow-panel sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3">
          <BrandMark subtitle="Admin" />
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gold hover:text-parchment"
            >
              ← Dashboard
            </Link>
          </div>
        </header>


        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-6 py-4">
          <p className="text-sm font-semibold text-amber-800">Admin — TrueNorth Ethics & Values Layer</p>
          <p className="mt-1 text-sm text-amber-700">
            This file defines the ethical orientation and values that every agent on the platform inherits.
            Changes take effect immediately across the entire system.
          </p>
        </div>

     
        <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold text-ink">TrueNorth.md</p>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-teal-700 font-medium">Saved successfully</span>
              )}
              {error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                type="button"
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={40}
            spellCheck={false}
            className="w-full rounded-2xl border border-ink/10 bg-parchment/40 p-5 font-mono text-sm text-ink leading-7 focus:outline-none focus:ring-2 focus:ring-gold/40 resize-y"
          />
        </div>
      </div>
    </main>
  );
}
