"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

type Props = {
  track: MediaStreamTrack | null;
  name: string;
  role: string;
  active: boolean;
  accent: string;
  compact?: boolean;
};

export default function PanelVideo({ track, name, role, active, accent, compact = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !track) return;
    const mediaStream = new MediaStream([track]);
    videoRef.current.srcObject = mediaStream;
    void videoRef.current.play().catch(() => undefined);
    return () => { videoRef.current?.pause(); if (videoRef.current) videoRef.current.srcObject = null; };
  }, [track]);

  return (
    <article className={`panel-video ${active ? "is-active" : ""} ${compact ? "is-compact" : ""}`} style={{ "--panel-accent": accent } as CSSProperties}>
      {track ? (
        <video ref={videoRef} className="panel-video-media" playsInline muted aria-label={`${name}, ${role}`} />
      ) : (
        <div className="panel-video-fallback" aria-label={`${name}, ${role}`}>
          <div className="panel-avatar-head"><span className="panel-avatar-hair" /><span className="panel-avatar-eye left" /><span className="panel-avatar-eye right" /><span className="panel-avatar-mouth" /></div>
          <div className="panel-fallback-glow" />
        </div>
      )}
      <div className="panel-video-shade" />
      <div className="panel-video-meta">
        <div><strong>{name}</strong><span>{role}</span></div>
        <span className={`panel-state ${active ? "speaking" : "listening"}`}><i />{active ? "Speaking" : "Listening"}</span>
      </div>
      <span className="panel-ai-badge">AI interviewer</span>
    </article>
  );
}
