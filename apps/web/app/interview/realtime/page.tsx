"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RealtimeTransport from "../room/RealtimeTransport";

export default function RealtimeInterviewPage() {
  const [interviewId, setInterviewId] = useState<string | null>(null);

  useEffect(() => {
    setInterviewId(sessionStorage.getItem("active-interview-id"));
  }, []);

  return (
    <main className="product-shell" style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/interview/room" className="brand">← Back to interview</Link>
        <section className="setup-card" style={{ marginTop: 32 }}>
          <span className="eyebrow">REALTIME VOICE</span>
          <h1>Live interviewer transport</h1>
          <p>
            This surface uses LiveKit WebRTC for realtime microphone/camera transport and can receive
            the AI interviewer&apos;s streamed audio when the interviewer agent is running.
          </p>
          {interviewId ? (
            <RealtimeTransport interviewId={interviewId} stream={null} muted={false} />
          ) : (
            <p>No active interview is available. Start an interview first.</p>
          )}
        </section>
      </div>
    </main>
  );
}
