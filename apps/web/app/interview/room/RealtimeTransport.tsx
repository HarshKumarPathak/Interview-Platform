"use client";

import { useEffect, useRef, useState } from "react";

type LiveKitPublication = { track?: { attach?: () => HTMLMediaElement; detach?: () => void } };
type LiveKitParticipant = {
  identity?: string;
  publishTrack: (track: MediaStreamTrack, options?: Record<string, unknown>) => Promise<LiveKitPublication>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<LiveKitPublication | undefined>;
};
type LiveKitTrack = {
  kind?: string;
  mediaStreamTrack?: MediaStreamTrack;
  attach?: () => HTMLMediaElement;
  detach?: () => void;
};
type LiveKitRoom = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  localParticipant: LiveKitParticipant;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
};
type LiveKitClient = {
  Room: new (options?: Record<string, unknown>) => LiveKitRoom;
  RoomEvent: { TrackSubscribed: string; TrackUnsubscribed: string; ActiveSpeakersChanged: string };
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

async function controlRecording(interviewId: string, action: "start" | "stop", keepalive = false) {
  try {
    await fetch("/api/livekit/egress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, action }), keepalive });
  } catch (error) { console.warn(`Recording ${action} request failed`, error); }
}

type Props = {
  interviewId: string | null;
  stream: MediaStream | null;
  muted: boolean;
  onStatus?: (status: "connecting" | "connected" | "unavailable") => void;
  onRemoteVideoTrack?: (track: MediaStreamTrack, participantIdentity: string) => void;
  onRemoteVideoTrackRemoved?: (participantIdentity: string) => void;
  onActiveSpeaker?: (participantIdentity: string | null) => void;
};

export default function RealtimeTransport({ interviewId, stream, muted, onStatus, onRemoteVideoTrack, onRemoteVideoTrackRemoved, onActiveSpeaker }: Props) {
  const [status, setStatus] = useState("Realtime voice: waiting…");
  const mutedRef = useRef(muted);
  const onStatusRef = useRef(onStatus);
  const onRemoteVideoTrackRef = useRef(onRemoteVideoTrack);
  const onRemoteVideoTrackRemovedRef = useRef(onRemoteVideoTrackRemoved);
  const onActiveSpeakerRef = useRef(onActiveSpeaker);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const recordingStartedRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; void roomRef.current?.localParticipant.setMicrophoneEnabled(!muted).catch(() => undefined); }, [muted]);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
  useEffect(() => { onRemoteVideoTrackRef.current = onRemoteVideoTrack; }, [onRemoteVideoTrack]);
  useEffect(() => { onRemoteVideoTrackRemovedRef.current = onRemoteVideoTrackRemoved; }, [onRemoteVideoTrackRemoved]);
  useEffect(() => { onActiveSpeakerRef.current = onActiveSpeaker; }, [onActiveSpeaker]);

  useEffect(() => {
    if (!interviewId || !stream) return;
    const currentInterviewId = interviewId;
    const activeStream = stream;
    let active = true;
    let room: LiveKitRoom | null = null;
    let client: LiveKitClient | null = null;
    const remoteAudioElements: HTMLMediaElement[] = [];
    const remoteVideoParticipants = new Set<string>();

    const setTransportStatus = (next: "connecting" | "connected" | "unavailable") => {
      const label = next === "connected" ? "Realtime video interview: connected" : next === "unavailable" ? "Realtime service unavailable · text fallback active" : "Joining interview room…";
      setStatus(label);
      onStatusRef.current?.(next);
    };

    async function connect() {
      setTransportStatus("connecting");
      try {
        const tokenResponse = await fetch("/api/livekit/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: currentInterviewId }) });
        if (!tokenResponse.ok) throw new Error("Realtime interview is not configured");
        const payload = await tokenResponse.json() as { token?: unknown; serverUrl?: unknown };
        const token = typeof payload.token === "string" ? payload.token : null;
        const serverUrl = typeof payload.serverUrl === "string" ? payload.serverUrl : null;
        if (!token || !serverUrl) throw new Error("LiveKit token response is invalid");
        client = await loadLiveKitClient();
        if (!active) return;
        room = new client.Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const onTrackSubscribed = (...args: unknown[]) => {
          const track = args[0] as LiveKitTrack | undefined;
          const participant = args[2] as { identity?: string } | undefined;
          const identity = participant?.identity ?? "interviewer";
          if (!track) return;
          if (track.kind === client?.Track.Kind.Audio && track.attach) {
            const element = track.attach();
            element.autoplay = true;
            element.setAttribute("aria-label", "AI interviewer audio");
            document.body.appendChild(element);
            remoteAudioElements.push(element);
          }
          if (track.kind === client?.Track.Kind.Video && track.mediaStreamTrack) {
            remoteVideoParticipants.add(identity);
            onRemoteVideoTrackRef.current?.(track.mediaStreamTrack, identity);
          }
        };
        const onTrackUnsubscribed = (...args: unknown[]) => {
          const participant = args[2] as { identity?: string } | undefined;
          const identity = participant?.identity ?? "interviewer";
          remoteVideoParticipants.delete(identity);
          onRemoteVideoTrackRemovedRef.current?.(identity);
          const track = args[0] as LiveKitTrack | undefined;
          track?.detach?.();
        };
        const onActiveSpeakersChanged = (...args: unknown[]) => {
          const speakers = Array.isArray(args[0]) ? args[0] as Array<{ identity?: string }> : [];
          const interviewer = speakers.find((speaker) => speaker.identity && remoteVideoParticipants.has(speaker.identity));
          onActiveSpeakerRef.current?.(interviewer?.identity ?? null);
        };

        room.on(client.RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.on(client.RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
        room.on(client.RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
        await room.connect(serverUrl, token);

        const audioTrack = activeStream.getAudioTracks()[0];
        const videoTrack = activeStream.getVideoTracks()[0];
        if (!audioTrack || !videoTrack) throw new Error("Camera or microphone track unavailable");
        await room.localParticipant.publishTrack(videoTrack, { source: "camera", simulcast: true });
        await room.localParticipant.publishTrack(audioTrack, { source: "microphone" });
        await room.localParticipant.setMicrophoneEnabled(!mutedRef.current);
        if (!active) return;
        await controlRecording(currentInterviewId, "start");
        recordingStartedRef.current = true;
        setTransportStatus("connected");
      } catch (error) {
        console.warn("LiveKit realtime transport unavailable", error);
        room?.disconnect();
        roomRef.current = null;
        if (active) setTransportStatus("unavailable");
      }
    }

    void connect();
    return () => {
      active = false;
      if (recordingStartedRef.current) {
        void controlRecording(currentInterviewId, "stop", true);
        recordingStartedRef.current = false;
      }
      for (const identity of remoteVideoParticipants) onRemoteVideoTrackRemovedRef.current?.(identity);
      room?.disconnect();
      if (roomRef.current === room) roomRef.current = null;
      for (const element of remoteAudioElements) element.remove();
    };
  }, [interviewId, stream]);

  return <span className="room-realtime-status" aria-live="polite">{status}</span>;
}
