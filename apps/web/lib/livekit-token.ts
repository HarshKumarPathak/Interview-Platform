import { createHmac } from "node:crypto";

function base64url(value: string) { return Buffer.from(value).toString("base64url"); }
function signLiveKitJwt(payload: Record<string, unknown>, apiKey: string, apiSecret: string) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsigned = `${header}.${encodedPayload}`;
  const signature = createHmac("sha256", apiSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export function createLiveKitToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  room: string;
  panelSize?: number;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 60 * 60;
  const deployment = process.env.LIVEKIT_AGENT_DEPLOYMENT?.trim();
  const panelSize = Math.min(3, Math.max(1, input.panelSize ?? 1));
  const agents = Array.from({ length: panelSize }, (_, index) => ({ agentName: `interview-agent-${index + 1}`, ...(deployment ? { deployment } : {}) }));
  return signLiveKitJwt({
    iss: input.apiKey,
    sub: input.identity,
    name: input.name ?? input.identity,
    nbf: now - 5,
    iat: now,
    exp: now + ttl,
    video: { roomJoin: true, room: input.room, canPublish: true, canSubscribe: true, canPublishData: true },
    roomConfig: { agents },
  }, input.apiKey, input.apiSecret);
}

export function createLiveKitRoomRecordToken(input: { apiKey: string; apiSecret: string; room: string; ttlSeconds?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 10 * 60;
  return signLiveKitJwt({
    iss: input.apiKey,
    sub: `recording-service-${input.room}`,
    nbf: now - 5,
    iat: now,
    exp: now + ttl,
    video: { roomRecord: true, room: input.room },
  }, input.apiKey, input.apiSecret);
}
