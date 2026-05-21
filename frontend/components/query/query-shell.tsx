"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { BrandMark } from "@/components/brand/brand-mark";
import {
  askThreadMemoryQuestion,
  getMemoryThreadById,
  getMemoryThreads,
  logoutUser,
  removeMemoryThread,
  startMemoryThread,
} from "@/lib/auth";
import type { ChatMessage, ChatThreadSummary, SessionUser, UserProfile } from "@/lib/api";

type QueryShellProps = {
  initialProfile: UserProfile;
  user: SessionUser;
};

const MAX_QUERY_LENGTH = 1000;

function formatThreadTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function QueryShell({ initialProfile, user }: QueryShellProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const identityLabel = profile.display_name || user.email;
  const avatarLabel = useMemo(() => {
    const trimmedName = (profile.display_name || "").trim();
    if (trimmedName) {
      const parts = trimmedName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
      }
      return trimmedName.slice(0, 2).toUpperCase();
    }
    const trimmedEmail = user.email.trim();
    return (trimmedEmail.slice(0, 2) || "TN").toUpperCase();
  }, [profile.display_name, user.email]);

  useEffect(() => {
    if (!conversationRef.current) {
      return;
    }
    conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [messages, asking]);

  useEffect(() => {
    let mounted = true;

    async function loadThreads() {
      try {
        const threadList = await getMemoryThreads();
        if (!mounted) {
          return;
        }
        setThreads(threadList);
        if (threadList[0]) {
          setActiveThreadId(threadList[0].id);
        }
      } catch (threadError) {
        if (mounted) {
          setError(threadError instanceof Error ? threadError.message : "We couldn't load your conversations.");
        }
      } finally {
        if (mounted) {
          setLoadingThreads(false);
        }
      }
    }

    void loadThreads();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadActiveThread() {
      if (!activeThreadId) {
        setMessages([]);
        return;
      }

      setLoadingConversation(true);
      try {
        const thread = await getMemoryThreadById(activeThreadId);
        if (!mounted) {
          return;
        }
        setMessages(thread.messages);
      } catch (threadError) {
        if (mounted) {
          setError(threadError instanceof Error ? threadError.message : "We couldn't open that conversation.");
        }
      } finally {
        if (mounted) {
          setLoadingConversation(false);
        }
      }
    }

    void loadActiveThread();

    return () => {
      mounted = false;
    };
  }, [activeThreadId]);

  async function handleLogout() {
    await logoutUser();
    router.replace("/login");
    router.refresh();
  }

  async function refreshThreads(nextActiveThreadId?: number | null) {
    const threadList = await getMemoryThreads();
    setThreads(threadList);
    if (typeof nextActiveThreadId === "number") {
      setActiveThreadId(nextActiveThreadId);
      return;
    }
    if (!activeThreadId && threadList[0]) {
      setActiveThreadId(threadList[0].id);
    }
  }

  async function handleCreateThread() {
    setError(null);
    setNotice(null);
    const thread = await startMemoryThread();
    await refreshThreads(thread.id);
    setMessages(thread.messages);
  }

  async function handleDeleteThread(threadId: number) {
    setError(null);
    setNotice(null);
    try {
      await removeMemoryThread(threadId);
      const nextThreads = threads.filter((thread) => thread.id !== threadId);
      setThreads(nextThreads);
      if (activeThreadId === threadId) {
        const nextActive = nextThreads[0]?.id ?? null;
        setActiveThreadId(nextActive);
        if (!nextActive) {
          setMessages([]);
        }
      }
      setNotice("Conversation deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "We couldn't delete that conversation.");
    }
  }

  async function handleAsk(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Ask something about yourself first.");
      return;
    }
    if (trimmed.length > MAX_QUERY_LENGTH) {
      setError("Questions must be 1000 characters or fewer.");
      return;
    }

    setAsking(true);
    setError(null);
    setNotice(null);

    let threadId = activeThreadId;
    if (!threadId) {
      const thread = await startMemoryThread(trimmed);
      threadId = thread.id;
      setActiveThreadId(thread.id);
      setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      setMessages(thread.messages);
    }

    const optimisticMessage: ChatMessage = {
      id: -Date.now(),
      role: "user",
      text: trimmed,
      provider: null,
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticMessage]);
    setQuery("");

    try {
      await askThreadMemoryQuestion(trimmed, threadId);
      const refreshedThread = await getMemoryThreadById(threadId);
      setMessages(refreshedThread.messages);
      setProfile((current) => ({
        ...current,
        latest_memory_query: trimmed,
        latest_memory_answer: refreshedThread.messages.at(-1)?.role === "assistant" ? refreshedThread.messages.at(-1)?.text ?? current.latest_memory_answer : current.latest_memory_answer,
      }));
      await refreshThreads(threadId);
    } catch (queryError) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setError(queryError instanceof Error ? queryError.message : "We couldn't answer that right now.");
    } finally {
      setAsking(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!asking) {
        void handleAsk();
      }
    }
  }



  return (
    <main className="min-h-screen bg-parchment px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-ink px-4 py-4 text-parchment shadow-panel sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3">
          <BrandMark />
          <nav className="ml-auto flex flex-wrap items-center justify-end gap-4 self-end text-right text-sm">
            <Link className="text-gold hover:text-parchment" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-gold hover:text-parchment" href="/profile">
              Profile
            </Link>
            <button
              className="rounded-full border border-gold/35 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/10"
              onClick={() => void handleLogout()}
              type="button"
            >
              Log out
            </button>
          </nav>
        </header>

        <section className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-gold">Threads</p>
                <p className="mt-1 text-sm text-ink/55">Jump back into any earlier conversation.</p>
              </div>
              <button
                className="rounded-full border border-ink/12 bg-parchment px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:border-gold"
                onClick={() => void handleCreateThread()}
                type="button"
              >
                New chat
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loadingThreads ? (
                <p className="text-sm text-ink/55">Loading conversations...</p>
              ) : threads.length ? (
                threads.map((thread) => (
                  <div
                    className={`rounded-[1.4rem] border px-4 py-3 transition ${
                      thread.id === activeThreadId
                        ? "border-gold bg-parchment"
                        : "border-ink/10 bg-white hover:border-gold/55"
                    }`}
                    key={thread.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setActiveThreadId(thread.id)} type="button">
                        <p className="line-clamp-1 text-sm font-semibold text-ink">{thread.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/35">
                          {formatThreadTimestamp(thread.last_message_at)}
                        </p>
                      </button>
                      <button
                        aria-label={`Delete ${thread.title}`}
                        className="shrink-0 rounded-full border border-ink/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55 transition hover:border-red-300 hover:text-red-700"
                        onClick={() => void handleDeleteThread(thread.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-ink/14 bg-parchment px-4 py-5 text-sm leading-6 text-ink/60">
                  No saved threads yet. Start your first conversation and it will stay here.
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-ink/10 bg-white shadow-sm">
            <div className="rounded-t-[2rem] bg-ink px-5 py-6 text-parchment sm:px-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/8 text-base font-semibold text-gold sm:h-14 sm:w-14 sm:text-lg">
                  {avatarLabel}
                </div>
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl">{identityLabel}</h1>
                  <p className="mt-1 text-sm text-gold/85">Ask anything about yourself and TrueNorth will remember the thread.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-8">
              <div className="rounded-[1.5rem] border border-gold/20 bg-parchment px-4 py-5 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.28em] text-gold">
                    {threads.find((thread) => thread.id === activeThreadId)?.title || "Conversation"}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                    {query.trim().length}/{MAX_QUERY_LENGTH}
                  </p>
                </div>

                <div
                  className="chat-scroll mt-4 max-h-[55vh] space-y-4 overflow-y-auto pr-1 sm:max-h-[34rem]"
                  ref={conversationRef}
                >
                  {loadingConversation ? (
                    <p className="text-sm text-ink/55">Loading conversation...</p>
                  ) : messages.length ? (
                    messages.map((message) => (
                      <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={message.id}>
                        <div
                          className={`max-w-[85%] rounded-[1.4rem] px-4 py-3 sm:max-w-[78%] ${
                            message.role === "user"
                              ? "bg-ink text-parchment"
                              : "border border-ink/10 bg-white text-ink"
                          }`}
                        >
                          <p
                            className={`text-[11px] uppercase tracking-[0.18em] ${
                              message.role === "user" ? "text-gold/80" : "text-gold"
                            }`}
                          >
                            {message.role === "user" ? "You" : "TrueNorth"}
                          </p>
                          <div className="mt-2 text-sm leading-7 sm:text-base sm:leading-8 [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-semibold">
                            <ReactMarkdown>{message.text}</ReactMarkdown>
                          </div>

                          {message.role === "assistant" && message.sources?.length ? (
                            <div className="mt-4 space-y-3">
                              {message.sources.map((source) => (
                                <div
                                  className="rounded-2xl bg-parchment px-3 py-3"
                                  key={`${message.id}-${source.source_type}-${source.source_id}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-ink">{source.label}</p>
                                    <span className="text-[11px] uppercase tracking-[0.18em] text-gold">
                                      {source.source_type}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-ink/70">{source.excerpt}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-base leading-8 text-ink/55">
                      Start a conversation with questions like “Who am I?”, “What matters most to me?”, or “What am I working toward?”
                    </p>
                  )}

                  {asking ? (
                    <div className="flex justify-start">
                      <div className="max-w-[78%] rounded-[1.4rem] border border-ink/10 bg-white px-4 py-3 text-ink">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gold">TrueNorth</p>
                        <p className="mt-2 text-sm leading-7 text-ink/65">Thinking...</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleAsk}>
                <label className="flex-1">
                  <span className="sr-only">Ask something about yourself</span>
                  <textarea
                    className="min-h-[110px] w-full rounded-2xl border border-ink/10 bg-parchment px-5 py-4 text-base text-ink outline-none transition placeholder:text-ink/35 focus:border-gold"
                    maxLength={MAX_QUERY_LENGTH}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Ask something about yourself..."
                    value={query}
                  />
                </label>
                <button
                  className="rounded-2xl bg-ink px-6 py-4 text-sm font-semibold text-gold transition hover:bg-ink/92 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={asking}
                  type="submit"
                >
                  {asking ? "Thinking..." : "Send"}
                </button>
              </form>



              {notice ? <p className="text-sm leading-6 text-teal-700">{notice}</p> : null}
              {error ? <p className="text-sm leading-6 text-red-700">{error}</p> : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
