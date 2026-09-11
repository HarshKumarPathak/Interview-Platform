"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        displayName: data.get("displayName"),
        headline: data.get("headline"),
        college: data.get("college"),
        degree: data.get("degree"),
        graduationYear: data.get("graduationYear"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error ?? "Could not save profile");
    localStorage.setItem("candidate-id", payload.candidate.id);
    localStorage.setItem("candidate-profile", JSON.stringify(payload.candidate));
    setSaved(true);
  }

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><Link href="/dashboard" className="text-link">← Dashboard</Link></nav><section className="setup container"><div className="setup-intro"><div className="eyebrow"><span /> Candidate profile</div><h1>Give the interviewer useful context.</h1><p>This information becomes structured interview context. Keep it factual; the evaluation engine should judge answers, not inferred personal traits.</p></div><form className="setup-layout" onSubmit={save}><div className="setup-main"><div className="setup-section"><label htmlFor="displayName">Full name</label><input className="profile-input" id="displayName" name="displayName" placeholder="Your name" required /></div><div className="setup-section"><label htmlFor="email">Email</label><input className="profile-input" id="email" name="email" type="email" placeholder="you@example.com" required /></div><div className="setup-section"><label htmlFor="headline">Current focus</label><input className="profile-input" id="headline" name="headline" placeholder="CSE student · AI/ML · Software Engineering" /></div><div className="setup-section"><label htmlFor="college">College / university</label><input className="profile-input" id="college" name="college" placeholder="College or university" /></div><div className="setup-section"><label htmlFor="degree">Degree</label><input className="profile-input" id="degree" name="degree" placeholder="B.Tech CSE" /></div><div className="setup-section"><label htmlFor="graduationYear">Graduation year</label><input className="profile-input" id="graduationYear" name="graduationYear" type="number" min="2020" max="2040" placeholder="2027" /></div></div><aside className="setup-summary"><span className="eyebrow">Context preview</span><h2>Ready for adaptive interviews.</h2><p>Your profile can be combined with resume context later without changing the interview contract.</p><div className="summary-note"><strong>Privacy by design</strong><span>Only information explicitly provided by you should enter candidate context. Recording and retention will be separately consented.</span></div>{error && <div className="notice">{error}</div>}{saved && <div className="notice">Profile saved. You can start an interview now.</div>}<button type="submit" className="button button-primary button-large full-width">Save profile <span>→</span></button></aside></form></section></main>;
}
