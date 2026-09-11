"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const types = [
  ["placement", "Software Engineering", "Technical, projects and behavioral"],
  ["hr", "HR / Behavioral", "Communication and situational"],
  ["upsc", "UPSC / Govt.", "Formal board-style practice"],
  ["college", "College", "Academic and personal interview"],
  ["mba", "MBA", "Business, case and personal"],
  ["ssb", "SSB", "Board-style interview simulation"],
] as const;

export default function NewInterviewPage() {
  const params = useSearchParams();
  const [type, setType] = useState(params.get("type") || "placement");
  const [difficulty, setDifficulty] = useState("Adaptive");
  const [duration, setDuration] = useState("30 min");
  const [language, setLanguage] = useState("English");
  const [panel, setPanel] = useState("1 interviewer");

  const startHref = `/interview/check?type=${type}&difficulty=${difficulty.toLowerCase()}&duration=${duration.replace(" ", "-")}&language=${language.toLowerCase()}&panel=${encodeURIComponent(panel)}`;

  function saveConfiguration() {
    sessionStorage.setItem("interview-config", JSON.stringify({ type, difficulty, duration, language, panel }));
  }

  const selected = types.find(([id]) => id === type) ?? types[0];

  return <main className="product-shell"><nav className="product-nav container"><Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><Link href="/dashboard" className="text-link">← Dashboard</Link></nav><section className="setup container"><div className="setup-intro"><div className="eyebrow"><span /> Interview setup</div><h1>Configure your interview.</h1><p>The engine will use these choices to build the session. You can change them before every practice interview.</p></div><div className="setup-layout"><div className="setup-main"><div className="setup-section"><label>Interview type</label><div className="choice-grid">{types.map(([id, title, description]) => <button type="button" key={id} className={`choice-card ${type === id ? "selected" : ""}`} onClick={() => setType(id)}><span>{id === type ? "✓" : "○"}</span><strong>{title}</strong><small>{description}</small></button>)}</div></div><div className="setup-section"><label>Difficulty</label><div className="segmented">{["Easy", "Adaptive", "Hard"].map((item) => <button type="button" key={item} className={difficulty === item ? "active" : ""} onClick={() => setDifficulty(item)}>{item}</button>)}</div></div><div className="setup-section"><label>Interview duration</label><div className="segmented">{["15 min", "30 min", "45 min", "60 min"].map((item) => <button type="button" key={item} className={duration === item ? "active" : ""} onClick={() => setDuration(item)}>{item}</button>)}</div></div><div className="setup-section"><label>Interview language</label><div className="segmented">{["English", "Hindi", "Hinglish"].map((item) => <button type="button" key={item} className={language === item ? "active" : ""} onClick={() => setLanguage(item)}>{item}</button>)}</div></div><div className="setup-section"><label>Interview panel</label><div className="segmented">{["1 interviewer", "2 interviewers", "3 interviewers"].map((item) => <button type="button" key={item} className={panel === item ? "active" : ""} onClick={() => setPanel(item)}>{item}</button>)}</div></div></div><aside className="setup-summary"><span className="eyebrow">Session preview</span><h2>{selected[1]}</h2><p>{selected[2]}</p><div className="summary-list"><div><span>Difficulty</span><b>{difficulty}</b></div><div><span>Duration</span><b>{duration}</b></div><div><span>Language</span><b>{language}</b></div><div><span>Panel</span><b>{panel}</b></div></div><div className="summary-note"><strong>AI context</strong><span>Your profile and resume context will be available to the interviewer.</span></div><Link href={startHref} onClick={saveConfiguration} className="button button-primary button-large full-width">Continue to device check <span>→</span></Link></aside></div></section></main>;
}
