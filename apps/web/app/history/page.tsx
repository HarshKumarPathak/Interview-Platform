"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Interview = { id: string; type: string; difficulty: string; duration_minutes: number; language: string; panel_size: number; status: string; created_at: string };

const labels: Record<string, string> = { placement: "Software Engineering", hr: "HR / Behavioral", upsc: "UPSC / Govt.", college: "College", mba: "MBA", ssb: "SSB" };

export default function HistoryPage() {
  const [items, setItems] = useState<Interview[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate-id");
    if (!candidateId) return;
    fetch(`/api/interviews?candidateId=${encodeURIComponent(candidateId)}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Could not load history");
      setItems(payload.interviews ?? []);
    }).catch(() => setError("Could not connect to the backend"));
  }, []);

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div className="product-nav-links"><Link href="/dashboard">Dashboard</Link><Link href="/history">History</Link><Link href="/profile">Profile</Link></div><Link href="/interview/new" className="button button-primary">Start interview →</Link></nav><section className="dashboard container"><div className="dashboard-header"><div><div className="eyebrow"><span /> Interview history</div><h1>Every practice session, in one place.</h1><p>Once a session is persisted, this becomes the foundation for progress tracking and longitudinal evaluation.</p></div></div><section className="panel recent-panel">{error && <div className="notice">{error}</div>}{items.length === 0 && !error ? <div className="summary-note"><strong>No saved interviews yet.</strong><span>Complete a profile and connect the interview room to the persistence API to start building history.</span></div> : items.map((item) => <div className="history-row" key={item.id}><div><strong>{labels[item.type] ?? item.type}</strong><span>{new Date(item.created_at).toLocaleString()} · {item.duration_minutes} min · {item.language}</span></div><span className="status">{item.status}</span><b>—</b></div>)}</section></section></main>;
}
