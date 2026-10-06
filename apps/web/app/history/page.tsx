"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Interview = { id: string; type: string; difficulty: string; duration_minutes: number; language: string; panel_size: number; status: string; created_at: string };
type Report = { overall_score: number | null; knowledge_score: number | null; communication_score: number | null; structure_score: number | null; follow_up_score: number | null };

const labels: Record<string, string> = { placement: "Software Engineering", hr: "HR / Behavioral", upsc: "UPSC / Govt.", college: "College", mba: "MBA", ssb: "SSB" };
const dimensions = ["knowledge_score", "communication_score", "structure_score", "follow_up_score"] as const;
const dimensionLabels: Record<(typeof dimensions)[number], string> = { knowledge_score: "Knowledge", communication_score: "Communication", structure_score: "Structure", follow_up_score: "Follow-up" };

export default function HistoryPage() {
  const [items, setItems] = useState<Interview[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/interviews").then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load history");
      const interviews: Interview[] = payload.interviews ?? [];
      setItems(interviews);
      const evaluated = interviews.filter((item) => item.status === "evaluated");
      const results = await Promise.all(evaluated.map(async (item) => {
        const result = await fetch(`/api/evaluations?interviewId=${encodeURIComponent(item.id)}`);
        if (!result.ok) return [item.id, null] as const;
        const data = await result.json();
        return [item.id, data.evaluation as Report | null] as const;
      }));
      setReports(Object.fromEntries(results.filter(([, value]) => value)) as Record<string, Report>);
    }).catch((err) => setError(err instanceof Error ? err.message : "Could not connect to the backend"));
  }, []);

  const evaluated = useMemo(() => items.map((item) => reports[item.id]?.overall_score).filter((value): value is number => typeof value === "number"), [items, reports]);
  const average = evaluated.length ? evaluated.reduce((sum, value) => sum + value, 0) / evaluated.length : null;
  const latest = evaluated[0] ?? null;
  const previous = evaluated[1] ?? null;
  const change = latest != null && previous != null ? latest - previous : null;
  const dimensionAverages = dimensions.map((key) => {
    const values = Object.values(reports).map((report) => report[key]).filter((value): value is number => typeof value === "number");
    return [key, values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null] as const;
  });

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div className="product-nav-links"><Link href="/dashboard">Dashboard</Link><Link href="/history">History</Link><Link href="/profile">Profile</Link></div><Link href="/interview/new" className="button button-primary">Start interview →</Link></nav><section className="dashboard container"><div className="dashboard-header"><div><div className="eyebrow"><span /> Interview history</div><h1>Your practice trajectory.</h1><p>Track evaluated attempts, compare recent performance, and identify the skills that deserve your next practice session.</p></div></div>{error && <div className="notice">{error}</div>}<div className="stat-grid" style={{ marginBottom: 22 }}><article><span>Evaluated interviews</span><strong>{evaluated.length}</strong><small>Scored sessions</small></article><article><span>Average score</span><strong>{average == null ? "—" : `${Math.round(average)}%`}</strong><small>Across evaluated sessions</small></article><article><span>Latest change</span><strong>{change == null ? "—" : `${change >= 0 ? "+" : ""}${Math.round(change)}`}</strong><small>{change == null ? "Complete 2 sessions to compare" : "vs previous evaluated interview"}</small></article><article><span>Next focus</span><strong>{dimensionAverages.filter(([, value]) => value != null).sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] ? dimensionLabels[dimensionAverages.filter(([, value]) => value != null).sort((a, b) => Number(a[1]) - Number(b[1]))[0][0] as (typeof dimensions)[number]] : "Build baseline"}</strong><small>Lowest average dimension</small></article></div><section className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">Progress</span><h2>Performance by skill</h2></div></div><div className="focus-list">{dimensionAverages.map(([key, value]) => <div key={key}><span>{dimensionLabels[key]}</span><b>{value == null ? "—" : `${Math.round(value)}/100`}</b></div>)}</div><div className="summary-note" style={{ marginTop: 18 }}><strong>{latest != null && previous != null ? `You ${change! >= 0 ? "improved" : "dropped"} ${Math.abs(Math.round(change!))} points on your latest attempt.` : "Complete more evaluated interviews to unlock trend comparisons."}</strong><span>{latest != null && previous != null ? `Latest score ${Math.round(latest)} vs previous score ${Math.round(previous)}.` : "Your report history will become more useful as more sessions are completed."}</span></div></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">Attempt trend</span><h2>Recent scores</h2></div></div>{evaluated.length ? <div style={{ display: "grid", gap: 12 }}>{evaluated.slice(0, 6).map((value, index) => <div key={`${value}-${index}`}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><small>Attempt {index + 1}</small><strong>{Math.round(value)}/100</strong></div><div style={{ height: 9, borderRadius: 99, background: "var(--surface-muted, #eee)", overflow: "hidden" }}><div style={{ width: `${Math.max(3, Math.min(100, value))}%`, height: "100%", background: "currentColor", opacity: .8 }} /></div></div>)}</div> : <div className="summary-note"><strong>No score trend yet.</strong><span>Finish an interview and open its report to start tracking improvement.</span></div>}</section></section><section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Sessions</span><h2>All interviews</h2></div></div>{items.length === 0 && !error ? <div className="summary-note"><strong>No saved interviews yet.</strong><span>Complete an interview to start building your history.</span></div> : items.map((item) => { const report = reports[item.id]; return <Link href={report ? `/results?interviewId=${item.id}` : "/interview/new"} className="history-row" key={item.id}><div><strong>{labels[item.type] ?? item.type}</strong><span>{new Date(item.created_at).toLocaleString()} · {item.duration_minutes} min · {item.language} · panel {item.panel_size}</span></div><span className={`status ${item.status === "evaluated" ? "status-done" : ""}`}>{item.status.replaceAll("_", " ")}</span><b>{report?.overall_score == null ? "—" : Math.round(report.overall_score)}</b></Link>; })}</section></section></main>;
}
