"use client";

import { useEffect, useRef, useState } from "react";

type LiveKitTrack = { kind?: string; attach?: () => HTMLMediaElement };
type LiveKitPublication = { kind?: string; track?: LiveKitTrack; videoTrack?: LiveKitTrack };
type LiveKitParticipant = {
  setCameraEnabled: (enabled: boolean) => Promise<LiveKitPublication | undefined>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<LiveKitPublication | undefined>;
  videoTrackPublications: Map<string, LiveKitPublication>;
};
type LiveKitRoom = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  localParticipant: LiveKitParticipant;
  on: (event: string, callback: (...args: any[]) => void) => void;
};
type LiveKitClient = {
  Room: new (options?: Record<string, unknown>) => LiveKitRoom;
  RoomEvent: { TrackSubscribed: string; LocalTrackPublished: string };
  Track: { Kind: { Audio: string; Video: string } };
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

function attachLocalVideo(room: LiveKitRoom, container: HTMLElement | null, client: LiveKitClient) {
  if (!container) return;
  container.querySelectorAll("video[data-livekit-local]").forEach((element) => element.remove());
  for (const publication of room.localParticipant.videoTrackPublications.values()) {
    const track = publication.track ?? publication.videoTrack;
    if (publication.kind !== client.Track.Kind.Video || !track?.attach) continue;
    const element = track.attach();
    element.setAttribute("data-livekit-local", "true");
    element.setAttribute("aria-label", "Candidate camera preview");
    element.setAttribute("playsinline", "true");
    element.autoplay = true;
    container.appendChild(element);
    break;
  }
}

export default function RealtimeTransport({
  interviewId,
  muted,
  videoContainer,
  onStatus,
}: {
  interviewId: string | null;
  muted: boolean;
  videoContainer: HTMLElement | null;
  onStatus?: (status: "connecting" | "connected" | "unavailable") => void;
}) {
  const roomRef = useRef<LiveKitRoom | null>(null);
  const [status, setStatus] = useState("Realtime voice: waiting…");

  useEffect(() => {
    const room = roomRef.current;
    if (room) void room.localParticipant.setMicrophoneEnabled(!muted);
  }, [muted]);

  useEffect(() => {
    if (!interviewId) return;
    let active = true;
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
        const room = new client.Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        const onTrackSubscribed = (track: LiveKitTrack) => {
          if (track.kind !== client?.Track.Kind.Audio || !track.attach) return;
          const element = track.attach();
          element.autoplay = true;
          element.setAttribute("aria-label", "AI interviewer audio");
          document.body.appendChild(element);
        };
        const onLocalTrackPublished = () => attachLocalVideo(room, videoContainer, client!);
        room.on(client.RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.on(client.RoomEvent.LocalTrackPublished, onLocalTrackPublished);
        await room.connect(serverUrl, token);
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(!muted);
        attachLocalVideo(room, videoContainer, client);
        if (active) setTransportStatus("connected");
      } catch (error) {
        console.warn("LiveKit realtime transport unavailable", error);
        if (active) setTransportStatus("unavailable");
      }
    }

    void connect();
    return () => {
      active = false;
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (videoContainer) videoContainer.querySelectorAll("video[data-livekit-local]").forEach((element) => element.remove());
    };
  }, [interviewId, muted, onStatus, videoContainer]);

  return <span className="room-realtime-status" aria-live="polite">{status}</span>;
}
