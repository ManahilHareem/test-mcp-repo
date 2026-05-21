"use client";

import { FormEvent, useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { loginUser, registerUser } from "@/lib/auth";
import { faceLogin, passcodeLogin } from "@/lib/api";

type Mode = "login" | "register";

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};


export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [faceWorking, setFaceWorking] = useState(false);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState("");
  const [pinWorking, setPinWorking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function",
    );
  }, []);

 
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const buttonLabel = useMemo(() => {
    return mode === "login" ? "Enter" : "Create account";
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.password.trim() || (mode === "register" && !form.name.trim())) {
      setError(mode === "register" ? "Name, email, and password are all required." : "Email and password are both required.");
      return;
    }
    if (mode === "register" && form.name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (form.password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "register" && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      let user;
      if (mode === "login") {
        user = (await loginUser({ email: form.email, password: form.password })).user;
      } else {
        user = (await registerUser({ name: form.name, email: form.email, password: form.password })).user;
      }

      router.replace(user.onboarding_complete ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : "We couldn't complete that request.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFaceLogin() {
    setError(null);

    const email = form.email.trim();
    if (!email) {
      setError("Enter your email address above, then tap Sign in with Face ID.");
      return;
    }

    setFaceWorking(true);
    setFaceCapturing(true);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      
      await new Promise<void>((resolve) => setTimeout(resolve, 800));

      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64Image = dataUrl.replace(/^data:image\/\w+;base64,/, "");

      
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setFaceCapturing(false);

      const { user } = await faceLogin(email, base64Image);
      router.replace(user.onboarding_complete ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
     
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setFaceCapturing(false);

      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No face enrolled")) {
        setError("No Face ID set up for this account. Log in with your password first, then go to Settings to enable Face ID.");
      } else if (msg.includes("No face detected")) {
        setError("No face detected. Please ensure good lighting and try again.");
      } else if (msg.includes("not recognised") || msg.includes("Face not recognised")) {
        setError("Face not recognised. Please try again or use your password.");
      } else if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("notallowed")) {
        setError("Camera access was denied. Please allow camera permission and try again.");
      } else {
        setError("Face ID sign-in failed. Please use your password instead.");
      }
    } finally {
      setFaceWorking(false);
    }
  }

  async function handlePasscodeLogin() {
    setError(null);
    const email = form.email.trim();
    if (!email) {
      setError("Enter your email address above, then tap Sign in with Passcode.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits.");
      return;
    }
    setPinWorking(true);
    try {
      const { user } = await passcodeLogin(email, pin);
      router.replace(user.onboarding_complete ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No passcode set")) {
        setError("No passcode set for this account. Log in with your password first, then go to Settings to enable a passcode.");
      } else if (msg.includes("Incorrect passcode")) {
        setError("Incorrect passcode. Please try again.");
      } else {
        setError("Passcode sign-in failed. Please use your password instead.");
      }
    } finally {
      setPinWorking(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-ink px-5 py-7 text-parchment shadow-panel sm:px-8">
      <div className="mb-6 flex justify-center">
        <BrandMark imageSize={80} subtitle="Welcome back" textSizeClassName="text-2xl" />
      </div>
      <div className="space-y-2 text-center">
        <h2 className="font-serif text-3xl sm:text-4xl">Welcome to TrueNorth</h2>
        <p className="text-base text-gold/85">Your journey begins here</p>
      </div>

      <div className="mt-8 flex rounded-full border border-line/70 bg-white/5 p-1 text-sm">
        <button
          className={`flex-1 rounded-full px-4 py-2 transition ${
            mode === "login" ? "bg-gold text-ink" : "text-mist hover:text-parchment"
          }`}
          onClick={() => setMode("login")}
          type="button"
        >
          Log in
        </button>
        <button
          className={`flex-1 rounded-full px-4 py-2 transition ${
            mode === "register" ? "bg-gold text-ink" : "text-mist hover:text-parchment"
          }`}
          onClick={() => setMode("register")}
          type="button"
        >
          Create account
        </button>
      </div>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-sm uppercase tracking-[0.28em] text-mist">Name</span>
            <input
              autoComplete="name"
              className="w-full rounded-2xl border border-line bg-inkSoft px-4 py-4 text-base text-parchment outline-none transition placeholder:text-mist/45 focus:border-gold"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Your name"
              type="text"
              value={form.name}
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm uppercase tracking-[0.28em] text-mist">Email</span>
          <input
            autoComplete={mode === "login" ? "email" : "username"}
            className="w-full rounded-2xl border border-line bg-inkSoft px-4 py-4 text-base text-parchment outline-none transition placeholder:text-mist/45 focus:border-gold"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="you@example.com"
            type="email"
            value={form.email}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm uppercase tracking-[0.28em] text-mist">Password</span>
          <div className="relative">
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-2xl border border-line bg-inkSoft px-4 py-4 pr-24 text-base text-parchment outline-none transition placeholder:text-mist/45 focus:border-gold"
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="At least 8 characters"
              type={showPassword ? "text" : "password"}
              value={form.password}
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? "Hide" : "View"}
            </button>
          </div>
        </label>

        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-sm uppercase tracking-[0.28em] text-mist">Confirm password</span>
            <div className="relative">
              <input
                autoComplete="new-password"
                className="w-full rounded-2xl border border-line bg-inkSoft px-4 py-4 pr-24 text-base text-parchment outline-none transition placeholder:text-mist/45 focus:border-gold"
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="Re-enter your password"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold"
                onClick={() => setShowConfirmPassword((current) => !current)}
                type="button"
              >
                {showConfirmPassword ? "Hide" : "View"}
              </button>
            </div>
          </label>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <button
          className="w-full rounded-2xl bg-gold px-4 py-4 text-base font-semibold text-ink transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={submitting || faceWorking}
          type="submit"
        >
          {submitting ? "Working..." : buttonLabel}
        </button>
      </form>

    
      {mode === "login" && cameraSupported && (
        <div className="mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-line/40" />
            <span className="text-xs uppercase tracking-[0.2em] text-mist/60">or</span>
            <div className="h-px flex-1 bg-line/40" />
          </div>

       
          <video ref={videoRef} className="hidden" autoPlay muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          <button
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line/50 bg-white/5 px-4 py-3.5 text-sm font-semibold text-parchment transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={faceWorking || submitting}
            onClick={() => void handleFaceLogin()}
            type="button"
          >
         
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <path strokeLinecap="round" d="M9 16.5c.83.97 2.17 1.5 3 1.5s2.17-.53 3-1.5" />
            </svg>
            {faceCapturing ? "Opening camera..." : faceWorking ? "Authenticating..." : "Sign in with Face ID"}
          </button>
          <p className="mt-2 text-center text-xs text-mist/50">
            Enter your email above, then tap to use Face ID.
          </p>
        </div>
      )}

      
      {mode === "login" && (
        <div className="mt-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-line/40" />
            <span className="text-xs uppercase tracking-[0.2em] text-mist/60">or</span>
            <div className="h-px flex-1 bg-line/40" />
          </div>

          <button
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line/50 bg-white/5 px-4 py-3.5 text-sm font-semibold text-parchment transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pinWorking || submitting || faceWorking}
            onClick={() => { setShowPinInput((v) => !v); setPin(""); setError(null); }}
            type="button"
          >
         
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <rect x="3" y="3" width="4" height="4" rx="1" />
              <rect x="10" y="3" width="4" height="4" rx="1" />
              <rect x="17" y="3" width="4" height="4" rx="1" />
              <rect x="3" y="10" width="4" height="4" rx="1" />
              <rect x="10" y="10" width="4" height="4" rx="1" />
              <rect x="17" y="10" width="4" height="4" rx="1" />
              <rect x="3" y="17" width="4" height="4" rx="1" />
              <rect x="10" y="17" width="4" height="4" rx="1" />
              <rect x="17" y="17" width="4" height="4" rx="1" />
            </svg>
            Sign in with Passcode
          </button>

          {showPinInput && (
            <div className="mt-3 space-y-3">
              <input
                autoFocus
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="w-full rounded-2xl border border-line bg-inkSoft px-4 py-4 text-base text-parchment outline-none transition placeholder:text-mist/45 focus:border-gold"
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") void handlePasscodeLogin(); }}
                placeholder="Enter your 6-digit PIN"
                type="text"
                value={pin}
              />
              <button
                className="w-full rounded-2xl bg-gold px-4 py-4 text-base font-semibold text-ink transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={pinWorking}
                onClick={() => void handlePasscodeLogin()}
                type="button"
              >
                {pinWorking ? "Verifying..." : "Continue"}
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-xs text-mist/50">
            Enter your email above, then tap to use your PIN.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-mist">
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          className="font-semibold text-parchment underline decoration-gold/60 underline-offset-4"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          type="button"
        >
          {mode === "login" ? "Create one" : "Log in"}
        </button>
      </p>
    </div>
  );
}