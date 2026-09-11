"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function parseConfig() {
  try {
    return JSON.parse(sessionStorage.getItem("interview-config") ?? "{}");
  } catch {
    return {};
  }
}

type CandidateContext = {
  candidate: {
    id: string;
    display_name?: string;
    headline?: string;
    college?: string;
    degree?: string;
    graduation_year?: number;
  };
  resume?: {
    parsed_json?: {
      context?: {
        summary?: string;
        skills?: string[];
        projects?: { name?: string }[];
        experience?: { role?: string; company?: string }[];
      };
    };
  } | null;
};

type AIQuestion = {
  question: string;
  role?: string;
  source?: string;
  rationale?: string;
  stage?: string;
  question_index?: number;
  difficulty?: string;
  policy_focus?: string[];
};

export default function InterviewRoomPage() {
  const [question, setQuestion] = useState("Preparing your interview…");
  const [questionMeta, setQuestionMeta] = useState<AIQuestion | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [answer, setAnswer] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [candidate, setCandidate] = useState<CandidateContext | null>(null);
  const [answerCount, setAnswerCount] = useState(0);

  const config = useMemo(() => (typeof window === "undefined" ? {} : parseConfig()), []);
  const durationMinutes = Number.parseInt(config.duration ?? "30", 10);
  const maxAnswers = 8;

  const finishInterview = useCallback(async () => {
    if (!interviewId || ending) return;
    setEnding(true);
    await fetch("/api/interviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId, status: "completed" }),
    });
    sessionStorage.setItem("active-interview-id", interviewId);
    window.location.href = "/interview/complete";
  }, [ending, interviewId]);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (interviewId && seconds >= durationMinutes * 60) void finishInterview();
  }, [seconds, durationMinutes, interviewId, finishInterview]);

  useEffect(() => {
    async function start() {
      try {
        const contextResponse = await fetch("/api/candidates/context");
        if (!contextResponse.ok) throw new Error("candidate context unavailable");
        const candidateContext: CandidateContext = await contextResponse.json();
        setCandidate(candidateContext);
        if (!candidateContext.candidate?.id) throw new Error("candidate unavailable");

        const interviewType = config.type ?? "placement";
        const difficulty = (config.difficulty ?? "adaptive").toLowerCase();
        const language = config.language ?? "English";
        const panelSize = Number.parseInt(config.panel ?? "1", 10);

        const response = await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: interviewType, difficulty, durationMinutes, language, panelSize }),
        });
        if (!response.ok) throw new Error("interview creation failed");
        const payload = await response.json();
        setInterviewId(payload.interview.id);

        await fetch("/api/interviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId: payload.interview.id, status: "in_progress" }),
        });

        const resumeContext = candidateContext.resume?.parsed_json?.context;
        const aiResponse = await fetch("/api/ai/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              interview_type: interviewType,
              difficulty,
              language,
              candidate: {
                name: candidateContext.candidate.display_name,
                headline: candidateContext.candidate.headline,
                college: candidateContext.candidate.college,
                degree: candidateContext.candidate.degree,
                graduation_year: candidateContext.candidate.graduation_year,
                resume_summary: resumeContext?.summary,
                skills: resumeContext?.skills ?? [],
                projects: (resumeContext?.projects ?? []).map((item) => item.name ?? "").filter(Boolean),
                experience: (resumeContext?.experience ?? [])
                  .map((item) => [item.role, item.company].filter(Boolean).join(" at "))
                  .filter(Boolean),
              },
            },
            question_index: 0,
          }),
        });
        if (!aiResponse.ok) throw new Error("AI engine unavailable");
        const ai: AIQuestion = await aiResponse.json();
        setQuestion(ai.question);
        setQuestionMeta(ai);
        setLoading(false);

        await fetch("/api/interviews/turns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewId: payload.interview.id,
            speaker: "interviewer",
            role: ai.role,
            content: ai.question,
            metadata: {
              source: ai.source,
              rationale: ai.rationale,
              stage: ai.stage,
              question_index: ai.question_index,
              difficulty: ai.difficulty,
              policy_focus: ai.policy_focus,
            },
          }),
        });
      } catch (error) {
        console.error(error);
        setQuestion("Tell me about a project you are most proud of and the impact you had on it.");
        setQuestionMeta({ stage: "intro", question_index: 0, role: "technical_interviewer", source: "fallback" });
        setLoading(false);
      }
    }
    void start();
  }, [config, durationMinutes]);

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || !interviewId || ending) return;

    const currentQuestion = question;
    const nextAnswerCount = answerCount + 1;
    setAnswerCount(nextAnswerCount);

    await fetch("/api/interviews/turns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interviewId,
        speaker: "candidate",
        content: text,
        metadata: {
          question_index: questionMeta?.question_index ?? answerCount,
          stage: questionMeta?.stage,
          response_to_role: questionMeta?.role,
        },
      }),
    });

    if (nextAnswerCount >= maxAnswers) {
      await finishInterview();
      return;
    }

    const interviewType = config.type ?? "placement";
    const difficulty = (config.difficulty ?? "adaptive").toLowerCase();
    const language = config.language ?? "English";
    const nextQuestionIndex = nextAnswerCount;

    const response = await fetch("/api/ai/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          interview_type: interviewType,
          difficulty,
          language,
          candidate: {
            name: candidate?.candidate?.display_name,
            headline: candidate?.candidate?.headline,
            college: candidate?.candidate?.college,
            degree: candidate?.candidate?.degree,
            graduation_year: candidate?.candidate?.graduation_year,
            resume_summary: candidate?.resume?.parsed_json?.context?.summary,
            skills: candidate?.resume?.parsed_json?.context?.skills ?? [],
            projects: (candidate?.resume?.parsed_json?.context?.projects ?? [])
              .map((item) => item.name ?? "")
              .filter(Boolean),
            experience: (candidate?.resume?.parsed_json?.context?.experience ?? [])
              .map((item) => [item.role, item.company].filter(Boolean).join(" at "))
              .filter(Boolean),
          },
        },
        question_index: nextQuestionIndex,
        previous_answer: text,
        previous_question: currentQuestion,
      }),
    });

    const ai: AIQuestion = response.ok
      ? await response.json()
      : {
          question: "Can you give me one concrete example and explain the trade-off you considered?",
          role: "technical_interviewer",
          source: "adaptive_follow_up",
          rationale: "Fallback follow-up",
          stage: "deep_dive",
          question_index: nextQuestionIndex,
        };

    setQuestion(ai.question);
    setQuestionMeta(ai);
    setAnswer("");

    await fetch("/api/interviews/turns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interviewId,
        speaker: "interviewer",
        role: ai.role,
        content: ai.question,
        metadata: {
          source: ai.source,
          rationale: ai.rationale,
          stage: ai.stage,
          question_index: ai.question_index,
          difficulty: ai.difficulty,
          policy_focus: ai.policy_focus,
          previous_question: currentQuestion,
        },
      }),
    });
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const remaining = Math.max(0, durationMinutes * 60 - seconds);
  const remainingLabel = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const interviewerName = config.panel === "3" ? "AI Interview Panel" : config.panel === "2" ? "Alex Morgan + AI Panel" : "Alex Morgan";

  return (
    <main className="room">
      <header className="room-header">
        <Link href="/dashboard" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link>
        <div><span className="room-live"><i /> LIVE</span><span className="room-time">{time}</span></div>
        <button type="button" className="room-exit" disabled={ending} onClick={() => void finishInterview()}>End interview</button>
      </header>

      <section className="room-stage">
        <div className="interviewer-stage">
          <div className="avatar-face large"><span className="eye left" /><span className="eye right" /><span className="mouth" /></div>
          <div className="interviewer-name"><strong>{interviewerName}</strong><span>{config.type === "hr" ? "HR Interviewer · AI Panel" : `${questionMeta?.role?.replaceAll("_", " ") ?? "Senior Software Engineer"} · AI Interviewer`}</span></div>
        </div>
        <div className="candidate-video"><div className="candidate-placeholder">{candidate?.candidate?.display_name?.[0]?.toUpperCase() ?? "Y"}</div><span>You · camera check completed</span></div>
        <div className="room-question">
          <span>INTERVIEWER · {answerCount + 1}{questionMeta?.stage ? ` · ${questionMeta.stage.replaceAll("_", " ")}` : ""}</span>
          <p>{loading ? "Preparing…" : question}</p>
          <div className="audio-wave">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17) % 28)}px` }} />)}</div>
        </div>
      </section>

      <footer className="room-controls">
        <button type="button" className={muted ? "control active" : "control"} onClick={() => setMuted(!muted)}>◉ {muted ? "Unmute" : "Mute"}</button>
        <span className="room-remaining">{remainingLabel} remaining</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer if you prefer text…" disabled={ending} />
        <button type="button" className="button button-primary" disabled={loading || !answer.trim() || ending} onClick={() => void submitAnswer()}>{ending ? "Finishing…" : "Submit answer →"}</button>
      </footer>
    </main>
  );
}
