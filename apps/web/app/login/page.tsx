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
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: data.get("displayName"),
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.error ?? "Authentication failed");
    if (payload.candidate) localStorage.setItem("candidate-profile", JSON.stringify(payload.candidate));
    if (payload.candidate?.id) localStorage.setItem("candidate-id", payload.candidate.id);
    router.push(payload.candidate?.display_name ? "/dashboard" : "/profile");
  }

  return (
    <main className="product-shell">
      <nav className="product-nav container">
        <Link href="/" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link>
      </nav>
      <section className="setup container" style={{ maxWidth: 860 }}>
        <div className="setup-intro">
          <div className="eyebrow"><span /> Secure candidate access</div>
          <h1>{mode === "login" ? "Welcome back." : "Create your interview workspace."}</h1>
          <p>Your account keeps your profile, interview history and future evaluation reports together. Passwords are hashed server-side and the session uses an HTTP-only cookie.</p>
        </div>
        <form className="setup-layout" onSubmit={submit}>
          <div className="setup-main">
            {mode === "register" && <div className="setup-section"><label htmlFor="displayName">Full name</label><input className="profile-input" id="displayName" name="displayName" required placeholder="Your name" /></div>}
            <div className="setup-section"><label htmlFor="email">Email</label><input className="profile-input" id="email" name="email" type="email" required placeholder="you@example.com" /></div>
            <div className="setup-section"><label htmlFor="password">Password</label><input className="profile-input" id="password" name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></div>
          </div>
          <aside className="setup-summary">
            <span className="eyebrow">Account</span>
            <h2>{mode === "login" ? "Continue your progress." : "Start with a real account."}</h2>
            <p>No raw passwords are stored. Candidate context remains separate from authentication credentials.</p>
            {error && <div className="notice">{error}</div>}
            <button type="submit" disabled={loading} className="button button-primary button-large full-width">{loading ? "Working…" : mode === "login" ? "Sign in →" : "Create account →"}</button>
            <button type="button" className="text-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
          </aside>
        </form>
      </section>
    </main>
  );
}
