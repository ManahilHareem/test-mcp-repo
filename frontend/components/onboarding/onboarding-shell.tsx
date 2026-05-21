"use client";

import { ChangeEvent, KeyboardEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { getCurrentOnboardingQuestion, logoutUser, saveOnboardingAnswer, uploadProfileMarkdown } from "@/lib/auth";
import type { OnboardingQuestionResponse, SessionUser } from "@/lib/api";

type OnboardingShellProps = {
  initialState: OnboardingQuestionResponse;
  onComplete: () => void;
  reviewMode?: boolean;
  user: SessionUser;
};

const MAX_UPLOAD_BYTES = 1024 * 1024;

export function OnboardingShell({ initialState, onComplete, reviewMode = false, user }: OnboardingShellProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [answer, setAnswer] = useState(initialState.current_answer?.skipped ? "" : initialState.current_answer?.answer_text || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const progressWidth = useMemo(() => `${state.progress.completion_percentage}%`, [state.progress.completion_percentage]);
  const showFirstPassUploadStep = !reviewMode && !state.question && state.progress.is_complete;

  async function handleLogout() {
    await logoutUser();
    router.replace("/login");
    router.refresh();
  }

  async function submitAnswer(skipped: boolean) {
    if (!state.question) {
      return;
    }

    if (!skipped && !answer.trim()) {
      setError("Please enter a response or choose Skip for now.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const nextState = await saveOnboardingAnswer({
        question_key: state.question.key,
        answer_text: answer,
        skipped,
        review_incomplete: reviewMode,
      });

      const nextQuestionState: OnboardingQuestionResponse = {
        question: nextState.next_question,
        current_answer: nextState.next_answer,
        current_index: nextState.current_index,
        total_count: nextState.total_count,
        progress: nextState.progress,
        profile_preview: nextState.profile_preview,
      };

      setState(nextQuestionState);
      setAnswer(nextState.next_answer?.skipped ? "" : nextState.next_answer?.answer_text || "");
      if (nextState.next_question) {
        router.replace(
          reviewMode
            ? `/onboarding?question=${nextState.next_question.key}&review=1`
            : "/onboarding",
        );
      } else {
        router.replace("/onboarding");
      }

      if (reviewMode && nextState.progress.is_complete && !nextState.next_question) {
        onComplete();
      }
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : "We couldn't save that answer right now.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".md")) {
      setError("Only markdown files ending in .md can be uploaded.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Markdown files must be 1 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await uploadProfileMarkdown(file);
      setState((current) => ({
        ...current,
        profile_preview: {
          ...current.profile_preview,
          summary_text: response.profile.summary_text,
          completion_percentage: response.profile.completion_percentage,
          sections: response.profile.sections,
          uploaded_files_count: response.profile.uploaded_files.length,
        },
      }));
      setNotice(`${file.name} uploaded successfully.`);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "We couldn't upload that markdown file.";
      setError(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleEditQuestion(questionKey: string) {
    setError(null);
    try {
      const questionState = await getCurrentOnboardingQuestion(questionKey, true);
      setState(questionState);
      setAnswer(questionState.current_answer?.skipped ? "" : questionState.current_answer?.answer_text || "");
      router.replace(`/onboarding?question=${questionKey}&review=1`);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "We couldn't load that question.";
      setError(message);
    }
  }

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || !state.question) {
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    if (state.question.input_type === "multiline" && event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (!saving) {
      void submitAnswer(false);
    }
  }

  return (
    <main className="min-h-screen bg-parchment px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <header
          className={`border border-white/10 bg-ink text-parchment shadow-panel ${
            reviewMode
              ? "flex flex-col gap-3 rounded-[1.75rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3"
              : "mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[1.75rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3"
          }`}
        >
          <BrandMark />
          {reviewMode ? (
            <div className="ml-auto text-left sm:text-right">
              <p className="text-sm text-gold">{user.email}</p>
              <div className="mt-1 flex flex-wrap justify-end gap-3 text-xs uppercase tracking-[0.22em]">
                <Link className="text-mist hover:text-parchment" href="/profile">
                  View profile
                </Link>
                <button className="text-gold hover:text-parchment" onClick={() => void handleLogout()} type="button">
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <div className="ml-auto self-end sm:self-auto">
              <button className="text-sm font-medium text-gold hover:text-parchment" onClick={() => void handleLogout()} type="button">
                Log out
              </button>
            </div>
          )}
        </header>

        {showFirstPassUploadStep ? (
          <section className="mx-auto w-full max-w-3xl rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm uppercase tracking-[0.28em] text-gold">One last optional step</p>
            <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">Add a markdown file to your memory</h1>
            <p className="mt-4 text-base leading-7 text-ink/72 sm:text-lg sm:leading-8">
              You&apos;ve finished your questions. If you already have notes, journaling, or a profile in markdown,
              you can upload it now to give TrueNorth more context.
            </p>
            <div className="mt-8 rounded-[1.75rem] border border-dashed border-ink/18 bg-parchment p-5 sm:p-6">
              <p className="text-sm uppercase tracking-[0.28em] text-gold">Upload markdown</p>
              <label className="mt-5 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-ink/18 bg-white px-4 py-8 text-center text-sm text-ink/70 hover:border-gold">
                <input accept=".md,text/markdown,text/plain" className="hidden" onChange={handleFileUpload} type="file" />
                {uploading ? "Uploading markdown..." : "Choose a markdown file"}
              </label>
              <p className="mt-4 text-sm leading-6 text-ink/65">
                This is optional. You can always upload files later from your query or profile experience.
              </p>
            </div>
            {notice ? <p className="mt-4 text-sm leading-6 text-teal-700">{notice}</p> : null}
            {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-ink"
                onClick={() => onComplete()}
                type="button"
              >
                Continue to dashboard
              </button>
              <Link
                className="rounded-2xl border border-ink/10 px-6 py-3 text-center text-sm font-semibold text-ink"
                href="/profile"
              >
                Review my profile
              </Link>
            </div>
          </section>
        ) : (
        <section className={reviewMode ? "grid gap-6 lg:grid-cols-[1.1fr_0.9fr]" : "mx-auto w-full max-w-3xl"}>
          <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm uppercase tracking-[0.28em] text-gold">
                <span>
                  Question {Math.min(state.current_index + 1, state.total_count)} of {state.total_count}
                </span>
                <span>{state.progress.completion_percentage}%</span>
              </div>
              <div className="h-2 rounded-full bg-parchment">
                <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: progressWidth }} />
              </div>
            </div>

            {state.question ? (
              <>
                <p className="text-sm uppercase tracking-[0.28em] text-gold">{state.question.label}</p>
                <h1 className="mt-3 font-serif text-3xl leading-tight text-ink sm:text-4xl">{state.question.prompt}</h1>
                <p className="mt-4 text-sm italic text-ink/55">
                  There&apos;s no right answer. You can say as much or as little as you&apos;d like.
                </p>
                {state.current_answer?.skipped ? (
                  <p className="mt-3 text-sm text-ink/60">You previously skipped this question. Add an answer any time.</p>
                ) : state.current_answer?.answer_text ? (
                  <p className="mt-3 text-sm text-ink/60">You can edit and resave this answer whenever you want.</p>
                ) : null}
                {state.question.input_type === "singleline" ? (
                  <input
                    className="mt-8 w-full rounded-[1.5rem] border border-ink/10 bg-parchment px-5 py-4 text-base leading-7 text-ink outline-none transition placeholder:text-ink/35 focus:border-gold"
                    maxLength={state.question.max_length ?? undefined}
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={handleAnswerKeyDown}
                    placeholder={state.question.placeholder}
                    type="text"
                    value={answer}
                  />
                ) : (
                  <textarea
                    className="mt-8 min-h-[180px] w-full rounded-[1.5rem] border border-ink/10 bg-parchment px-5 py-4 text-base leading-7 text-ink outline-none transition placeholder:text-ink/35 focus:border-gold sm:min-h-[220px]"
                    maxLength={state.question.max_length ?? undefined}
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={handleAnswerKeyDown}
                    placeholder={state.question.placeholder}
                    value={answer}
                  />
                )}
                {state.question.max_length ? (
                  <p className="mt-3 text-right text-xs uppercase tracking-[0.2em] text-ink/45">
                    {answer.length}/{state.question.max_length}
                  </p>
                ) : null}

                {error ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
                {notice ? (
                  <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                    {notice}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="text-sm font-medium text-ink/65 transition hover:text-ink"
                    onClick={() => void submitAnswer(true)}
                    type="button"
                  >
                    Skip for now
                  </button>
                  <button
                    className="rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={saving}
                    onClick={() => void submitAnswer(false)}
                    type="button"
                  >
                    {saving ? "Saving..." : state.current_answer?.answer_text || state.current_answer?.skipped ? "Save changes" : "Continue"}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.28em] text-gold">Onboarding complete</p>
                <h1 className="font-serif text-3xl text-ink sm:text-4xl">Your profile is in place.</h1>
                <p className="text-base leading-7 text-ink/70 sm:text-lg sm:leading-8">
                  You&apos;ve completed the current onboarding flow. You can review your profile, make edits, or move
                  into the dashboard.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link className="rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-ink" href="/dashboard">
                    Go to dashboard
                  </Link>
                  <Link
                    className="rounded-2xl border border-ink/10 px-6 py-3 text-sm font-semibold text-ink"
                    href="/profile"
                  >
                    View profile
                  </Link>
                </div>
              </div>
            )}
          </div>

          {reviewMode ? (
          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-gold">Upload markdown</p>
              <p className="mt-3 text-sm leading-7 text-ink/72">
                Add an existing `.md` document to seed your profile. Upload is optional and won&apos;t block onboarding
                completion.
              </p>
              <label className="mt-5 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-ink/18 bg-parchment px-4 py-6 text-center text-sm text-ink/70 hover:border-gold">
                <input accept=".md,text/markdown,text/plain" className="hidden" onChange={handleFileUpload} type="file" />
                {uploading ? "Uploading markdown..." : "Choose a markdown file"}
              </label>
            </div>

            <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.28em] text-gold">Your profile is building</p>
              <p className="mt-3 text-sm leading-7 text-ink/72">{state.profile_preview.summary_text}</p>
              <div className="mt-5 space-y-3">
                {state.profile_preview.sections.map((section) => (
                  <div className="rounded-2xl bg-parchment px-4 py-3" key={section.key}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-ink">{section.label}</p>
                      <div className="flex items-center gap-3">
                        <button
                          className="text-xs uppercase tracking-[0.22em] text-ink/70 underline decoration-gold/60 underline-offset-4"
                          onClick={() => void handleEditQuestion(section.key)}
                          type="button"
                        >
                          Edit
                        </button>
                        <span className="text-xs uppercase tracking-[0.22em] text-gold">{section.status}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/65">
                      {section.value || (section.status === "skipped" ? "Skipped for now." : "Not captured yet.")}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.28em] text-mist">
                {state.profile_preview.uploaded_files_count} uploaded markdown file
                {state.profile_preview.uploaded_files_count === 1 ? "" : "s"}
              </p>
            </div>
          </aside>
          ) : null}
        </section>
        )}
      </div>
    </main>
  );
}
