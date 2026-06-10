"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";

import { AppNavbar } from "@/components/AppNavbar";
import { changePassword, fetchMe, getApiErrorMessage } from "@/lib/api";
import { clearActiveGroup, clearSession, getSession, setSession } from "@/lib/auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (getSession()) return;

    fetchMe()
      .then((response) => {
        if (!cancelled) {
          setSession({ token: "cookie-session", user: response.user });
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          clearActiveGroup();
          router.push("/");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(response.message);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>

        <section className="overflow-hidden rounded-3xl bg-hero-gradient p-8 text-primary-foreground shadow-elevated">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur"><KeyRound className="h-3.5 w-3.5 text-gold" /> Account security</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Change password</h1>
          <p className="mt-2 text-sm text-primary-foreground/70">Update your password to keep your account secure.</p>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <Field label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            {success && <p className="text-sm text-success">{success}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95">{submitting ? "Saving..." : "Save new password"}</button>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <input {...props} className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-ring/0 transition focus:border-ring focus:ring-2 focus:ring-ring/30" />
    </label>
  );
}
