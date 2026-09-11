"use client";

import { useEffect, useState } from "react";

type LiveKitPublication = { track?: { attach?: () => HTMLMediaElement } };
type LiveKitParticipant = {
  publishTrack: (track: MediaStreamTrack, options?: Record<string, unknown>) => Promise<LiveKitPublication>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<LiveKitPublication | undefined>;
};
type LiveKitRoom = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  localParticipant: LiveKitParticipant;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
};
type LiveKitClient = {
  Room: new (options?: Record<string, unknown>) => LiveKitRoom;
  RoomEvent: { TrackSubscribed: string };
  Track: { Kind: { Audio: string } };
};

declare global { interface Window { LivekitClient?: LiveKitClient } }

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

export default function RealtimeTransport({
  interviewId,
  stream,
  muted,
  onStatus,
}: {
  interviewId: string | null;
  stream: MediaStream | null;
  muted: boolean;
  onStatus?: (status: "connecting" | "connected" | "unavailable") => void;
}) {
  const [status, setStatus] = useState("Realtime voice: waiting…");

  useEffect(() => {
    if (!interviewId || !stream) return;
    const activeStream = stream;
    let active = true;
    let room: LiveKitRoom | null = null;
    let client: LiveKitClient | null = null;

    const setTransportStatus = (next: "connecting" | "connected" | "unavailable") => {
      const label = next === "connected" ? "Realtime voice: connected" : next === "unavailable" ? "Realtime voice: unavailable · text fallback active" : "Realtime voice: connecting…";
      setStatus(label);
      onStatus?.(next);
    };

    async function connect() {
      setTransportStatus("connecting");
      try {
        const tokenResponse = await fetch("/api/livekit/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId }) });
        if (!tokenResponse.ok) throw new Error("Realtime voice is not configured");
        const { token, serverUrl } = await tokenResponse.json();
        client = await loadLiveKitClient();
        if (!active) return;
        room = new client.Room({ adaptiveStream: true, dynacast: true });
        const onTrackSubscribed = (...args: unknown[]) => {
          const track = args[0] as { kind?: string; attach?: () => HTMLMediaElement } | undefined;
          if (!track || track.kind !== client?.Track.Kind.Audio || !track.attach) return;
          const element = track.attach();
          element.autoplay = true;
          element.setAttribute("aria-label", "AI interviewer audio");
          document.body.appendChild(element);
        };
        room.on(client.RoomEvent.TrackSubscribed, onTrackSubscribed);
        await room.connect(serverUrl, token);

        const audioTrack = activeStream.getAudioTracks()[0];
        const videoTrack = activeStream.getVideoTracks()[0];
        if (!audioTrack || !videoTrack) throw new Error("Camera or microphone track unavailable");
        await room.localParticipant.publishTrack(videoTrack, { source: "camera", simulcast: true });
        await room.localParticipant.publishTrack(audioTrack, { source: "microphone" });
        await room.localParticipant.setMicrophoneEnabled(!muted);
        if (active) setTransportStatus("connected");
      } catch (error) {
        console.warn("LiveKit realtime transport unavailable", error);
        room?.disconnect();
        if (active) setTransportStatus("unavailable");
      }
    }

    void connect();
    return () => {
      active = false;
      room?.disconnect();
    };
  }, [interviewId, stream, muted, onStatus]);

  return <span className="room-realtime-status" aria-live="polite">{status}</span>;
}
