"use client";

import { BrandMark } from "@/components/brand/brand-mark";
import { deleteCurrentAccount, exportProfileMarkdown, uploadProfileMarkdown } from "@/lib/auth";
import { deleteUploadedFile, postOnboardingAnswer } from "@/lib/api";
import Link from "next/link";
import { useState, useRef, ChangeEvent } from "react";

import type { SessionUser, UserProfile } from "@/lib/api";

type ProfileShellProps = {
  profile: UserProfile;
  user: SessionUser;
};

const MAX_UPLOAD_BYTES = 1024 * 1024;

export function ProfileShell({ profile: initialProfile, user }: ProfileShellProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);
  const [answerToClear, setAnswerToClear] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      const content = await exportProfileMarkdown();
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "true-north-export.md";
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Markdown export downloaded.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "We couldn't export your markdown.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteCurrentAccount();
      window.location.href = "/login";
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "We couldn't delete your account.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  async function handleClearAnswer(questionKey: string) {
    setActionLoading(true);
    try {
      await postOnboardingAnswer({ question_key: questionKey, skipped: true });
      window.location.reload();
    } catch (err) {
      setError("Failed to clear answer.");
      setActionLoading(false);
      setAnswerToClear(null);
    }
  }

  async function handleDeleteFile(fileId: number) {
    setActionLoading(true);
    try {
      await deleteUploadedFile(fileId);
      window.location.reload();
    } catch (err) {
      setFileError("Failed to delete file.");
      setActionLoading(false);
      setFileToDelete(null);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".md")) {
      setFileError("Only markdown files ending in .md can be uploaded.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError("Markdown files must be 1 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    setFileError(null);
    setNotice(null);
    try {
      const response = await uploadProfileMarkdown(file);
      setProfile(response.profile);
      setNotice(`${file.name} uploaded successfully.`);
    } catch (uploadError) {
      setFileError(uploadError instanceof Error ? uploadError.message : "We couldn't upload that markdown file.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-parchment px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-ink px-4 py-4 text-parchment shadow-panel sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3">
          <BrandMark subtitle="Profile" />
          <nav className="ml-auto flex flex-wrap items-center justify-end gap-4 self-end text-right text-sm">
            <Link className="text-gold hover:text-parchment" href="/query">
              Query
            </Link>
            <Link className="text-gold hover:text-parchment" href={user.onboarding_complete ? "/dashboard" : "/onboarding"}>
              {user.onboarding_complete ? "Dashboard" : "Continue onboarding"}
            </Link>
          </nav>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm uppercase tracking-[0.28em] text-gold">What TrueNorth knows about you</p>
            <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{profile.display_name || user.email}</h1>
            <p className="mt-4 text-base leading-7 text-ink/72 sm:text-lg sm:leading-8">{profile.summary_text}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Completion", `${profile.completion_percentage}%`],
                ["Captured", `${profile.completed_count} of ${profile.total_count}`],
                ["Files", `${profile.uploaded_files.length}`],
              ].map(([label, value]) => (
                <div className="rounded-3xl border border-ink/10 bg-parchment p-4" key={label}>
                  <p className="text-sm uppercase tracking-[0.28em] text-gold">{label}</p>
                  <p className="mt-3 text-sm leading-6 text-ink/80">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-4">
              {profile.sections.map((section) => (
                <div className="rounded-3xl border border-ink/10 bg-parchment p-5" key={section.key}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-base font-semibold text-ink">{section.label}</p>
                    <div className="flex items-center gap-3">
                      {section.status === "answered" && (
                        <button
                          onClick={() => setAnswerToClear(section.key)}
                          disabled={actionLoading}
                          className="text-xs uppercase tracking-[0.22em] text-red-600/70 hover:text-red-600 underline decoration-red-600/60 underline-offset-4 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      )}
                      <Link
                        className="text-xs uppercase tracking-[0.22em] text-ink/70 hover:text-ink underline decoration-gold/60 underline-offset-4"
                        href={`/onboarding?question=${section.key}&review=1`}
                      >
                        Edit
                      </Link>
                      <span className="text-xs uppercase tracking-[0.22em] text-gold">{section.status}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink/72">
                    {section.value || (section.status === "skipped" ? "Skipped for now." : "No answer saved yet.")}
                  </p>
                </div>
              ))}
            </div>

          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm uppercase tracking-[0.28em] text-gold">Files in your vault</p>
                <button
                  className="rounded-full border border-ink/12 bg-parchment px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:border-gold disabled:opacity-50"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {uploading ? "Uploading..." : "Upload file"}
                </button>
                <input
                  accept=".md,text/markdown,text/plain"
                  className="hidden"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
              {fileError && (
                <p className="mt-3 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-top-1">
                  {fileError}
                </p>
              )}
              <div className="mt-4 space-y-3">
                {profile.uploaded_files.length ? (
                  profile.uploaded_files.map((file) => (
                    <div className="rounded-2xl bg-parchment px-4 py-3 relative group" key={file.id}>
                      <button
                        onClick={() => setFileToDelete(file.id)}
                        disabled={actionLoading}
                        className="absolute right-3 top-3 p-1.5 text-red-600/50 hover:text-red-700 bg-red-100/50 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                        title="Delete File"
                      >
                         <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                      <p className="text-sm font-semibold text-ink pr-6">{file.filename}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/70">
                        {file.summary_text || "Uploaded markdown file ready for profile indexing."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-ink/70">No markdown files uploaded yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-gold">Status</p>
              <p className="mt-3 text-sm leading-7 text-ink/72">
                {profile.onboarding_complete
                  ? "Onboarding is complete and your profile is ready to support the next layer of the experience."
                  : "Onboarding is still in progress. You can resume at the next unanswered question."}
              </p>
              {profile.latest_memory_answer ? (
                <div className="mt-4 rounded-2xl bg-parchment px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-gold">Latest reflection</p>
                  <p className="mt-2 text-sm leading-7 text-ink/72">{profile.latest_memory_answer}</p>
                </div>
              ) : null}
            </div>
            <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-gold">Actions</p>
              <div className="mt-4 space-y-3">
                <button
                  className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-parchment transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={exporting}
                  onClick={() => void handleExport()}
                  type="button"
                >
                  {exporting ? "Exporting..." : "Export markdown"}
                </button>
                <button
                  className="w-full rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={deleting}
                  onClick={() => setShowDeleteModal(true)}
                  type="button"
                >
                  {deleting ? "Deleting..." : "Delete account"}
                </button>
              </div>
              {notice ? <p className="mt-4 text-sm leading-6 text-teal-700">{notice}</p> : null}
              {error ? <p className="mt-4 text-sm leading-6 text-red-700">{error}</p> : null}
            </div>
          </aside>
        </section>
      </div>

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-6">
          <div className="w-full max-w-md rounded-[2rem] border border-ink/10 bg-white p-6 shadow-panel">
            <p className="text-sm uppercase tracking-[0.28em] text-red-600">Delete account</p>
            <h2 className="mt-3 font-serif text-3xl text-ink">This action cannot be undone.</h2>
            <p className="mt-4 text-sm leading-7 text-ink/72">
              This will permanently delete your profile, uploaded files, and memory data from TrueNorth.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-2xl border border-ink/12 px-4 py-3 text-sm font-semibold text-ink"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deleting}
                onClick={() => void handleDelete()}
                type="button"
              >
                {deleting ? "Deleting..." : "Yes, delete everything"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fileToDelete !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-6">
          <div className="w-full max-w-md rounded-[2rem] border border-ink/10 bg-white p-6 shadow-panel">
            <p className="text-sm uppercase tracking-[0.28em] text-red-600">Delete File</p>
            <h2 className="mt-3 font-serif text-3xl text-ink">Remove this file?</h2>
            <p className="mt-4 text-sm leading-7 text-ink/72">
              This will permanently delete the file and remove its insights from your TrueNorth profile context.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-2xl border border-ink/12 px-4 py-3 text-sm font-semibold text-ink"
                disabled={actionLoading}
                onClick={() => setFileToDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={actionLoading}
                onClick={() => void handleDeleteFile(fileToDelete)}
                type="button"
              >
                {actionLoading ? "Deleting..." : "Yes, delete file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {answerToClear !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-6">
          <div className="w-full max-w-md rounded-[2rem] border border-ink/10 bg-white p-6 shadow-panel">
            <p className="text-sm uppercase tracking-[0.28em] text-red-600">Clear Answer</p>
            <h2 className="mt-3 font-serif text-3xl text-ink">Erase this memory?</h2>
            <p className="mt-4 text-sm leading-7 text-ink/72">
              This will clear your textual answer and completely remove its influence on your TrueNorth profile.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-2xl border border-ink/12 px-4 py-3 text-sm font-semibold text-ink"
                disabled={actionLoading}
                onClick={() => setAnswerToClear(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={actionLoading}
                onClick={() => void handleClearAnswer(answerToClear)}
                type="button"
              >
                {actionLoading ? "Clearing..." : "Yes, clear answer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
