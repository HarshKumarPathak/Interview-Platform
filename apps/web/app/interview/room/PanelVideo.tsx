"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

type PanelState = "initializing" | "idle" | "listening" | "thinking" | "speaking";

type Props = {
  track: MediaStreamTrack | null;
  name: string;
  role: string;
  active: boolean;
  accent: string;
  state?: PanelState;
  compact?: boolean;
};

const STATE_LABELS: Record<PanelState, string> = {
  initializing: "Joining",
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export default function PanelVideo({ track, name, role, active, accent, state = "listening", compact = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !track) return;
    const mediaStream = new MediaStream([track]);
    videoRef.current.srcObject = mediaStream;
    void videoRef.current.play().catch(() => undefined);
    return () => {
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [track]);

  const effectiveState = active && state !== "speaking" ? "speaking" : state;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AI";

  return (
    <article
      className={`panel-video ${active ? "is-active" : ""} ${effectiveState === "thinking" ? "is-thinking" : ""} ${compact ? "is-compact" : ""}`}
      style={{ "--panel-accent": accent } as CSSProperties}
    >
      {track ? (
        <video ref={videoRef} className="panel-video-media" playsInline muted aria-label={`${name}, ${role}`} />
      ) : (
        <div className="panel-video-fallback" aria-label={`${name}, ${role} — live interviewer video waiting`}>
          <div className="panel-fallback-stage">
            <div className="panel-fallback-avatar" aria-hidden="true">
              <span>{initials}</span>
            </div>
            <div className="panel-fallback-copy">
              <strong>Interviewer video</strong>
              <span>Live human-style avatar will appear here</span>
            </div>
          </div>
          <div className="panel-fallback-scan" aria-hidden="true" />
        </div>
      )}
      <div className="panel-video-shade" />
      <div className="panel-video-meta">
        <div><strong>{name}</strong><span>{role}</span></div>
        <span className={`panel-state ${effectiveState}`}><i />{STATE_LABELS[effectiveState]}</span>
      </div>
      <span className="panel-ai-badge">AI interviewer</span>
    </article>
  );
}
