"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const questions = [
  "Walk me through a project you are most proud of.",
  "What was the hardest technical decision you made in that project?",
  "If you had one more week, what would you improve?",
];

function parseConfig() {
  try { return JSON.parse(sessionStorage.getItem("interview-config") ?? "{}"); } catch { return {}; }
}

export default function InterviewRoomPage() {
  const [question, setQuestion] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [answer, setAnswer] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const config = useMemo(() => (typeof window === "undefined" ? {} : parseConfig()), []);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate-id");
    if (!candidateId) return;
    fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId,
        type: config.type ?? "placement",
        difficulty: (config.difficulty ?? "adaptive").toLowerCase(),
        durationMinutes: Number.parseInt(config.duration ?? "30", 10),
        language: config.language ?? "English",
        panelSize: Number.parseInt(config.panel ?? "1", 10),
      }),
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      setInterviewId(payload.interview.id);
      await fetch("/api/interviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: payload.interview.id, status: "in_progress" }) });
      await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: payload.interview.id, speaker: "interviewer", role: "technical_interviewer", content: questions[0] }) });
    }).catch(() => undefined);
  }, [config]);

  async function submitAnswer() {
    const text = answer.trim();
    if (!text) return;
    if (interviewId) await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "candidate", content: text }) });
    setAnswer("");
    if (question < questions.length - 1) {
      const next = question + 1;
      setQuestion(next);
      if (interviewId) await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "interviewer", role: "technical_interviewer", content: questions[next] }) });
    } else {
      if (interviewId) await fetch("/api/interviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, status: "completed" }) });
      window.location.href = "/interview/complete";
    }
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <main className="room"><header className="room-header"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div><span className="room-live"><i /> LIVE</span><span className="room-time">{time}</span></div><button type="button" className="room-exit" onClick={() => window.location.href = "/dashboard"}>Exit</button></header><section className="room-stage"><div className="interviewer-stage"><div className="avatar-face large"><span className="eye left" /><span className="eye right" /><span className="mouth" /></div><div className="interviewer-name"><strong>Alex Morgan</strong><span>Senior Software Engineer · AI Interviewer</span></div></div><div className="candidate-video"><div className="candidate-placeholder">H</div><span>You</span></div><div className="room-question"><span>INTERVIEWER</span><p>{questions[question]}</p><div className="audio-wave">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17) % 28)}px` }} />)}</div></div></section><footer className="room-controls"><button type="button" className={muted ? "control active" : "control"} onClick={() => setMuted(!muted)}>◉ {muted ? "Unmute" : "Mute"}</button><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer if you prefer text…" /><button type="button" className="button button-primary" onClick={submitAnswer}>{question === questions.length - 1 ? "Finish interview" : "Submit answer →"}</button></footer></main>;
}
