"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { getCurrentUser } from "@/lib/auth";
import {
  faceEnroll,
  faceUnenroll,
  getFaceStatus,
  getPasscodeStatus,
  removePasscode,
  setPasscode,
  type FaceStatus,
  type PasscodeStatus,
  type SessionUser,
} from "@/lib/api";


function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);
  const [passcodeStatus, setPasscodeStatus] = useState<PasscodeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);

 
  const [pinInput, setPinInput] = useState("");
  const [pinWorking, setPinWorking] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [showPinInput, setShowPinInput] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cameraSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getFaceStatus();
      setFaceStatus(s);
    } catch {
      // not fatal
    }
  }, []);

  const refreshPasscodeStatus = useCallback(async () => {
    try {
      const s = await getPasscodeStatus();
      setPasscodeStatus(s);
    } catch {
      // not fatal
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.replace("/login");
          return;
        }
        if (mounted) setUser(currentUser);

        const s = await getFaceStatus();
        if (mounted) setFaceStatus(s);

        const ps = await getPasscodeStatus();
        if (mounted) setPasscodeStatus(ps);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

 
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function startCamera() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
     
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            void video.play().then(resolve);
          };
        });
      }
      setCameraActive(true);
    } catch {
      setMessage({ text: "Could not access your camera. Please allow camera permission and try again.", kind: "error" });
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function handleCapture() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;


    await new Promise<void>((resolve) => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      const check = setInterval(() => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });

    // Extra 1s for camera to stabilise
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    console.log("[face] dataUrl length:", dataUrl.length, "prefix:", dataUrl.substring(0, 30));

    const base64Image = dataUrl.replace(/^data:image\/\w+;base64,/, "");

    stopCamera();
    setWorking(true);
    setMessage(null);
    try {
      const result = await faceEnroll(base64Image);
      setMessage({ text: result.message, kind: "success" });
      await refreshStatus();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Enrollment failed. Please try again.";
      setMessage({ text, kind: "error" });
    } finally {
      setWorking(false);
    }
  }

  async function handleUnenroll() {
    if (!confirm("Remove Face ID? You will need to use your password to sign in.")) {
      return;
    }
    setMessage(null);
    setWorking(true);
    try {
      const result = await faceUnenroll();
      setMessage({ text: result.message, kind: "success" });
      await refreshStatus();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to remove Face ID.";
      setMessage({ text, kind: "error" });
    } finally {
      setWorking(false);
    }
  }

  async function handleSetPasscode() {
    setPinMessage(null);
    if (!/^\d{6}$/.test(pinInput)) {
      setPinMessage({ text: "PIN must be exactly 6 digits.", kind: "error" });
      return;
    }
    setPinWorking(true);
    try {
      const result = await setPasscode(pinInput);
      setPinMessage({ text: result.message, kind: "success" });
      setPinInput("");
      setShowPinInput(false);
      await refreshPasscodeStatus();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to set passcode.";
      setPinMessage({ text, kind: "error" });
    } finally {
      setPinWorking(false);
    }
  }

  async function handleRemovePasscode() {
    if (!confirm("Remove passcode? You will need to use your password to sign in.")) {
      return;
    }
    setPinMessage(null);
    setPinWorking(true);
    try {
      const result = await removePasscode();
      setPinMessage({ text: result.message, kind: "success" });
      await refreshPasscodeStatus();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to remove passcode.";
      setPinMessage({ text, kind: "error" });
    } finally {
      setPinWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16">
        <div className="rounded-full border border-ink/10 bg-white px-5 py-2 text-sm text-ink/70">
          Loading settings...
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-parchment px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
    
        {isWelcome && (
          <div className="rounded-[2rem] border border-gold/30 bg-gold/10 px-6 py-5">
            <p className="font-semibold text-ink">Welcome to TrueNorth!</p>
            <p className="mt-1 text-sm leading-6 text-ink/70">
              Your profile is set up. While you&apos;re here, set up <strong>Face ID</strong> and a <strong>Passcode</strong> below so you can sign in quickly next time without a password.
            </p>
            <Link
              className="mt-3 inline-block text-sm font-semibold text-gold underline underline-offset-4"
              href="/dashboard"
            >
              Skip and go to dashboard →
            </Link>
          </div>
        )}

        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-ink px-4 py-4 text-parchment shadow-panel sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:px-5 sm:py-3">
          <BrandMark subtitle="Settings" />
          <div className="ml-auto flex items-center gap-4">
            <Link className="text-sm font-medium text-gold hover:text-parchment" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-sm font-medium text-gold hover:text-parchment" href="/profile">
              Profile
            </Link>
          </div>
        </header>

        <div className="rounded-[2rem] border border-ink/8 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Security</p>
          <h1 className="mt-3 font-serif text-3xl text-ink">Face ID</h1>
          <p className="mt-3 text-base leading-7 text-ink/70">
            Use your camera to enroll your face and sign in without a password. Your face data is
            stored securely on our servers and never shared.
          </p>

          {!cameraSupported && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              Your browser does not support camera access. Try a modern browser such as Chrome,
              Safari, or Firefox.
            </div>
          )}

          {cameraSupported && (
            <div className="mt-6 space-y-4">
         
              <div className="flex items-center gap-3 rounded-2xl border border-ink/6 bg-parchment/60 px-5 py-4">
                <span
                  className={`h-3 w-3 rounded-full ${faceStatus?.enrolled ? "bg-teal-500" : "border border-ink/20 bg-ink/10"}`}
                />
                <p className="text-sm font-medium text-ink">
                  {faceStatus?.enrolled ? "Face ID is active" : "No face enrolled"}
                </p>
              </div>

            
              <div className={`overflow-hidden rounded-2xl border border-ink/10 bg-black ${cameraActive ? "block" : "hidden"}`}>
                <video
                  ref={videoRef}
                  className="w-full"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            
              <canvas ref={canvasRef} className="hidden" />

              
              <div className="flex flex-col gap-3 sm:flex-row">
                {!cameraActive ? (
                  <button
                    className="flex-1 rounded-2xl bg-ink px-6 py-4 text-sm font-semibold text-white shadow transition hover:bg-ink/90 disabled:opacity-50"
                    disabled={working}
                    onClick={() => void startCamera()}
                    type="button"
                  >
                    {working ? "Processing..." : faceStatus?.enrolled ? "Re-enroll Face ID" : "Start Camera"}
                  </button>
                ) : (
                  <>
                    <button
                      className="flex-1 rounded-2xl bg-ink px-6 py-4 text-sm font-semibold text-white shadow transition hover:bg-ink/90 disabled:opacity-50"
                      disabled={working}
                      onClick={() => void handleCapture()}
                      type="button"
                    >
                      Capture &amp; Enroll
                    </button>
                    <button
                      className="flex-1 rounded-2xl border border-ink/12 bg-parchment px-6 py-4 text-sm font-semibold text-ink shadow-sm transition hover:bg-parchment/80"
                      onClick={stopCamera}
                      type="button"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {faceStatus?.enrolled && !cameraActive && (
                  <button
                    className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
                    disabled={working}
                    onClick={() => void handleUnenroll()}
                    type="button"
                  >
                    {working ? "Working..." : "Remove Face ID"}
                  </button>
                )}
              </div>

           
              {message && (
                <div
                  className={`rounded-2xl px-5 py-3 text-sm ${
                    message.kind === "success"
                      ? "border border-teal-200 bg-teal-50 text-teal-800"
                      : "border border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          )}
        </div>


        <div className="rounded-[2rem] border border-ink/8 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Passcode</p>
          <h1 className="mt-3 font-serif text-3xl text-ink">PIN Login</h1>
          <p className="mt-3 text-base leading-7 text-ink/70">
            Set a 6-digit PIN to sign in quickly without typing your full password.
          </p>

          <div className="mt-6 space-y-4">
       
            <div className="flex items-center gap-3 rounded-2xl border border-ink/6 bg-parchment/60 px-5 py-4">
              <span
                className={`h-3 w-3 rounded-full ${passcodeStatus?.has_passcode ? "bg-teal-500" : "border border-ink/20 bg-ink/10"}`}
              />
              <p className="text-sm font-medium text-ink">
                {passcodeStatus?.has_passcode ? "Passcode is active" : "No passcode set"}
              </p>
            </div>

          
            {showPinInput && (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm uppercase tracking-[0.28em] text-ink/50">
                    Enter PIN (6 digits)
                  </span>
                  <input
                    autoFocus
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="w-full rounded-2xl border border-ink/12 bg-parchment/60 px-4 py-4 text-base text-ink outline-none transition placeholder:text-ink/30 focus:border-gold"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSetPasscode(); }}
                    placeholder="Enter 6-digit PIN"
                    type="text"
                    value={pinInput}
                  />
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="flex-1 rounded-2xl bg-ink px-6 py-4 text-sm font-semibold text-white shadow transition hover:bg-ink/90 disabled:opacity-50"
                    disabled={pinWorking}
                    onClick={() => void handleSetPasscode()}
                    type="button"
                  >
                    {pinWorking ? "Saving..." : "Save Passcode"}
                  </button>
                  <button
                    className="flex-1 rounded-2xl border border-ink/12 bg-parchment px-6 py-4 text-sm font-semibold text-ink shadow-sm transition hover:bg-parchment/80"
                    onClick={() => { setShowPinInput(false); setPinInput(""); setPinMessage(null); }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

       
            {!showPinInput && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-2xl bg-ink px-6 py-4 text-sm font-semibold text-white shadow transition hover:bg-ink/90 disabled:opacity-50"
                  disabled={pinWorking}
                  onClick={() => { setPinMessage(null); setShowPinInput(true); }}
                  type="button"
                >
                  {passcodeStatus?.has_passcode ? "Change Passcode" : "Set Passcode"}
                </button>

                {passcodeStatus?.has_passcode && (
                  <button
                    className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
                    disabled={pinWorking}
                    onClick={() => void handleRemovePasscode()}
                    type="button"
                  >
                    {pinWorking ? "Working..." : "Remove Passcode"}
                  </button>
                )}
              </div>
            )}

       
            {pinMessage && (
              <div
                className={`rounded-2xl px-5 py-3 text-sm ${
                  pinMessage.kind === "success"
                    ? "border border-teal-200 bg-teal-50 text-teal-800"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {pinMessage.text}
              </div>
            )}
          </div>
        </div>

        
        <Link
          className="text-center text-sm font-medium text-ink/50 underline decoration-ink/20 underline-offset-4 hover:text-ink/70"
          href="/dashboard"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-16">
        <div className="rounded-full border border-ink/10 bg-white px-5 py-2 text-sm text-ink/70">
          Loading settings...
        </div>
      </main>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}