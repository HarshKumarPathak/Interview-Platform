"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CompletePage() {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing evaluation…");

  useEffect(() => {
    const id = sessionStorage.getItem("active-interview-id");
    setInterviewId(id);
    if (!id) {
      setStatus("Interview completed. Open history to view saved sessions.");
      return;
    }
    fetch("/api/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: id }) })
      .then((response) => setStatus(response.ok ? "Evaluation complete — your report is ready." : "Evaluation is still processing. You can check again from history."))
      .catch(() => setStatus("Evaluation is still processing. You can check again from history."));
  }, []);

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link></nav><section className="complete container"><div className="complete-mark">✓</div><div className="eyebrow">Interview completed</div><h1>Your interview has been evaluated.</h1><p>{status}</p><div className="evaluation-card"><div><strong>Evaluation pipeline</strong><span>Transcript → evidence analysis → scored report</span></div><div className="progress-line"><i /></div><small>Scores are based on observable interview responses, not personality or inferred traits.</small></div><div className="complete-actions">{interviewId && <Link href={`/results?interviewId=${encodeURIComponent(interviewId)}`} className="button button-primary button-large">View interview report</Link>}<Link href="/dashboard" className="button button-ghost button-large">Back to dashboard</Link><Link href="/history" className="button button-ghost button-large">View interview history</Link></div></section></main>;
}
