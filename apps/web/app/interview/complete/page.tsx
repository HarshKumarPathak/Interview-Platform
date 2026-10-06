"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CompletePage() {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing evaluation…");
  const [recordingStatus, setRecordingStatus] = useState("checking");

  useEffect(() => {
    const id = sessionStorage.getItem("active-interview-id");
    setInterviewId(id);
    if (!id) { setStatus("Interview completed. Open history to view saved sessions."); return; }

    let active = true;
    const evaluate = async () => {
      try {
        const response = await fetch("/api/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: id }) });
        if (active) setStatus(response.ok ? "Evaluation complete — your report is ready." : "Evaluation is still processing. You can check again from history.");
      } catch { if (active) setStatus("Evaluation is still processing. You can check again from history."); }
    };
    const pollRecording = async () => {
      try {
        const response = await fetch(`/api/livekit/egress?interviewId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok || !active) return;
        const payload = await response.json();
        if (active) setRecordingStatus(String(payload.recordingStatus ?? "unknown"));
      } catch { if (active) setRecordingStatus("unknown"); }
    };
    void evaluate(); void pollRecording();
    const interval = window.setInterval(() => void pollRecording(), 2500);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const recordingLabel = recordingStatus === "completed" ? "Recording saved" : recordingStatus === "recording" || recordingStatus === "stopping" ? "Finalizing recording…" : recordingStatus === "disabled" ? "Recording not configured" : recordingStatus === "failed" ? "Recording unavailable" : "Checking recording…";

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link></nav><section className="complete container"><div className="complete-mark">✓</div><div className="eyebrow">Interview completed</div><h1>Your interview is complete.</h1><p>{status}</p><div className="evaluation-card"><div><strong>Evaluation pipeline</strong><span>Transcript → evidence analysis → scored report</span></div><div className="progress-line"><i /></div><small>Scores are based on observable interview responses, not personality or inferred traits.</small></div><div className="evaluation-card"><div><strong>Interview recording</strong><span>{recordingLabel}</span></div><small>The recording lifecycle is tracked separately from evaluation so a storage delay does not block your report.</small></div><div className="complete-actions">{interviewId && <Link href={`/results?interviewId=${encodeURIComponent(interviewId)}`} className="button button-primary button-large">View interview report</Link>}<Link href="/dashboard" className="button button-ghost button-large">Back to dashboard</Link><Link href="/history" className="button button-ghost button-large">View interview history</Link></div></section></main>;
}
