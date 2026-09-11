"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const questions = [
  "Walk me through a project you are most proud of.",
  "What was the hardest technical decision you made in that project?",
  "If you had one more week, what would you improve?",
];

export default function InterviewRoomPage() {
  const [question, setQuestion] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [answer, setAnswer] = useState("");
  useEffect(() => { const id = window.setInterval(() => setSeconds((s) => s + 1), 1000); return () => window.clearInterval(id); }, []);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <main className="room"><header className="room-header"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div><span className="room-live"><i /> LIVE</span><span className="room-time">{time}</span></div><button type="button" className="room-exit" onClick={() => window.location.href = "/dashboard"}>Exit</button></header><section className="room-stage"><div className="interviewer-stage"><div className="avatar-face large"><span className="eye left" /><span className="eye right" /><span className="mouth" /></div><div className="interviewer-name"><strong>Alex Morgan</strong><span>Senior Software Engineer · AI Interviewer</span></div></div><div className="candidate-video"><div className="candidate-placeholder">H</div><span>You</span></div><div className="room-question"><span>INTERVIEWER</span><p>{questions[question]}</p><div className="audio-wave">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17) % 28)}px` }} />)}</div></div></section><footer className="room-controls"><button type="button" className={muted ? "control active" : "control"} onClick={() => setMuted(!muted)}>◉ {muted ? "Unmute" : "Mute"}</button><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer if you prefer text…" /><button type="button" className="button button-primary" onClick={() => { setAnswer(""); if (question < questions.length - 1) setQuestion(question + 1); else window.location.href = "/interview/complete"; }}>{question === questions.length - 1 ? "Finish interview" : "Submit answer →"}</button></footer></main>;
}
