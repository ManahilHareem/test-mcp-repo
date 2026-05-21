"use client";

import { BrandMark } from "@/components/brand/brand-mark";
import { logoutUser } from "@/lib/auth";
import {
  generateInsights,
  generateFeed,
  getFeed,
  type FeedItem,
  type FeedResponse,
  type SessionUser,
  type UserProfile,
} from "@/lib/api";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

function RadarLabel(props: Record<string, unknown>) {
  const x = props.x as number;
  const y = props.y as number;
  const cx = props.cx as number;
  const cy = props.cy as number;
  const payload = props.payload as { value: string };
  const value = payload?.value ?? "";
  const words = value.split(" ");
  const anchor = x < cx - 10 ? "end" : x > cx + 10 ? "start" : "middle";
  const isTop = y < cy;
  const lineHeight = 14;
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 2) {
    lines.push(words.slice(i, i + 2).join(" "));
  }
  const totalHeight = lines.length * lineHeight;
  const startY = isTop ? y - totalHeight + lineHeight : y;
  return (
    <text x={x} y={startY} textAnchor={anchor} fill="rgba(255,255,255,0.75)" fontSize={11} fontWeight={500}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>{line}</tspan>
      ))}
    </text>
  );
}
import ReactMarkdown from "react-markdown";

type DashboardShellProps = {
  profile: UserProfile;
  user: SessionUser;
  onLoggedOut: () => void;
};

export function DashboardShell({ profile: initialProfile, user, onLoggedOut }: DashboardShellProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [generating, setGenerating] = useState(false);

  
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedRunId, setFeedRunId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => {
    getFeed()
      .then(setFeed)
      .catch(() => {/* no feed yet, that's fine */});
  }, []);

  
  useEffect(() => {
    if (!feedRunId) return;
    pollRef.current = setInterval(async () => {
      try {
       
        const latest = await getFeed();
        setFeed(latest);
        if (latest.status === "complete") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setFeedRunId(null);
          setFeedLoading(false);
        } else if (latest.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setFeedRunId(null);
          setFeedError("Feed generation failed. Please try again.");
          setFeedLoading(false);
        }
      } catch {
      
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [feedRunId]);

  const handleGenerateFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const res = await generateFeed();
      setFeedRunId(res.run_id);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : "Failed to start feed generation.");
      setFeedLoading(false);
    }
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const updated = await generateInsights();
      setProfile(updated);
    } catch {
      alert("Failed to generate AI profile. Please try again later.");
    } finally {
      setGenerating(false);
    }
  }
  async function handleLogout() {
    await logoutUser();
    onLoggedOut();
  }

  const answeredCount = profile.sections.filter((section) => section.status === "answered").length;
  const missingCount = profile.sections.filter((section) => section.status !== "answered").length;
  const completionWidth = `${profile.completion_percentage}%`;
  const fileScore = Math.min(100, profile.uploaded_files.length * 34);
  const fileWidth = `${fileScore}%`;
  const knownItems = [
    ...profile.sections
      .filter((section) => section.status === "answered")
      .map((section) => ({ label: section.label, tone: "teal" as const })),
    ...profile.uploaded_files.map((file) => ({ label: file.filename, tone: "gold" as const })),
    ...profile.sections
      .filter((section) => section.status !== "answered")
      .map((section) => ({ label: `${section.label} — ${section.status === "skipped" ? "skipped for now" : "not yet provided"}`, tone: "muted" as const })),
  ];
  const iconClassName = "h-5 w-5";

  return (
    <main className="min-h-screen bg-parchment px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-ink px-4 py-4 text-parchment shadow-panel sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3">
          <BrandMark subtitle="My Vault" />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3 self-end text-right">
            <Link className="text-sm font-medium text-gold hover:text-parchment" href="/query">
              Query
            </Link>
            <Link className="text-sm font-medium text-gold hover:text-parchment" href="/profile">
              Profile
            </Link>
            <Link className="text-sm font-medium text-gold hover:text-parchment" href="/settings">
              Settings
            </Link>
            {user.role === "admin" && (
              <Link className="text-sm font-medium text-gold/60 hover:text-parchment" href="/admin">
                Admin
              </Link>
            )}
            <button
              className="rounded-full border border-gold/35 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/10"
              onClick={() => void handleLogout()}
              type="button"
            >
              Log out
            </button>
          </div>
        </header>

        <section className="space-y-4">
          {profile.ai_summary_text ? (
            <div className="rounded-[2.5rem] bg-gradient-to-br from-ink to-slate-900 p-8 sm:p-12 text-white shadow-xl relative overflow-hidden ring-1 ring-white/10">
             
              <div className="absolute -top-32 -right-32 p-12 opacity-[0.12] blur-[100px] pointer-events-none">
                 <div className="w-96 h-96 bg-gold rounded-full" />
              </div>
              
              <div className="relative z-10 flex flex-col xl:flex-row gap-12 items-start justify-between">
                <div className="flex-1 space-y-6">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-gold/90 font-medium">TrueNorth Profile</p>
                    <h2 className="mt-2 font-serif text-4xl sm:text-5xl text-white">Your Archetype</h2>
                  </div>
                  <div className="w-16 h-px bg-gradient-to-r from-gold/80 to-transparent" />
                  
                  <div className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg sm:leading-[1.9] font-light [&>p]:mb-5 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-5 [&>ul>li]:mb-1 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-5 [&>strong]:font-semibold [&>strong]:text-gold/90 [&>h3]:text-xl [&>h3]:font-serif [&>h3]:text-white [&>h3]:mb-3 [&>h4]:text-lg [&>h4]:font-medium [&>h4]:text-white [&>h4]:mb-2 [&>em]:italic">
                    <ReactMarkdown>{profile.ai_summary_text}</ReactMarkdown>
                  </div>
                </div>
                
                {profile.ai_wheel_of_life && profile.ai_wheel_of_life.length > 0 && (
                  <div className="w-full xl:w-[450px] shrink-0 bg-gradient-to-br from-[#1a252c] to-ink rounded-[2rem] p-6 sm:p-8 border border-white/10 shadow-2xl relative mt-4 xl:mt-0">
                    <p className="text-center text-sm uppercase tracking-[0.2em] text-gold/80 mb-4 font-medium">Energy & Alignment</p>
                    <div className="h-96 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="55%" data={profile.ai_wheel_of_life}>
                          <PolarGrid stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                          <PolarAngleAxis
                            dataKey="category"
                            tick={(props) => <RadarLabel {...props} />}
                          />
                          <PolarRadiusAxis 
                            angle={30} 
                            domain={[0, 100]} 
                            tick={false} 
                            axisLine={false} 
                          />
                          <Radar 
                            name="TrueNorth" 
                            dataKey="score" 
                            stroke="#b49157" 
                            strokeWidth={3}
                            fill="#b49157" 
                            fillOpacity={0.35} 
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[2.5rem] border border-ink/8 bg-white p-8 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-gold">Trust dashboard</p>
              <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">My Vault</h1>
              <div className="mt-6 flex flex-col items-start gap-6">
                <p className="max-w-3xl text-base leading-8 text-ink/75 sm:text-lg">
                   {profile.summary_text}
                </p>
                <div className="w-full rounded-2xl bg-parchment/60 p-6 sm:p-8 border border-gold/20 flex flex-col sm:flex-row gap-6 items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ink text-lg">Your TrueNorth Is Ready</h3>
                    <p className="text-sm text-ink/70 mt-1 max-w-sm">Tap below to have AI synthesize your completed onboarding data into a personalized archetype visualization.</p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="shrink-0 w-full sm:w-auto rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-ink/90 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                    type="button"
                  >
                    {generating ? "Generating Profile..." : "Generate AI Profile"}
                  </button>
                </div>
              </div>
            </div>
          )}

         
          <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-ink">Your Daily Feed</p>
                <p className="mt-1 text-sm text-ink/60">
                  Curated by your agents — filtered through TrueNorth values
                </p>
              </div>
              <button
                onClick={() => void handleGenerateFeed()}
                disabled={feedLoading}
                type="button"
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-50"
              >
                {feedLoading ? "Generating..." : feed ? "Refresh Feed" : "Generate Feed"}
              </button>
            </div>

            {feedError && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{feedError}</p>
            )}

           
            {(feed?.items?.length ?? 0) > 0 && (
              <div className="space-y-4">
                {feed!.items.map((item: FeedItem) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-ink/6 bg-parchment/40 px-5 py-5 hover:bg-parchment/70 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {item.arena && (
                          <span className="inline-block mb-2 rounded-full bg-gold/15 px-3 py-0.5 text-xs font-medium text-gold">
                            {item.arena}
                          </span>
                        )}
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block font-semibold text-ink hover:text-gold transition leading-snug"
                          >
                            {item.title}
                          </a>
                        ) : (
                          <p className="font-semibold text-ink leading-snug">{item.title}</p>
                        )}
                        <p className="mt-2 text-sm leading-6 text-ink/70">{item.summary}</p>
                        <p className="mt-2 text-xs leading-5 text-teal-700 italic">{item.relevance_reason}</p>
                        {item.published_at && (
                          <p className="mt-2 text-xs text-ink/40">Published {item.published_at}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
             
                {feedLoading && Array.from({ length: Math.max(0, 6 - (feed?.items?.length ?? 0)) }).map((_, i) => (
                  <div key={`sk-${i}`} className="h-24 animate-pulse rounded-2xl bg-parchment/60" />
                ))}
              </div>
            )}

          
            {feedLoading && (feed?.items?.length ?? 0) === 0 && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-parchment/60" />
                ))}
                <p className="text-center text-sm text-ink/50 pt-2">
                  Agents are working — this takes 20–40 seconds…
                </p>
              </div>
            )}

            {!feedLoading && !feed && (
              <div className="rounded-2xl bg-parchment/60 px-6 py-8 text-center border border-ink/5">
                <p className="text-sm text-ink/60">
                  No feed yet. Click <span className="font-semibold text-ink">Generate Feed</span> to have your agents research what matters to you today.
                </p>
              </div>
            )}
          </div>

          
          <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <svg
                  aria-hidden="true"
                  className={iconClassName}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 7.8v4.6l3.1 1.9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-ink">Profile Completeness</p>
                <p className="mt-1 text-sm leading-6 text-ink/70">
                  {answeredCount} of {profile.total_count} areas answered
                </p>
                <div className="mt-5 h-2 rounded-full bg-parchment">
                  <div className="h-full rounded-full bg-teal-700" style={{ width: completionWidth }} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 text-gold">
                <svg
                  aria-hidden="true"
                  className={iconClassName}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8 4.8h6.2l3.3 3.4v10.5a1.8 1.8 0 0 1-1.8 1.8H8a1.8 1.8 0 0 1-1.8-1.8V6.6A1.8 1.8 0 0 1 8 4.8Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <path d="M14.2 4.8v3a1 1 0 0 0 1 1h2.3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-ink">Files in Your Vault</p>
                <p className="mt-1 text-sm leading-6 text-ink/70">
                  {profile.uploaded_files.length} markdown file{profile.uploaded_files.length === 1 ? "" : "s"} uploaded
                </p>
                <div className="mt-5 h-2 rounded-full bg-parchment">
                  <div className="h-full rounded-full bg-gold" style={{ width: fileWidth }} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-ink/8 bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-ink">What TrueNorth Knows About You</p>
            <div className="mt-5 space-y-3">
              {knownItems.map((item) => (
                <div className="flex items-start gap-3" key={item.label}>
                  <span
                    className={`mt-2 h-2.5 w-2.5 rounded-full ${
                      item.tone === "teal" ? "bg-teal-600" : item.tone === "gold" ? "bg-gold" : "border border-ink/20 bg-ink/10"
                    }`}
                  />
                  <p className="text-sm leading-7 text-ink/78">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-parchment px-5 py-5 text-sm text-ink/75 border border-ink/5">
                <span className="font-semibold text-ink">{answeredCount}</span> sections answered
              </div>
              <div className="rounded-2xl bg-parchment px-5 py-5 text-sm text-ink/75 border border-ink/5">
                <span className="font-semibold text-ink">{missingCount}</span> sections still missing or skipped
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
