"use client";

import { useEffect, useRef, useState } from "react";

type LiveKitRoom = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  localParticipant: {
    setCameraEnabled: (enabled: boolean) => Promise<void>;
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  };
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback: (...args: any[]) => void) => void;
};

type LiveKitClient = {
  Room: new (options?: Record<string, unknown>) => LiveKitRoom;
  RoomEvent: { TrackSubscribed: string; Disconnected: string };
  Track: { Kind: { Audio: string } };
};

declare global {
  interface Window { LivekitClient?: LiveKitClient }
}

function loadLiveKitClient() {
  return new Promise<LiveKitClient>((resolve, reject) => {
    if (window.LivekitClient) return resolve(window.LivekitClient);
    const existing = document.querySelector<HTMLScriptElement>("script[data-livekit-client]");
    if (existing) {
      existing.addEventListener("load", () => window.LivekitClient ? resolve(window.LivekitClient) : reject(new Error("LiveKit client unavailable")), { once: true });
      existing.addEventListener("error", () => reject(new Error("LiveKit client failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/dist/livekit-client.umd.min.js";
    script.async = true;
    script.dataset.livekitClient = "true";
    script.onload = () => window.LivekitClient ? resolve(window.LivekitClient) : reject(new Error("LiveKit client unavailable"));
    script.onerror = () => reject(new Error("LiveKit client failed to load"));
    document.head.appendChild(script);
  });
}

export default function RealtimeTransport({ interviewId }: { interviewId: string | null }) {
  const roomRef = useRef<LiveKitRoom | null>(null);
  const [status, setStatus] = useState("Realtime voice: connecting…");

  useEffect(() => {
    if (!interviewId) return;
    let active = true;
    let client: LiveKitClient | null = null;

    async function connect() {
      try {
        const tokenResponse = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId }),
        });
        if (!tokenResponse.ok) throw new Error("Realtime voice is not configured");
        const { token, serverUrl } = await tokenResponse.json();
        client = await loadLiveKitClient();
        if (!active) return;

        const room = new client.Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        const onTrackSubscribed = (track: { kind?: string; attach?: () => HTMLMediaElement }) => {
          if (track.kind !== client?.Track.Kind.Audio || !track.attach) return;
          const element = track.attach();
          element.autoplay = true;
          element.setAttribute("aria-label", "AI interviewer audio");
          document.body.appendChild(element);
        };
        room.on(client.RoomEvent.TrackSubscribed, onTrackSubscribed);
        await room.connect(serverUrl, token);
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (active) setStatus("Realtime voice: connected");
      } catch (error) {
        console.warn("LiveKit realtime transport unavailable", error);
        if (active) setStatus("Realtime voice: unavailable · text fallback active");
      }
    }

    void connect();
    return () => {
      active = false;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [interviewId]);

  return <span className="room-realtime-status" aria-live="polite">{status}</span>;
}
