"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login"
      ? { email: data.get("email"), password: data.get("password") }
      : { displayName: data.get("displayName"), email: data.get("email"), password: data.get("password") };

    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Authentication failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="product-shell">
      <nav className="product-nav container">
        <Link href="/" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link>
        <Link href="/" className="text-link">← Home</Link>
      </nav>
      <section className="setup container" style={{ maxWidth: 860 }}>
        <div className="setup-intro">
          <div className="eyebrow"><span /> Secure candidate access</div>
          <h1>{mode === "login" ? "Welcome back." : "Create your interview workspace."}</h1>
          <p>Your account keeps your profile, interview history and evaluation reports together. Authentication uses a signed HTTP-only session cookie.</p>
        </div>
        <form className="setup-layout" onSubmit={submit}>
          <div className="setup-main">
            {mode === "register" && <div className="setup-section"><label htmlFor="displayName">Full name</label><input className="profile-input" id="displayName" name="displayName" required placeholder="Your name" /></div>}
            <div className="setup-section"><label htmlFor="email">Email</label><input className="profile-input" id="email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" /></div>
            <div className="setup-section"><label htmlFor="password">Password</label><input className="profile-input" id="password" name="password" type="password" minLength={8} required placeholder="At least 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>
          </div>
          <aside className="setup-summary">
            <span className="eyebrow">Account</span>
            <h2>{mode === "login" ? "Continue your progress." : "Start with a real account."}</h2>
            <p>Your profile and resume context can now be attached to authenticated interview sessions.</p>
            {error && <div className="notice">{error}</div>}
            <button type="submit" disabled={loading} className="button button-primary button-large full-width">{loading ? "Working…" : mode === "login" ? "Sign in →" : "Create account →"}</button>
            <button type="button" className="text-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
          </aside>
        </form>
      </section>
    </main>
  );
}
