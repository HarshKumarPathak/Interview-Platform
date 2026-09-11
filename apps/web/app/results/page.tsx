"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Evaluation = { overall_score: number; knowledge_score: number; communication_score: number; structure_score: number; follow_up_score: number; strengths: string[]; weaknesses: string[]; recommendations: string[] };

export default function ResultsPage() {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("interviewId");
    if (!id) { setError("No interview report was selected."); return; }
    fetch(`/api/evaluations?interviewId=${encodeURIComponent(id)}`).then(async (response) => {
      if (!response.ok) throw new Error("Report unavailable");
      const payload = await response.json();
      setEvaluation(payload.evaluation);
    }).catch(() => setError("This report is not available yet. Complete an interview and try again."));
  }, []);

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div className="nav-links"><Link href="/history">History</Link><Link href="/profile">Profile</Link></div></nav><section className="container" style={{ paddingTop: 48, paddingBottom: 80 }}><div className="eyebrow">Interview report</div><h1 style={{ maxWidth: 720 }}>Performance review based on your interview responses.</h1>{error ? <div className="evaluation-card" style={{ marginTop: 28 }}><strong>{error}</strong></div> : evaluation ? <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginTop: 30 }}>{[["Overall", evaluation.overall_score], ["Knowledge", evaluation.knowledge_score], ["Communication", evaluation.communication_score], ["Structure", evaluation.structure_score], ["Follow-up", evaluation.follow_up_score]].map(([label, score]) => <div className="evaluation-card" key={String(label)}><small>{label}</small><strong style={{ fontSize: 32 }}>{Number(score).toFixed(0)}<span style={{ fontSize: 14 }}>/100</span></strong></div>)}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 22 }}><div className="evaluation-card"><h3>Strengths</h3>{evaluation.strengths.map((item) => <p key={item}>✓ {item}</p>)}</div><div className="evaluation-card"><h3>Improvement areas</h3>{evaluation.weaknesses.map((item) => <p key={item}>→ {item}</p>)}</div><div className="evaluation-card"><h3>Next practice steps</h3>{evaluation.recommendations.map((item) => <p key={item}>• {item}</p>)}</div></div></> : <div className="evaluation-card" style={{ marginTop: 28 }}>Loading your report…</div>}<div className="complete-actions" style={{ marginTop: 28 }}><Link href="/interview/new" className="button button-primary">Take another interview</Link><Link href="/history" className="button button-ghost">View history</Link></div></section></main>;
}
