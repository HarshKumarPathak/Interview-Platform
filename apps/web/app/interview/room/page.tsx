"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function parseConfig() {
  try { return JSON.parse(sessionStorage.getItem("interview-config") ?? "{}"); } catch { return {}; }
}

export default function InterviewRoomPage() {
  const [question, setQuestion] = useState("Preparing your interview…");
  const [previousQuestion, setPreviousQuestion] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [answer, setAnswer] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const config = useMemo(() => (typeof window === "undefined" ? {} : parseConfig()), []);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    async function start() {
      try {
        const contextResponse = await fetch("/api/candidates/context");
        if (!contextResponse.ok) throw new Error("candidate context unavailable");
        const candidateContext = await contextResponse.json();
        const candidateId = candidateContext.candidate?.id;
        if (!candidateId) throw new Error("candidate unavailable");

        const response = await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId, type: config.type ?? "placement", difficulty: (config.difficulty ?? "adaptive").toLowerCase(), durationMinutes: Number.parseInt(config.duration ?? "30", 10), language: config.language ?? "English", panelSize: Number.parseInt(config.panel ?? "1", 10) }),
        });
        if (!response.ok) throw new Error("interview creation failed");
        const payload = await response.json();
        setInterviewId(payload.interview.id);
        await fetch("/api/interviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: payload.interview.id, status: "in_progress" }) });

        const resumeContext = candidateContext.resume?.parsed_json?.context;
        const aiResponse = await fetch("http://localhost:8000/v1/interview/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              interview_type: config.type ?? "placement",
              difficulty: (config.difficulty ?? "adaptive").toLowerCase(),
              language: config.language ?? "English",
              candidate: {
                name: candidateContext.candidate.display_name,
                headline: candidateContext.candidate.headline,
                college: candidateContext.candidate.college,
                degree: candidateContext.candidate.degree,
                graduation_year: candidateContext.candidate.graduation_year,
                resume_summary: resumeContext?.summary,
                skills: resumeContext?.skills ?? [],
                projects: (resumeContext?.projects ?? []).map((item: { name?: string }) => item.name ?? "").filter(Boolean),
                experience: (resumeContext?.experience ?? []).map((item: { role?: string; company?: string }) => [item.role, item.company].filter(Boolean).join(" at ")).filter(Boolean),
              },
            },
          }),
        });
        if (!aiResponse.ok) throw new Error("AI engine unavailable");
        const ai = await aiResponse.json();
        setQuestion(ai.question);
        setLoading(false);
        await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: payload.interview.id, speaker: "interviewer", role: ai.role, content: ai.question, metadata: { source: ai.source, rationale: ai.rationale } }) });
      } catch (error) {
        console.error(error);
        setQuestion("Tell me about a project you are most proud of and the impact you had on it.");
        setLoading(false);
      }
    }
    void start();
  }, [config]);

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || !interviewId) return;
    await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "candidate", content: text }) });

    const response = await fetch("http://localhost:8000/v1/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { interview_type: config.type ?? "placement", difficulty: (config.difficulty ?? "adaptive").toLowerCase(), language: config.language ?? "English", candidate: {} }, stage: "follow_up", previous_answer: text, previous_question: question }),
    });
    const ai = response.ok ? await response.json() : { question: "Can you give me one concrete example and explain the trade-off you considered?", role: "technical_interviewer", source: "adaptive_follow_up", rationale: "Fallback follow-up" };
    setPreviousQuestion(question);
    setQuestion(ai.question);
    setAnswer("");
    await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "interviewer", role: ai.role, content: ai.question, metadata: { source: ai.source, rationale: ai.rationale, previous_question: previousQuestion } }) });
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <main className="room"><header className="room-header"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div><span className="room-live"><i /> LIVE</span><span className="room-time">{time}</span></div><button type="button" className="room-exit" onClick={() => window.location.href = "/dashboard"}>Exit</button></header><section className="room-stage"><div className="interviewer-stage"><div className="avatar-face large"><span className="eye left" /><span className="eye right" /><span className="mouth" /></div><div className="interviewer-name"><strong>Alex Morgan</strong><span>Senior Software Engineer · AI Interviewer</span></div></div><div className="candidate-video"><div className="candidate-placeholder">H</div><span>You</span></div><div className="room-question"><span>INTERVIEWER</span><p>{loading ? "Preparing…" : question}</p><div className="audio-wave">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17) % 28)}px` }} />)}</div></div></section><footer className="room-controls"><button type="button" className={muted ? "control active" : "control"} onClick={() => setMuted(!muted)}>◉ {muted ? "Unmute" : "Mute"}</button><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer if you prefer text…" /><button type="button" className="button button-primary" disabled={loading} onClick={submitAnswer}>Submit answer →</button></footer></main>;
}
