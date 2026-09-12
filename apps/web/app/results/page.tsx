"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Evaluation = { overall_score: number; knowledge_score: number; communication_score: number; structure_score: number; follow_up_score: number; strengths: string[]; weaknesses: string[]; recommendations: string[] };
type Question = { question_number: number; interviewer_role: string; stage: string; question: string; answer: string; score: number; evidence_score: number; structure_score: number; relevance_score: number; feedback: string; missing_elements: string[]; follow_up_reason: string | null };
type Turn = { sequence_no: number; speaker: string; content: string; role: string | null; created_at: string };
type Interview = { id?: string; type: string; difficulty: string; duration_minutes: number; language: string; panel_size: number; status: string; started_at: string | null; completed_at: string | null; recording_status: string; recording_path: string | null };

type Recording = { recordingStatus: string; path: string | null; playbackUrl: string | null };

function titleize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function scoreLabel(value: number) { return `${Number(value).toFixed(0)}/100`; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : "—"; }

export default function ResultsPage() {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("interviewId");
    if (!id) { setError("No interview report was selected."); return; }
    fetch(`/api/evaluations?interviewId=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Report unavailable");
      const payload = await response.json();
      setEvaluation(payload.evaluation); setQuestions(payload.questions ?? []); setTurns(payload.turns ?? []); setInterview(payload.interview ?? null);
      if (!payload.evaluation) setError(payload.status === "evaluating" ? "Your evaluation is still processing. Refresh in a moment." : "This report is not available yet.");
      if (payload.interview?.recording_egress_id || payload.interview?.recording_path) {
        const recordingResponse = await fetch(`/api/livekit/egress?interviewId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (recordingResponse.ok) setRecording(await recordingResponse.json());
      }
    }).catch(() => setError("This report is not available yet. Complete an interview and try again."));
  }, []);

  const avgQuestionScore = useMemo(() => questions.length ? questions.reduce((sum, item) => sum + Number(item.score), 0) / questions.length : 0, [questions]);
  const candidateTurns = turns.filter((turn) => turn.speaker === "candidate");

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div className="nav-links"><Link href="/history">History</Link><Link href="/profile">Profile</Link></div></nav><section className="container" style={{ paddingTop: 48, paddingBottom: 80 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "end", flexWrap: "wrap" }}><div><div className="eyebrow">Interview report</div><h1 style={{ maxWidth: 760 }}>Performance review based on your interview responses.</h1><p style={{ maxWidth: 720, marginTop: 10 }}>A response-level breakdown designed to show what you did well, where evidence was missing, and what to practice next.</p></div>{interview && <div className="evaluation-card" style={{ minWidth: 250 }}><small>SESSION</small><strong>{titleize(interview.type)} · {titleize(interview.difficulty)}</strong><span>{interview.language} · {interview.panel_size}-person panel · {interview.duration_minutes} min</span></div>}</div>
      {error ? <div className="evaluation-card" style={{ marginTop: 28 }}><strong>{error}</strong><p style={{ marginTop: 8 }}>If the interview just finished, give the evaluation pipeline a few seconds and refresh.</p></div> : evaluation ? <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginTop: 30 }}>{[["Overall", evaluation.overall_score], ["Knowledge", evaluation.knowledge_score], ["Communication", evaluation.communication_score], ["Structure", evaluation.structure_score], ["Follow-up", evaluation.follow_up_score]].map(([label, score]) => <div className="evaluation-card" key={String(label)}><small>{label}</small><strong style={{ fontSize: 32 }}>{scoreLabel(Number(score))}</strong><div style={{ height: 5, background: "var(--border, #ddd)", borderRadius: 99, overflow: "hidden", marginTop: 12 }}><i style={{ display: "block", width: `${Number(score)}%`, height: "100%", background: "currentColor" }} /></div></div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 22 }}><div className="evaluation-card"><h3>What worked</h3>{evaluation.strengths.map((item) => <p key={item}>✓ {item}</p>)}</div><div className="evaluation-card"><h3>Improvement areas</h3>{evaluation.weaknesses.map((item) => <p key={item}>→ {item}</p>)}</div><div className="evaluation-card"><h3>Next practice steps</h3>{evaluation.recommendations.map((item) => <p key={item}>• {item}</p>)}</div></div>
        <div className="evaluation-card" style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}><div><small>SESSION SIGNALS</small><strong>{questions.length} evaluated answer{questions.length === 1 ? "" : "s"} · {candidateTurns.length} candidate turn{candidateTurns.length === 1 ? "" : "s"}</strong><span>Average question score: {avgQuestionScore.toFixed(0)}/100</span></div><div><strong>{interview?.recording_status === "completed" ? "Recording saved" : interview?.recording_status === "disabled" ? "Recording not configured" : titleize(interview?.recording_status ?? "unknown")}</strong>{interview?.recording_path && <span>Stored recording: {interview.recording_path}</span>}</div></div>
        {recording?.playbackUrl && <section className="evaluation-card" style={{ marginTop: 22 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}><div><div className="eyebrow">Interview recording</div><h2 style={{ marginTop: 6 }}>Review your actual interview</h2><p style={{ marginTop: 6 }}>This secure playback link expires automatically and is generated only for your authenticated session.</p></div><a className="button button-ghost" href={recording.playbackUrl} target="_blank" rel="noreferrer">Open video</a></div><video controls preload="metadata" style={{ width: "100%", marginTop: 18, borderRadius: 14, background: "#111", maxHeight: 620 }} src={recording.playbackUrl} /></section>}
        <section style={{ marginTop: 36 }}><div className="eyebrow">Question-by-question analysis</div><h2 style={{ marginTop: 8 }}>How each answer performed</h2><div style={{ display: "grid", gap: 14, marginTop: 18 }}>{questions.length ? questions.map((item) => <article className="evaluation-card" key={item.question_number}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}><div><small>QUESTION {item.question_number} · {titleize(item.stage)} · {titleize(item.interviewer_role)}</small><h3 style={{ margin: "8px 0" }}>{item.question}</h3></div><strong style={{ fontSize: 26 }}>{scoreLabel(Number(item.score))}</strong></div><p><strong>Your answer:</strong> {item.answer}</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, margin: "14px 0" }}>{[["Evidence", item.evidence_score], ["Structure", item.structure_score], ["Relevance", item.relevance_score]].map(([label, score]) => <div key={String(label)}><small>{label}</small><div><strong>{Number(score).toFixed(0)}</strong>/100</div></div>)}</div><p><strong>Feedback:</strong> {item.feedback}</p>{item.missing_elements?.length ? <p><strong>Missing:</strong> {item.missing_elements.join(" · ")}</p> : <p><strong>Evidence check:</strong> No major missing element detected.</p>}{item.follow_up_reason ? <p><small>Follow-up reason: {item.follow_up_reason}</small></p> : null}</article>) : <div className="evaluation-card">No paired question/answer records were found for this session.</div>}</div></section>
        <section style={{ marginTop: 36 }}><button className="button button-ghost" onClick={() => setShowTranscript((value) => !value)}>{showTranscript ? "Hide transcript timeline" : "Show transcript timeline"}</button>{showTranscript && <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{turns.length ? turns.map((turn) => <article className="evaluation-card" key={turn.sequence_no}><small>{turn.speaker === "candidate" ? "CANDIDATE" : "AI INTERVIEWER"} · {formatDate(turn.created_at)}</small><p style={{ marginTop: 8 }}>{turn.content}</p></article>) : <div className="evaluation-card">Transcript is not available for this session.</div>}</div>}</section>
      </> : <div className="evaluation-card" style={{ marginTop: 28 }}>Loading your report…</div>}
      <div className="complete-actions" style={{ marginTop: 28 }}><Link href="/interview/new" className="button button-primary">Take another interview</Link><Link href="/history" className="button button-ghost">View history</Link></div>
    </section></main>;
}
