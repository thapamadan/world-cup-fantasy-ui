"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Flame, Target, Trophy } from "lucide-react";

import trophyHero from "@/assets/trophy-hero.jpg";
import {
  fetchMe,
  fetchMyGroups,
  forgotPassword,
  getApiErrorMessage,
  getConfiguredPublicAppOrigin,
  getPreferredApiBase,
  login,
  signup,
} from "@/lib/api";
import { BRAND_SUBTITLE, BRAND_TITLE } from "@/lib/branding";
import { clearActiveGroup, clearSession, setActiveGroup, setSession } from "@/lib/auth";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const configuredPublicAppOrigin = getConfiguredPublicAppOrigin();
  const googleOAuthSupported =
    typeof window !== "undefined"
      ? Boolean(configuredPublicAppOrigin) || isGoogleOAuthSupportedOrigin(window.location)
      : true;

  const completeAuth = async (session: Awaited<ReturnType<typeof login>>) => {
    setSession(session);
    const groupsResponse = await fetchMyGroups();
    if (groupsResponse.groups.length > 0) {
      setActiveGroup(groupsResponse.groups[0]);
      router.push("/dashboard");
      return;
    }

    clearActiveGroup();
    router.push("/groups");
  };

  useEffect(() => {
    let cancelled = false;

    const completeGoogleRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionToken = params.get("session_token");
      const nextPath = params.get("next");
      if (!sessionToken) {
        return false;
      }

      const response = await fetchMe(sessionToken);
      if (cancelled) return true;
      setSession({ token: sessionToken, user: response.user });
      window.history.replaceState({}, "", window.location.pathname);
      router.push(nextPath === "/dashboard" ? "/dashboard" : "/groups");
      return true;
    };

    if (mode === "signin") {
      completeGoogleRedirect()
        .then((handled) => {
          if (handled || cancelled) return;
          return fetchMe().then(async (response) => {
            if (cancelled) return;
            setSession({ token: "cookie-session", user: response.user });
            const groupsResponse = await fetchMyGroups();
            if (cancelled) return;
            if (groupsResponse.groups.length > 0) {
              setActiveGroup(groupsResponse.groups[0]);
              router.push("/dashboard");
              return;
            }
            clearActiveGroup();
            router.push("/groups");
          });
        })
        .catch(() => {
          if (!cancelled) {
            clearSession();
            clearActiveGroup();
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [mode, router]);

  const handleGoogleContinue = () => {
    setError("");
    setSuccess("");

    if (typeof window === "undefined") {
      return;
    }

    const publicAppOrigin = getConfiguredPublicAppOrigin();
    if (!publicAppOrigin && !isGoogleOAuthSupportedOrigin(window.location)) {
      setError(
        "Google sign-in needs localhost, an HTTPS domain, or NEXT_PUBLIC_APP_ORIGIN. Use email/password on this LAN URL.",
      );
      return;
    }

    const baseOrigin = publicAppOrigin || getGoogleBrowserOrigin(window.location);
    const returnTo = `${baseOrigin}/`;
    const query = new URLSearchParams({ return_to: returnTo }).toString();
    const apiBase = getGoogleApiBase(window.location, baseOrigin);
    window.location.assign(`${apiBase}/api/auth/google/start?${query}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "signup" && name.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode !== "signin" && password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "signin") {
        const session = await login({ email, password });
        await completeAuth(session);
      } else if (mode === "forgot") {
        const response = await forgotPassword({ email, new_password: password });
        setSuccess(response.message);
        setPassword("");
        setMode("signin");
      } else if (mode === "signup") {
        const session = await signup({ name, email, password });
        await completeAuth(session);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode: "signin" | "signup" | "forgot") => {
    setError("");
    setSuccess("");
    setMode(nextMode);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero-gradient lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-gradient shadow-gold">
            <Trophy className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-sm font-semibold">{BRAND_TITLE}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">
              {BRAND_SUBTITLE}
            </div>
          </div>
        </div>

        <div className="relative">
          <Image
            src={trophyHero}
            alt="World Cup trophy"
            priority
            className="absolute -right-28 -top-40 w-[640px] opacity-90 mix-blend-screen"
          />
          <div className="relative max-w-md">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur">
              <Flame className="h-3.5 w-3.5 text-gold" /> Season 2026 · Live
            </div>
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-gold">
              {BRAND_SUBTITLE} presents
            </div>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight">
              {BRAND_TITLE}
            </h1>
            <p className="mt-5 text-lg text-gold">Predict every match. Climb the leaderboard.</p>
            <p className="mt-4 text-base text-primary-foreground/70">
              Create private leagues, challenge colleagues, earn points, and compete for the top
              spot throughout the tournament.
            </p>
          </div>
        </div>

        <div className="grid max-w-md grid-cols-3 gap-3">
          {[
            { icon: Target, label: "Exact score", value: "3 pts" },
            { icon: Trophy, label: "Correct outcome", value: "1 pt" },
            { icon: Flame, label: "Draw outcome", value: "1 pt" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
            >
              <s.icon className="mb-2 h-4 w-4 text-gold" />
              <div className="text-lg font-semibold">{s.value}</div>
              <div className="text-xs text-primary-foreground/60">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-screen items-start justify-center bg-background px-6 py-8 sm:py-10 lg:min-h-0 lg:items-center lg:py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-gradient shadow-gold">
              <Trophy className="h-5 w-5 text-primary" strokeWidth={2.5} />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">{BRAND_TITLE}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {BRAND_SUBTITLE}
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin"
              ? "Sign in"
              : mode === "forgot"
                ? "Reset password"
                : "Create account"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to access the World Cup Prediction League."
              : mode === "forgot"
                ? "Enter your email and choose a new password."
                : "Create your account to start predicting."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field
                label="Full name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              label={mode === "forgot" ? "New password" : "Password"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {success && <p className="text-sm text-success">{success}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
            >
              {submitting
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Reset password"
                    : "Create account"}
            </button>

            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleContinue}
                  disabled={submitting || !googleOAuthSupported}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                {!googleOAuthSupported && (
                  <p className="text-xs text-muted-foreground">
                    Google sign-in needs `localhost`, an HTTPS domain, or `NEXT_PUBLIC_APP_ORIGIN`.
                    Use email/password from this device.
                  </p>
                )}
              </>
            )}
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="font-medium text-muted-foreground"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-medium text-foreground"
                >
                  Create account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-medium text-foreground"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeGoogleHost(hostname: string) {
  if (hostname === "127.0.0.1" || hostname === "::1") {
    return "localhost";
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !hostname.endsWith(".sslip.io")) {
    return `${hostname}.sslip.io`;
  }

  return hostname;
}

function getGoogleBrowserOrigin(location: Location) {
  const hostname = normalizeGoogleHost(location.hostname);
  return `${location.protocol}//${hostname}${location.port ? `:${location.port}` : ""}`;
}

function getGoogleApiBase(location: Location, baseOrigin: string) {
  const normalizedHost = normalizeGoogleHost(location.hostname);
  if (normalizedHost === "localhost") {
    return `${location.protocol}//localhost:8000`;
  }

  return baseOrigin === location.origin ? getPreferredApiBase() : baseOrigin;
}

function isGoogleOAuthSupportedOrigin(location: Location) {
  if (location.protocol === "https:") {
    return true;
  }

  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = props.type === "password";

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <div className="relative">
        <input
          {...props}
          type={isPasswordField && showPassword ? "text" : props.type}
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-3.5 pr-11 text-sm outline-none ring-ring/0 transition focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6 6.9 2.6 2.8 6.7 2.8 11.8S6.9 21 12 21c6.9 0 8.6-4.8 8.6-7.3 0-.5-.1-.9-.1-1.2z"
      />
      <path
        fill="#4285F4"
        d="M21.9 12.5c0-.5-.1-.9-.1-1.2H12v3.9h5.4c-.3 1.4-1.1 2.5-2.3 3.3l3.5 2.7c2-1.8 3.3-4.5 3.3-8.7z"
      />
      <path
        fill="#FBBC05"
        d="M6.1 14.3c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.4 8.2C2.7 9.6 2.3 11.1 2.3 12.3s.4 2.8 1.1 4.1z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.5 0 4.7-.8 6.2-2.3l-3.5-2.7c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2l-2.8 2.2C4.1 18.1 7.8 21 12 21z"
      />
      <path
        fill="#4285F4"
        d="M6.2 7.8C7 5.4 9.3 3.6 12 3.6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.7 1 14.5.1 12 .1 7.8.1 4.1 3 2.6 6.9z"
      />
    </svg>
  );
}
