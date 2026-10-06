"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Resume = { id: string; file_name: string; parsed_json: { status?: string; source?: string } | null; created_at: string };

export default function ResumePage() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/resumes").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      setResume(data.resumes?.[0] ?? null);
    });
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const input = event.currentTarget.elements.namedItem("resume") as HTMLInputElement;
    if (!input.files?.[0]) return setError("Choose a PDF or TXT resume first.");
    const form = new FormData();
    form.set("file", input.files[0]);
    const response = await fetch("/api/resumes", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Upload failed");
    setResume(data.resume);
    setMessage(data.parserStatus === "ready" ? "Resume uploaded and text extracted." : "Resume uploaded. PDF parsing is queued for the AI worker layer.");
  }

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><Link href="/dashboard" className="text-link">← Dashboard</Link></nav><section className="setup container"><div className="setup-intro"><div className="eyebrow"><span /> Resume context</div><h1>Give your interviewer your real background.</h1><p>Your resume becomes structured context for future adaptive questions. The platform should ask about evidence in your resume—not invent facts about you.</p></div><form className="setup-layout" onSubmit={upload}><div className="setup-main"><div className="setup-section"><label htmlFor="resume">Resume file</label><input className="profile-input" id="resume" name="resume" type="file" accept="application/pdf,text/plain" required /></div><div className="summary-note"><strong>Current limits</strong><span>PDF or TXT · maximum 5 MB. TXT extraction is available now; PDF parsing is deliberately separated into the worker layer.</span></div></div><aside className="setup-summary"><span className="eyebrow">Latest resume</span><h2>{resume?.file_name ?? "No resume yet"}</h2><p>{resume ? `Status: ${resume.parsed_json?.status ?? "stored"}` : "Upload once and reuse the context across interviews."}</p>{error && <div className="notice">{error}</div>}{message && <div className="notice">{message}</div>}<button type="submit" className="button button-primary button-large full-width">Upload resume <span>↑</span></button></aside></form></section></main>;
}
