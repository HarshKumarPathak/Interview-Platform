import { createHmac } from "node:crypto";

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function createLiveKitToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  room: string;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 60 * 60;
  const deployment = process.env.LIVEKIT_AGENT_DEPLOYMENT?.trim();
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: input.apiKey,
    sub: input.identity,
    name: input.name ?? input.identity,
    nbf: now - 5,
    iat: now,
    exp: now + ttl,
    video: {
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    roomConfig: {
      agents: [
        {
          agentName: "interview-agent",
          ...(deployment ? { deployment } : {}),
        },
      ],
    },
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", input.apiSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
