"use client";

import { useEffect, useRef, useState } from "react";

type LiveKitPublication = { track?: { attach?: () => HTMLMediaElement; detach?: () => void } };
type LiveKitParticipant = { identity?: string; publishTrack: (track: MediaStreamTrack, options?: Record<string, unknown>) => Promise<LiveKitPublication>; setMicrophoneEnabled: (enabled: boolean) => Promise<LiveKitPublication | undefined>; setScreenShareEnabled: (enabled: boolean) => Promise<LiveKitPublication | undefined> };
type LiveKitTrack = { kind?: string; mediaStreamTrack?: MediaStreamTrack; detach?: () => void };
type LiveKitRemoteParticipant = { identity?: string; attributes?: Record<string, string> };
type LiveKitRoom = { connect: (url: string, token: string) => Promise<void>; disconnect: () => void; localParticipant: LiveKitParticipant; remoteParticipants?: Map<string, LiveKitRemoteParticipant>; on: (event: string, callback: (...args: unknown[]) => void) => void };
type LiveKitClient = { Room: new (options?: Record<string, unknown>) => LiveKitRoom; RoomEvent: { TrackSubscribed: string; TrackUnsubscribed: string; ActiveSpeakersChanged: string; ParticipantAttributesChanged: string; ParticipantConnected: string; ParticipantDisconnected: string; ConnectionQualityChanged: string }; Track: { Kind: { Audio: string; Video: string } } };
type InterviewerState = "initializing" | "idle" | "listening" | "thinking" | "speaking";
type ConnectionQuality = "excellent" | "good" | "poor";
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
    const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/dist/livekit-client.umd.min.js"; script.async = true; script.dataset.livekitClient = "true";
    script.onload = () => window.LivekitClient ? resolve(window.LivekitClient) : reject(new Error("LiveKit client unavailable")); script.onerror = () => reject(new Error("LiveKit client failed to load")); document.head.appendChild(script);
  });
}

async function controlRecording(interviewId: string, action: "start" | "stop", keepalive = false) {
  try { await fetch("/api/livekit/egress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId, action }), keepalive }); }
  catch (error) { console.warn(`Recording ${action} request failed`, error); }
}

type Props = {
  interviewId: string | null; stream: MediaStream | null; muted: boolean; screenShareEnabled?: boolean;
  onStatus?: (status: "connecting" | "connected" | "unavailable") => void;
  onScreenShareStatus?: (enabled: boolean) => void;
  onRemoteVideoTrack?: (track: MediaStreamTrack, participantIdentity: string) => void;
  onRemoteVideoTrackRemoved?: (participantIdentity: string) => void;
  onActiveSpeaker?: (participantIdentity: string | null) => void;
  onInterviewerState?: (participantIdentity: string, state: InterviewerState) => void;
  onConnectionQuality?: (quality: ConnectionQuality) => void;
};
const VALID_STATES = new Set<InterviewerState>(["initializing", "idle", "listening", "thinking", "speaking"]);
function panelIdentity(participant: LiveKitRemoteParticipant | undefined) { const identity = participant?.identity ?? "interviewer"; const panelIndex = participant?.attributes?.["interview.panel_index"]; if (panelIndex !== undefined && ["0", "1", "2"].includes(panelIndex)) return `interviewer-avatar-${Number(panelIndex) + 1}`; return identity; }
function qualityLabel(quality: ConnectionQuality) { if (quality === "excellent") return "Excellent connection"; if (quality === "poor") return "Connection issue · fallback ready"; return "Good connection"; }

export default function RealtimeTransport({ interviewId, stream, muted, screenShareEnabled = false, onStatus, onScreenShareStatus, onRemoteVideoTrack, onRemoteVideoTrackRemoved, onActiveSpeaker, onInterviewerState, onConnectionQuality }: Props) {
  const [status, setStatus] = useState("Realtime voice: waiting…");
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("good");
  const mutedRef = useRef(muted); const screenShareRef = useRef(screenShareEnabled); const onStatusRef = useRef(onStatus); const onScreenShareStatusRef = useRef(onScreenShareStatus); const onRemoteVideoTrackRef = useRef(onRemoteVideoTrack); const onRemoteVideoTrackRemovedRef = useRef(onRemoteVideoTrackRemoved); const onActiveSpeakerRef = useRef(onActiveSpeaker); const onInterviewerStateRef = useRef(onInterviewerState); const onConnectionQualityRef = useRef(onConnectionQuality); const roomRef = useRef<LiveKitRoom | null>(null); const recordingStartedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; void roomRef.current?.localParticipant.setMicrophoneEnabled(!muted).catch(() => undefined); }, [muted]);
  useEffect(() => { screenShareRef.current = screenShareEnabled; if (roomRef.current) void roomRef.current.localParticipant.setScreenShareEnabled(screenShareEnabled).then(() => onScreenShareStatusRef.current?.(screenShareEnabled)).catch(() => onScreenShareStatusRef.current?.(false)); }, [screenShareEnabled]);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]); useEffect(() => { onScreenShareStatusRef.current = onScreenShareStatus; }, [onScreenShareStatus]); useEffect(() => { onRemoteVideoTrackRef.current = onRemoteVideoTrack; }, [onRemoteVideoTrack]); useEffect(() => { onRemoteVideoTrackRemovedRef.current = onRemoteVideoTrackRemoved; }, [onRemoteVideoTrackRemoved]); useEffect(() => { onActiveSpeakerRef.current = onActiveSpeaker; }, [onActiveSpeaker]); useEffect(() => { onInterviewerStateRef.current = onInterviewerState; }, [onInterviewerState]); useEffect(() => { onConnectionQualityRef.current = onConnectionQuality; }, [onConnectionQuality]);

  useEffect(() => {
    if (!interviewId || !stream) return;
    const currentInterviewId = interviewId, activeStream = stream; let active = true; let room: LiveKitRoom | null = null; let client: LiveKitClient | null = null; const remoteAudioElements: HTMLMediaElement[] = []; const remoteVideoParticipants = new Set<string>();
    const setTransportStatus = (next: "connecting" | "connected" | "unavailable") => { const label = next === "connected" ? "Realtime video interview: connected" : next === "unavailable" ? "Realtime service unavailable · text fallback active" : "Joining interview room…"; setStatus(label); onStatusRef.current?.(next); };
    const setQuality = (quality: ConnectionQuality) => { setConnectionQuality(quality); onConnectionQualityRef.current?.(quality); };
    const reportParticipantState = (participant: LiveKitRemoteParticipant | undefined) => { const identity = panelIdentity(participant); if (!identity) return; const raw = participant?.attributes?.["lk.agent.state"]; const state = raw && VALID_STATES.has(raw as InterviewerState) ? raw as InterviewerState : "idle"; onInterviewerStateRef.current?.(identity, state); };
    async function connect() {
      setTransportStatus("connecting"); setQuality("good");
      try {
        const tokenResponse = await fetch("/api/livekit/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewId: currentInterviewId }) }); if (!tokenResponse.ok) throw new Error("Realtime interview is not configured");
        const payload = await tokenResponse.json() as { token?: unknown; serverUrl?: unknown }; const token = typeof payload.token === "string" ? payload.token : null; const serverUrl = typeof payload.serverUrl === "string" ? payload.serverUrl : null; if (!token || !serverUrl) throw new Error("LiveKit token response is invalid");
        client = await loadLiveKitClient(); if (!active) return; room = new client.Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
        const onTrackSubscribed = (...args: unknown[]) => { const track = args[0] as LiveKitTrack | undefined; const participant = args[2] as LiveKitRemoteParticipant | undefined; const identity = panelIdentity(participant); if (!track) return; reportParticipantState(participant); if (track.kind === client?.Track.Kind.Audio && (track as LiveKitTrack & { attach?: () => HTMLMediaElement }).attach) { const element = (track as LiveKitTrack & { attach: () => HTMLMediaElement }).attach(); element.autoplay = true; element.setAttribute("aria-label", "AI interviewer audio"); document.body.appendChild(element); remoteAudioElements.push(element); } if (track.kind === client?.Track.Kind.Video && track.mediaStreamTrack) { remoteVideoParticipants.add(identity); onRemoteVideoTrackRef.current?.(track.mediaStreamTrack, identity); } };
        const onTrackUnsubscribed = (...args: unknown[]) => { const participant = args[2] as LiveKitRemoteParticipant | undefined; const identity = panelIdentity(participant); remoteVideoParticipants.delete(identity); onRemoteVideoTrackRemovedRef.current?.(identity); const track = args[0] as LiveKitTrack | undefined; track?.detach?.(); };
        const onActiveSpeakersChanged = (...args: unknown[]) => { const speakers = Array.isArray(args[0]) ? args[0] as Array<LiveKitRemoteParticipant & { identity?: string }> : []; const interviewer = speakers.find((speaker) => speaker.identity && (remoteVideoParticipants.has(panelIdentity(speaker)) || speaker.attributes?.["lk.agent.state"])); onActiveSpeakerRef.current?.(interviewer ? panelIdentity(interviewer) : null); };
        const onParticipantAttributesChanged = (...args: unknown[]) => { const changed = args[0] as Record<string, string> | undefined; const participant = args[1] as LiveKitRemoteParticipant | undefined; if ((changed?.["lk.agent.state"] || changed?.["interview.panel_index"]) && participant?.identity) reportParticipantState(participant); else reportParticipantState(participant); };
        const onParticipantConnected = (...args: unknown[]) => reportParticipantState(args[0] as LiveKitRemoteParticipant | undefined);
        const onParticipantDisconnected = (...args: unknown[]) => { const participant = args[0] as LiveKitRemoteParticipant | undefined; if (participant?.identity) { const identity = panelIdentity(participant); remoteVideoParticipants.delete(identity); onRemoteVideoTrackRemovedRef.current?.(identity); onInterviewerStateRef.current?.(identity, "idle"); } };
        const onConnectionQualityChanged = (...args: unknown[]) => { const quality = String(args[0] ?? "good").toLowerCase(); const normalized: ConnectionQuality = quality.includes("poor") || quality.includes("lost") ? "poor" : quality.includes("excellent") ? "excellent" : "good"; setQuality(normalized); };
        room.on(client.RoomEvent.TrackSubscribed, onTrackSubscribed); room.on(client.RoomEvent.TrackUnsubscribed, onTrackUnsubscribed); room.on(client.RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged); room.on(client.RoomEvent.ParticipantAttributesChanged, onParticipantAttributesChanged); room.on(client.RoomEvent.ParticipantConnected, onParticipantConnected); room.on(client.RoomEvent.ParticipantDisconnected, onParticipantDisconnected); room.on(client.RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged); await room.connect(serverUrl, token);
        for (const participant of room.remoteParticipants?.values() ?? []) reportParticipantState(participant);
        const audioTrack = activeStream.getAudioTracks()[0], videoTrack = activeStream.getVideoTracks()[0]; if (!audioTrack || !videoTrack) throw new Error("Camera or microphone track unavailable"); await room.localParticipant.publishTrack(videoTrack, { source: "camera", simulcast: true }); await room.localParticipant.publishTrack(audioTrack, { source: "microphone" }); await room.localParticipant.setMicrophoneEnabled(!mutedRef.current);
        if (screenShareRef.current) { try { await room.localParticipant.setScreenShareEnabled(true); onScreenShareStatusRef.current?.(true); } catch { onScreenShareStatusRef.current?.(false); } }
        if (!active) return; await controlRecording(currentInterviewId, "start"); recordingStartedRef.current = true; setTransportStatus("connected");
      } catch (error) { console.warn("LiveKit realtime transport unavailable", error); room?.disconnect(); roomRef.current = null; if (active) { onScreenShareStatusRef.current?.(false); setQuality("poor"); setTransportStatus("unavailable"); } }
    }
    void connect();
    return () => { active = false; if (recordingStartedRef.current) { void controlRecording(currentInterviewId, "stop", true); recordingStartedRef.current = false; } onScreenShareStatusRef.current?.(false); for (const identity of remoteVideoParticipants) onRemoteVideoTrackRemovedRef.current?.(identity); room?.disconnect(); if (roomRef.current === room) roomRef.current = null; for (const element of remoteAudioElements) element.remove(); };
  }, [interviewId, stream]);

  return <span className="room-realtime-status" aria-live="polite">{status} · {qualityLabel(connectionQuality)}</span>;
}
