"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RealtimeTransport from "./RealtimeTransport";
import PanelVideo from "./PanelVideo";

function parseConfig() { try { return JSON.parse(sessionStorage.getItem("interview-config") ?? "{}"); } catch { return {}; } }
type CandidateContext = { candidate: { id: string; display_name?: string; headline?: string; college?: string; degree?: string; graduation_year?: number }; resume?: { parsed_json?: { context?: { summary?: string; skills?: string[]; projects?: { name?: string }[]; experience?: { role?: string; company?: string }[] } } } | null };
type AIQuestion = { question: string; role?: string; source?: string; rationale?: string; stage?: string; question_index?: number; difficulty?: string; policy_focus?: string[] };
type InterviewTurn = { id: string; sequence_no: number; speaker: "interviewer" | "candidate" | "system"; role?: string | null; content: string; metadata?: Record<string, unknown> | null };
type InterviewerState = "initializing" | "idle" | "listening" | "thinking" | "speaking";
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

const QUESTION_LIMITS: Record<string, number> = { placement: 10, hr: 8, upsc: 10, college: 8, mba: 9, ssb: 8 };
const SPEECH_LANGUAGES: Record<string, string> = { English: "en-IN", Hindi: "hi-IN", Hinglish: "en-IN" };
const PANEL_PRESETS: Record<string, Array<{ name: string; role: string; accent: string }>> = {
  placement: [
    { name: "Amit Sharma", role: "Technical Interviewer", accent: "#5d8cff" },
    { name: "Priya Mehta", role: "HR Interviewer", accent: "#a873ff" },
    { name: "Rohan Verma", role: "Technical Interviewer", accent: "#35c99a" },
  ],
  hr: [
    { name: "Priya Mehta", role: "HR Interviewer", accent: "#a873ff" },
    { name: "Amit Sharma", role: "Hiring Manager", accent: "#5d8cff" },
    { name: "Neha Kapoor", role: "People & Culture", accent: "#35c99a" },
  ],
  upsc: [
    { name: "Anil Rao", role: "Panel Chair", accent: "#5d8cff" },
    { name: "Meera Iyer", role: "Subject Expert", accent: "#a873ff" },
    { name: "Vikram Singh", role: "Panel Member", accent: "#35c99a" },
  ],
  college: [
    { name: "Dr. Meera Iyer", role: "Faculty Interviewer", accent: "#a873ff" },
    { name: "Amit Sharma", role: "Department Panel", accent: "#5d8cff" },
    { name: "Rohan Verma", role: "Project Reviewer", accent: "#35c99a" },
  ],
  mba: [
    { name: "Priya Mehta", role: "Business Interviewer", accent: "#a873ff" },
    { name: "Arjun Malhotra", role: "Strategy Interviewer", accent: "#5d8cff" },
    { name: "Neha Kapoor", role: "Leadership Interviewer", accent: "#35c99a" },
  ],
  ssb: [
    { name: "Vikram Singh", role: "Interviewing Officer", accent: "#5d8cff" },
    { name: "Meera Iyer", role: "Assessing Officer", accent: "#a873ff" },
    { name: "Anil Rao", role: "Panel Member", accent: "#35c99a" },
  ],
};

export default function InterviewRoomPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("Preparing your interview…");
  const [questionMeta, setQuestionMeta] = useState<AIQuestion | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [answer, setAnswer] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [candidate, setCandidate] = useState<CandidateContext | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "unavailable">("connecting");
  const [remoteVideos, setRemoteVideos] = useState<Record<string, MediaStreamTrack>>({});
  const [interviewerStates, setInterviewerStates] = useState<Record<string, InterviewerState>>({});
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [connectionQuality] = useState("Good Connection");
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fallbackStartedRef = useRef(false);
  const lastTurnSequenceRef = useRef(0);
  const speakingTimerRef = useRef<number | null>(null);
  const config = useMemo(() => (typeof window === "undefined" ? {} : parseConfig()), []);
  const interviewType = String(config.type ?? "placement").toLowerCase();
  const durationMinutes = Number.parseInt(config.duration ?? "30", 10);
  const maxAnswers = QUESTION_LIMITS[interviewType] ?? 10;
  const panelSize = Math.min(3, Math.max(1, Number.parseInt(config.panel ?? "3", 10) || 3));
  const panel = (PANEL_PRESETS[interviewType] ?? PANEL_PRESETS.placement).slice(0, panelSize);
  const speechLanguage = SPEECH_LANGUAGES[String(config.language ?? "English")] ?? "en-IN";
  const candidateName = candidate?.candidate?.display_name ?? "Candidate";

  const markInterviewerSpeaking = useCallback((speaking: boolean) => {
    setInterviewerSpeaking(speaking);
    if (speakingTimerRef.current) window.clearTimeout(speakingTimerRef.current);
    if (speaking) speakingTimerRef.current = window.setTimeout(() => setInterviewerSpeaking(false), 3500);
  }, []);

  const speakQuestion = useCallback((text: string) => {
    if (realtimeStatus === "connected" || !voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    markInterviewerSpeaking(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => markInterviewerSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [markInterviewerSpeaking, realtimeStatus, speechLanguage, voiceEnabled]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); recognitionRef.current = null; setListening(false); }, []);
  const startListening = useCallback(() => {
    if (realtimeStatus === "connected" || typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;
    stopListening();
    const recognition = new Recognition();
    recognition.lang = speechLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => { let transcript = ""; for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0]?.transcript ?? ""; setAnswer(transcript.trim()); };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); }
  }, [realtimeStatus, speechLanguage, stopListening]);

  const finishInterview = useCallback(async () => {
    if (!interviewId || ending) return;
    setEnding(true);
    stopListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    await fetch("/api/interviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, status: "completed" }) });
    sessionStorage.setItem("active-interview-id", interviewId);
    router.push("/interview/complete");
  }, [ending, interviewId, router, stopListening]);

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
    let active = true;
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { mediaStream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) { videoRef.current.srcObject = mediaStream; await videoRef.current.play(); }
      } catch { setVideoEnabled(false); }
    }
    void startCamera();
    return () => { active = false; stopListening(); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setStream(null); if (speakingTimerRef.current) window.clearTimeout(speakingTimerRef.current); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [stopListening]);

  useEffect(() => { const id = window.setInterval(() => setSeconds((s) => s + 1), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (interviewId && seconds >= durationMinutes * 60) void finishInterview(); }, [seconds, durationMinutes, interviewId, finishInterview]);
  useEffect(() => { stream?.getVideoTracks().forEach((track) => { track.enabled = videoEnabled; }); }, [stream, videoEnabled]);

  useEffect(() => {
    async function start() {
      try {
        const contextResponse = await fetch("/api/candidates/context");
        if (!contextResponse.ok) throw new Error("candidate context unavailable");
        const candidateContext: CandidateContext = await contextResponse.json();
        setCandidate(candidateContext);
        if (!candidateContext.candidate?.id) throw new Error("candidate unavailable");
        const difficulty = (config.difficulty ?? "adaptive").toLowerCase();
        const language = config.language ?? "English";
        const response = await fetch("/api/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: interviewType, difficulty, durationMinutes, language, panelSize }) });
        if (!response.ok) throw new Error("interview creation failed");
        const payload = await response.json();
        setInterviewId(payload.interview.id);
        const lifecycleResponse = await fetch("/api/interviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: payload.interview.id, status: "in_progress" }) });
        if (!lifecycleResponse.ok) throw new Error("interview start failed");
        setLoading(false);
      } catch (error) {
        console.error(error);
        const fallback = "Tell me about a project you are most proud of and the impact you had on it.";
        setQuestion(fallback); setQuestionMeta({ question: fallback, stage: "intro", question_index: 0, role: "technical_interviewer", source: "fallback" }); setLoading(false);
      }
    }
    void start();
  }, [config, durationMinutes, interviewType, panelSize]);

  useEffect(() => {
    if (!interviewId || realtimeStatus !== "unavailable" || fallbackStartedRef.current) return;
    fallbackStartedRef.current = true;
    async function startFallback() {
      try {
        const difficulty = (config.difficulty ?? "adaptive").toLowerCase(); const language = config.language ?? "English";
        const response = await fetch("/api/ai/question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { interview_type: interviewType, difficulty, language, candidate: { name: candidate?.candidate?.display_name, headline: candidate?.candidate?.headline, college: candidate?.candidate?.college, degree: candidate?.candidate?.degree, graduation_year: candidate?.candidate?.graduation_year, resume_summary: candidate?.resume?.parsed_json?.context?.summary, skills: candidate?.resume?.parsed_json?.context?.skills ?? [], projects: (candidate?.resume?.parsed_json?.context?.projects ?? []).map((item) => item.name ?? "").filter(Boolean), experience: (candidate?.resume?.parsed_json?.context?.experience ?? []).map((item) => [item.role, item.company].filter(Boolean).join(" at ")).filter(Boolean) } }, question_index: 0 }) });
        if (!response.ok) throw new Error("AI engine unavailable");
        const ai: AIQuestion = await response.json();
        setQuestion(ai.question); setQuestionMeta(ai); lastTurnSequenceRef.current = 0; setActivePanelIndex(0); speakQuestion(ai.question);
        await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "interviewer", role: ai.role, content: ai.question, metadata: { source: ai.source, rationale: ai.rationale, stage: ai.stage, question_index: ai.question_index, difficulty: ai.difficulty, policy_focus: ai.policy_focus, panel_index: 0 } }) });
      } catch (error) { console.error(error); const fallback = "Tell me about a project you are most proud of and the impact you had on it."; setQuestion(fallback); setQuestionMeta({ question: fallback, stage: "intro", question_index: 0, role: "technical_interviewer", source: "fallback" }); setActivePanelIndex(0); speakQuestion(fallback); }
    }
    void startFallback();
  }, [candidate, config, interviewId, interviewType, realtimeStatus, speakQuestion]);

  useEffect(() => {
    if (!interviewId) return;
    let active = true;
    const syncTurns = async () => {
      try {
        const response = await fetch(`/api/interviews/turns?interviewId=${encodeURIComponent(interviewId)}`);
        if (!response.ok || !active) return;
        const payload: { turns?: InterviewTurn[] } = await response.json();
        const nextTurns = payload.turns ?? [];
        setTurns(nextTurns.slice(-12));
        const latestInterviewer = [...nextTurns].reverse().find((turn) => turn.speaker === "interviewer");
        if (latestInterviewer && latestInterviewer.sequence_no > lastTurnSequenceRef.current) {
          lastTurnSequenceRef.current = latestInterviewer.sequence_no;
          const metadata = latestInterviewer.metadata ?? {};
          const panelIndex = typeof metadata.panel_index === "number" ? Math.min(panelSize - 1, Math.max(0, metadata.panel_index)) : 0;
          setActivePanelIndex(panelIndex);
          setQuestion(latestInterviewer.content);
          setQuestionMeta({ question: latestInterviewer.content, role: latestInterviewer.role ?? undefined, source: typeof metadata.question_source === "string" ? metadata.question_source : typeof metadata.source === "string" ? metadata.source : "livekit", rationale: typeof metadata.rationale === "string" ? metadata.rationale : undefined, stage: typeof metadata.stage === "string" ? metadata.stage : undefined, question_index: typeof metadata.question_index === "number" ? metadata.question_index : undefined, policy_focus: Array.isArray(metadata.policy_focus) ? metadata.policy_focus.filter((value): value is string => typeof value === "string") : undefined });
          markInterviewerSpeaking(true);
        }
        setAnswerCount(nextTurns.filter((turn) => turn.speaker === "candidate").length);
      } catch (error) { console.warn("Interview transcript sync failed", error); }
    };
    void syncTurns();
    const interval = window.setInterval(() => void syncTurns(), 900);
    return () => { active = false; window.clearInterval(interval); };
  }, [interviewId, markInterviewerSpeaking, panelSize]);

  async function submitAnswer() {
    if (realtimeStatus === "connected") return;
    const text = answer.trim(); if (!text || !interviewId || ending) return;
    stopListening();
    const currentQuestion = question;
    const nextAnswerCount = answerCount + 1;
    setAnswerCount(nextAnswerCount);
    await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "candidate", content: text, metadata: { question_index: questionMeta?.question_index ?? answerCount, stage: questionMeta?.stage, response_to_role: questionMeta?.role, input_mode: speechSupported ? "voice_or_text" : "text" } }) });
    if (nextAnswerCount >= maxAnswers) { await finishInterview(); return; }
    const difficulty = (config.difficulty ?? "adaptive").toLowerCase(); const language = config.language ?? "English"; const nextQuestionIndex = nextAnswerCount;
    const response = await fetch("/api/ai/question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { interview_type: interviewType, difficulty, language, candidate: { name: candidate?.candidate?.display_name, headline: candidate?.candidate?.headline, college: candidate?.candidate?.college, degree: candidate?.candidate?.degree, graduation_year: candidate?.candidate?.graduation_year, resume_summary: candidate?.resume?.parsed_json?.context?.summary, skills: candidate?.resume?.parsed_json?.context?.skills ?? [], projects: (candidate?.resume?.parsed_json?.context?.projects ?? []).map((item) => item.name ?? "").filter(Boolean), experience: (candidate?.resume?.parsed_json?.context?.experience ?? []).map((item) => [item.role, item.company].filter(Boolean).join(" at ")).filter(Boolean) } }, question_index: nextQuestionIndex, previous_answer: text, previous_question: currentQuestion }) });
    const ai: AIQuestion = response.ok ? await response.json() : { question: "Can you give me one concrete example and explain the trade-off you considered?", role: "technical_interviewer", source: "adaptive_follow_up", rationale: "Fallback follow-up", stage: "deep_dive", question_index: nextQuestionIndex };
    setQuestion(ai.question); setQuestionMeta(ai); setAnswer(""); setActivePanelIndex(nextQuestionIndex % panelSize); speakQuestion(ai.question);
    await fetch("/api/interviews/turns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, speaker: "interviewer", role: ai.role, content: ai.question, metadata: { source: ai.source, rationale: ai.rationale, stage: ai.stage, question_index: ai.question_index, difficulty: ai.difficulty, policy_focus: ai.policy_focus, previous_question: currentQuestion, panel_index: nextQuestionIndex % panelSize } }) });
  }

  const onRemoteVideoTrack = useCallback((track: MediaStreamTrack, identity: string) => setRemoteVideos((current) => ({ ...current, [identity]: track })), []);
  const onRemoteVideoTrackRemoved = useCallback((identity: string) => setRemoteVideos((current) => { const next = { ...current }; delete next[identity]; return next; }), []);
  const onActiveSpeaker = useCallback((identity: string | null) => {
    setActiveSpeaker(identity);
    if (identity) {
      const match = identity.match(/interviewer-avatar-(\d+)$/);
      if (match) setActivePanelIndex(Math.max(0, Math.min(panelSize - 1, Number(match[1]) - 1)));
      markInterviewerSpeaking(true);
    }
  }, [markInterviewerSpeaking, panelSize]);
  const onInterviewerState = useCallback((identity: string, state: InterviewerState) => {
    setInterviewerStates((current) => ({ ...current, [identity]: state }));
    const match = identity.match(/interviewer-avatar-(\d+)$/);
    if (match && state === "speaking") {
      setActivePanelIndex(Math.max(0, Math.min(panelSize - 1, Number(match[1]) - 1)));
      markInterviewerSpeaking(true);
    }
  }, [markInterviewerSpeaking, panelSize]);
  const onScreenShareStatus = useCallback((enabled: boolean) => setScreenShareEnabled(enabled), []);

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const typeLabel = interviewType === "upsc" ? "UPSC Interview" : `${interviewType.charAt(0).toUpperCase()}${interviewType.slice(1)} Interview`;
  const modeLabel = panelSize === 1 ? "1-on-1 Interview" : `Technical + HR Panel · ${panelSize} Interviewers`;
  const currentFocus = questionMeta?.stage === "deep_dive" ? "Probing your answer" : questionMeta?.stage === "behavioral" ? "Evaluating behavioral evidence" : "Listening to your response";

  return (
    <main className="room-v2">
      <header className="room-v2-header">
        <Link href="/dashboard" className="room-v2-brand"><span className="room-v2-mark">IP</span><span><strong>Interview Platform</strong><small>Practice · Improve · Get Hired</small></span></Link>
        <div className="room-v2-header-context"><span className="room-v2-pill">💼 {typeLabel}</span><span className="room-v2-panel-icon">👥 {modeLabel}</span></div>
        <div className="room-v2-header-actions"><span className="room-v2-live"><i /> Interview in Progress</span><span className="room-v2-timer">◷ {time}</span><button type="button" className="room-v2-end" disabled={ending} onClick={() => void finishInterview()}>↪ End Interview</button></div>
      </header>

      <div className="room-v2-body">
        <aside className="room-v2-nav"><Link href="/dashboard" className="room-v2-nav-active">◉<span>Interview</span></Link><Link href="/settings">⚙<span>Settings</span></Link><Link href="/help">?<span>Help</span></Link><div className="room-v2-connection">⌁<span>{connectionQuality}</span></div></aside>

        <section className="room-v2-main">
          <div className={`panel-grid panel-grid-${panelSize}`}>
            {panel.map((member, index) => {
              const avatarIdentity = `interviewer-avatar-${index + 1}`;
              const state = interviewerStates[avatarIdentity] ?? (index === activePanelIndex && interviewerSpeaking ? "speaking" : "listening");
              const active = activePanelIndex === index && (interviewerSpeaking || state === "speaking" || state === "thinking");
              return <PanelVideo key={member.name} track={remoteVideos[avatarIdentity] ?? null} name={member.name} role={member.role} accent={member.accent} active={active} state={state} />;
            })}
          </div>

          <article className="candidate-video-card">
            <video ref={videoRef} className="candidate-video" autoPlay muted playsInline aria-label="Your live camera feed" />
            {!videoEnabled && <div className="candidate-video-off">Camera off</div>}
            <div className="candidate-video-shade" />
            <div className="candidate-video-meta"><strong>{candidateName} <span>(You)</span></strong><small>Candidate</small></div><span className="candidate-you-dot"><i /> You</span>
          </article>

          <div className="room-v2-controls">
            <button type="button" onClick={() => setMuted((value) => !value)}><span>{muted ? "🔇" : "🎙"}</span>{muted ? "Unmute" : "Mute"}</button>
            <button type="button" onClick={() => setVideoEnabled((value) => !value)}><span>{videoEnabled ? "▣" : "▧"}</span>{videoEnabled ? "Stop Video" : "Start Video"}</button>
            <button type="button" onClick={() => setScreenShareEnabled((value) => !value)}><span>▣</span>{screenShareEnabled ? "Stop Share" : "Share Screen"}</button>
            <button type="button" onClick={() => setShowTranscript((value) => !value)}><span>▢</span>Chat</button>
            <div className="room-v2-more-wrap"><button type="button" onClick={() => setShowMore((value) => !value)}><span>•••</span>More</button>{showMore && <div className="room-v2-more-menu"><span>Live camera analysis</span><span>Human-style interviewer states</span><span>Adaptive follow-ups</span><span>Interruption handling</span></div>}</div>
            <button type="button" className="room-v2-leave" disabled={ending} onClick={() => void finishInterview()}><span>↪</span><small>Leave</small></button>
          </div>

          {realtimeStatus === "unavailable" && <div className="room-v2-fallback"><strong>Realtime video service is not connected.</strong><span>You can continue with browser voice/text fallback while the interview UI remains the same.</span></div>}
          {realtimeStatus !== "connected" && !loading && <div className="room-v2-answer-box"><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Speak or type your answer…" rows={2} /><div><button type="button" onClick={startListening} disabled={!speechSupported || listening}>{listening ? "Listening…" : "🎙 Speak answer"}</button><button type="button" className="room-v2-submit" onClick={() => void submitAnswer()}>Send answer</button></div></div>}
        </section>

        {showTranscript && <aside className="room-v2-sidebar">
          <section className="room-v2-context-card"><h2>Interview Details</h2><dl><div><dt>Role</dt><dd>{candidate?.candidate?.headline ?? "Software Development Interview"}</dd></div><div><dt>Type</dt><dd>{typeLabel}</dd></div><div><dt>Mode</dt><dd>{modeLabel}</dd></div><div><dt>Duration</dt><dd>~ {durationMinutes} minutes</dd></div></dl></section>
          <section className="room-v2-transcript"><div className="room-v2-sidebar-title"><h2>Live Transcript</h2><span>{turns.length} turns</span></div><div className="room-v2-transcript-list">{turns.slice(-8).map((turn) => <div key={turn.id} className={`room-v2-turn ${turn.speaker}`}><span className="room-v2-turn-icon">{turn.speaker === "candidate" ? "●" : "●"}</span><div><div className="room-v2-turn-head"><strong>{turn.speaker === "candidate" ? `${candidateName} (You)` : (turn.metadata && typeof turn.metadata.interviewer_name === "string" ? turn.metadata.interviewer_name : panel[0]?.name ?? "AI Interviewer")}</strong><small>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div><p>{turn.content}</p></div></div>)}{turns.length === 0 && <div className="room-v2-empty">The live conversation will appear here.</div>}</div></section>
          <section className="room-v2-focus"><div><span>◎</span><h2>Current Focus</h2></div><strong>{currentFocus}</strong><p>{activeSpeaker || interviewerSpeaking ? "The interviewer is speaking…" : "The interviewer is listening…"}</p></section>
        </aside>}
      </div>

      <RealtimeTransport interviewId={interviewId} stream={stream} muted={muted} screenShareEnabled={screenShareEnabled} onStatus={setRealtimeStatus} onScreenShareStatus={onScreenShareStatus} onRemoteVideoTrack={onRemoteVideoTrack} onRemoteVideoTrackRemoved={onRemoteVideoTrackRemoved} onActiveSpeaker={onActiveSpeaker} onInterviewerState={onInterviewerState} />

      <style jsx global>{`
        .room-v2{min-height:100vh;background:#07111d;color:#e8eef7;font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow:hidden}.room-v2 *{box-sizing:border-box}.room-v2 button,.room-v2 a{font:inherit}.room-v2-header{height:76px;display:flex;align-items:center;gap:28px;padding:0 20px;border-bottom:1px solid #203044;background:#081523}.room-v2-brand{display:flex;align-items:center;gap:12px;min-width:270px}.room-v2-brand>span:last-child{display:flex;flex-direction:column}.room-v2-brand strong{font-size:16px}.room-v2-brand small{font-size:10px;color:#718096;margin-top:3px}.room-v2-mark{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:#3478f6;color:#fff;font-weight:800}.room-v2-header-context{display:flex;align-items:center;gap:18px;flex:1}.room-v2-pill{background:#2462d7;border-radius:20px;padding:10px 18px;font-size:13px;font-weight:700}.room-v2-panel-icon{font-size:13px;color:#8999ad}.room-v2-header-actions{display:flex;align-items:center;gap:18px}.room-v2-live{font-size:12px;color:#4be1a1}.room-v2-live i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#36d48e;margin-right:7px;box-shadow:0 0 0 4px rgba(54,212,142,.1)}.room-v2-timer{font-variant-numeric:tabular-nums;color:#a9b6c7;font-size:13px}.room-v2-end{border:0;border-radius:8px;padding:12px 18px;background:#ef3e4b;color:#fff;font-weight:700;cursor:pointer}.room-v2-end:disabled{opacity:.5}.room-v2-body{display:grid;grid-template-columns:86px minmax(0,1fr) 310px;height:calc(100vh - 76px)}.room-v2-nav{border-right:1px solid #203044;background:#091624;display:flex;flex-direction:column;align-items:center;padding:22px 10px;gap:18px}.room-v2-nav a{width:64px;padding:12px 6px;border-radius:10px;color:#78889d;display:flex;flex-direction:column;align-items:center;gap:7px;font-size:19px}.room-v2-nav a span{font-size:10px}.room-v2-nav-active{background:#12243a!important;color:#68a0ff!important}.room-v2-connection{margin-top:auto;width:64px;color:#44dc9d;text-align:center;font-size:18px}.room-v2-connection span{display:block;color:#7e8fa3;font-size:8px;margin-top:5px}.room-v2-main{min-width:0;padding:16px 16px 12px;display:flex;flex-direction:column;gap:12px;overflow:auto}.panel-grid{display:grid;gap:10px}.panel-grid-1{grid-template-columns:1fr}.panel-grid-2{grid-template-columns:1fr 1fr}.panel-grid-3{grid-template-columns:repeat(3,1fr)}.panel-video{position:relative;height:205px;min-height:0;overflow:hidden;border:1px solid #27384d;border-radius:9px;background:#182638;box-shadow:0 10px 30px rgba(0,0,0,.16)}.panel-video.is-active{border:2px solid var(--panel-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--panel-accent) 18%,transparent),0 16px 35px rgba(0,0,0,.2)}.panel-video.is-thinking{border-style:dashed}.panel-video-media,.panel-video-fallback{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.panel-video-fallback{display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#53667b,#243447 52%,#111c28)}.panel-fallback-glow{position:absolute;width:180px;height:180px;border-radius:50%;background:var(--panel-accent);opacity:.11;filter:blur(35px)}.panel-avatar-head{position:relative;width:110px;height:138px;border-radius:48% 48% 44% 44%;background:linear-gradient(145deg,#d2b29c,#886d61);box-shadow:inset -12px -18px 25px rgba(0,0,0,.24);z-index:1}.panel-avatar-hair{position:absolute;left:0;right:0;top:-6px;height:55px;border-radius:55% 55% 35% 35%;background:#241f20}.panel-avatar-eye{position:absolute;top:67px;width:8px;height:5px;border-radius:50%;background:#181819}.panel-avatar-eye.left{left:30px}.panel-avatar-eye.right{right:30px}.panel-avatar-mouth{position:absolute;left:43px;top:95px;width:24px;height:8px;border-bottom:2px solid #4b3730;border-radius:0 0 50% 50%}.panel-video-shade,.candidate-video-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(3,8,14,.86) 100%)}.panel-video-meta{position:absolute;left:10px;right:10px;bottom:9px;display:flex;justify-content:space-between;align-items:end;gap:8px;z-index:2}.panel-video-meta strong,.panel-video-meta span{display:block}.panel-video-meta strong{font-size:12px}.panel-video-meta>div>span{font-size:9px;color:#a9b7c9;margin-top:3px}.panel-state{font-size:9px!important;color:#4be1a1!important;white-space:nowrap}.panel-state i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#35d493;margin-right:5px}.panel-state.speaking{color:#fff!important}.panel-state.speaking i{background:var(--panel-accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--panel-accent) 15%,transparent)}.panel-state.thinking{color:#ffd37a!important}.panel-state.thinking i{background:#ffd37a;animation:panel-thinking 1s ease-in-out infinite}.panel-ai-badge{position:absolute;top:9px;right:9px;background:rgba(3,8,14,.6);padding:4px 7px;border-radius:6px;font-size:8px!important;color:#b7c4d5!important;z-index:2}.candidate-video-card{position:relative;min-height:270px;flex:1;overflow:hidden;border:2px solid #3478f6;border-radius:9px;background:#101c29;box-shadow:0 0 0 3px rgba(52,120,246,.12)}.candidate-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.candidate-video-off{position:absolute;inset:0;display:grid;place-items:center;color:#91a2b7;background:#0c1723;z-index:1}.candidate-video-meta{position:absolute;left:14px;bottom:14px;z-index:3;background:rgba(6,12,20,.72);border-radius:7px;padding:8px 11px}.candidate-video-meta strong{font-size:12px;display:block}.candidate-video-meta strong span{font-weight:500;color:#9fb0c5}.candidate-video-meta small{display:block;font-size:9px;color:#91a0b2;margin-top:2px}.candidate-you-dot{position:absolute;right:12px;bottom:12px;background:rgba(5,13,21,.72);padding:7px 10px;border-radius:7px;font-size:9px;z-index:3}.candidate-you-dot i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#35d493;margin-right:5px}.room-v2-controls{height:72px;border:1px solid #213247;border-radius:38px;background:#0b1827;display:flex;align-items:center;justify-content:center;gap:24px;padding:8px 18px}.room-v2-controls button{border:0;background:transparent;color:#c4d0df;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:9px;min-width:68px}.room-v2-controls button span{font-size:18px}.room-v2-controls button:hover{color:#fff}.room-v2-leave{margin-left:16px!important;width:82px;height:54px;border-radius:28px!important;background:#ef3e4b!important;color:#fff!important}.room-v2-leave span{font-size:20px!important}.room-v2-more-wrap{position:relative}.room-v2-more-menu{position:absolute;bottom:66px;right:0;background:#142235;border:1px solid #2b3d53;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:9px;width:190px;z-index:8;box-shadow:0 15px 40px rgba(0,0,0,.35)}.room-v2-more-menu span{font-size:10px!important;color:#b6c3d3}.room-v2-sidebar{border-left:1px solid #203044;background:#091624;padding:14px;overflow:auto}.room-v2-context-card,.room-v2-transcript,.room-v2-focus{border:1px solid #203044;border-radius:8px;background:#0b1827;margin-bottom:10px}.room-v2-context-card h2,.room-v2-sidebar-title h2,.room-v2-focus h2{font-size:14px;margin:0;padding:14px;border-bottom:1px solid #203044}.room-v2-context-card dl{padding:0 14px 12px;margin:0}.room-v2-context-card dl div{margin-top:13px}.room-v2-context-card dt{font-size:9px;color:#728298}.room-v2-context-card dd{font-size:11px;margin:4px 0 0;color:#d6deea}.room-v2-sidebar-title{display:flex;align-items:center;justify-content:space-between}.room-v2-sidebar-title span{font-size:9px;color:#66788e;padding-right:12px}.room-v2-transcript-list{padding:7px 10px}.room-v2-turn{display:flex;gap:8px;padding:10px 0;border-bottom:1px solid #17283b}.room-v2-turn:last-child{border:0}.room-v2-turn-icon{font-size:12px;color:#49a2ff}.room-v2-turn.candidate .room-v2-turn-icon{color:#3dd49b}.room-v2-turn-head{display:flex;justify-content:space-between;gap:8px}.room-v2-turn-head strong{font-size:9px}.room-v2-turn-head small{font-size:8px;color:#65768a}.room-v2-turn p{font-size:10px;line-height:1.45;color:#aebdcd;margin:4px 0 0}.room-v2-empty{font-size:10px;color:#67788c;padding:16px 5px}.room-v2-focus{padding-bottom:14px}.room-v2-focus>div{display:flex;align-items:center;gap:7px}.room-v2-focus>div span{padding-left:14px;color:#43dc9c}.room-v2-focus h2{border:0;padding:14px 0 0;font-size:12px}.room-v2-focus strong{display:block;padding:0 14px;color:#48e0a1;font-size:11px}.room-v2-focus p{padding:7px 14px 0;margin:0;color:#6e8094;font-size:9px}.room-v2-fallback{background:#261d13;border:1px solid #5c4428;border-radius:8px;padding:10px 13px;display:flex;gap:10px;align-items:center;font-size:10px;color:#d6b887}.room-v2-fallback span{color:#9d8a6b}.room-v2-answer-box{border:1px solid #27394d;border-radius:10px;background:#0d1a2a;padding:10px;display:flex;gap:10px}.room-v2-answer-box textarea{flex:1;resize:none;border:0;outline:0;background:transparent;color:#dce7f4;font:inherit;font-size:12px}.room-v2-answer-box button{border:1px solid #2c4058;background:#15263b;color:#c8d5e4;border-radius:7px;padding:8px 10px;font-size:10px;cursor:pointer}.room-v2-answer-box>div{display:flex;gap:7px;align-items:end}.room-v2-answer-box .room-v2-submit{background:#3478f6;color:#fff;border-color:#3478f6}.room-realtime-status{position:fixed;left:-9999px}.room-v2-brand:hover,.room-v2-nav a:hover{opacity:.88}@keyframes panel-thinking{0%,100%{opacity:.45}50%{opacity:1}}
        @media(max-width:1050px){.room-v2-body{grid-template-columns:70px minmax(0,1fr)}.room-v2-sidebar{display:none}.room-v2-header-context{display:none}.room-v2-header-actions{margin-left:auto}.panel-video{height:175px}}
        @media(max-width:700px){.room-v2-header{height:auto;min-height:68px;padding:10px;gap:10px}.room-v2-brand{min-width:0}.room-v2-brand small{display:none}.room-v2-header-actions{gap:7px}.room-v2-live{display:none}.room-v2-end{padding:9px 10px;font-size:10px}.room-v2-body{grid-template-columns:1fr;height:auto;min-height:calc(100vh - 68px)}.room-v2-nav{display:none}.room-v2-main{padding:10px}.panel-grid-3{grid-template-columns:1fr 1fr}.panel-grid-3 .panel-video:last-child{grid-column:1 / -1}.panel-video{height:145px}.candidate-video-card{min-height:230px}.room-v2-controls{gap:4px;padding:5px}.room-v2-controls button{min-width:55px;font-size:8px}.room-v2-controls button span{font-size:15px}.room-v2-leave{width:62px!important;margin-left:0!important}.room-v2-answer-box{flex-direction:column}.room-v2-answer-box>div{justify-content:flex-end}}
      `}</style>
    </main>
  );
}
