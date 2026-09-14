import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";

const PANEL_ROLES = ["Technical Interviewer", "HR Interviewer", "Panel Interviewer"];

export async function createLiveKitToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  room: string;
  interviewId?: string;
  panelSize?: number;
  ttlSeconds?: number;
}) {
  const panelSize = Math.min(3, Math.max(1, input.panelSize ?? 1));
  const deployment = process.env.LIVEKIT_AGENT_DEPLOYMENT?.trim();
  const agents = Array.from({ length: panelSize }, (_, index) => new RoomAgentDispatch({
    agentName: `interview-agent-${index + 1}`,
    metadata: JSON.stringify({
      interviewId: input.interviewId ?? "",
      panelIndex: index,
      panelRole: PANEL_ROLES[index] ?? PANEL_ROLES[0],
    }),
    ...(deployment ? { deployment } : {}),
  }));

  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.identity,
    name: input.name ?? input.identity,
    ttl: input.ttlSeconds ?? 60 * 60,
  });
  token.addGrant({
    roomJoin: true,
    room: input.room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  token.roomConfig = new RoomConfiguration({ agents });
  return token.toJwt();
}

export async function createLiveKitRoomRecordToken(input: {
  apiKey: string;
  apiSecret: string;
  room: string;
  ttlSeconds?: number;
}) {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: `recording-service-${input.room}`,
    ttl: input.ttlSeconds ?? 10 * 60,
  });
  token.addGrant({ roomRecord: true, room: input.room });
  return token.toJwt();
}
