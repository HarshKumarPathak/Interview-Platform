import { NextResponse } from "next/server";

const required = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_AGENT_SHARED_SECRET",
  "OPENAI_API_KEY",
] as const;

const optional = [
  "INTERVIEW_AVATAR_PROVIDER",
  "ANAM_API_KEY",
  "ANAM_AVATAR_ID_1",
  "ANAM_AVATAR_ID_2",
  "ANAM_AVATAR_ID_3",
] as const;

export async function GET() {
  const missing = required.filter((name) => !process.env[name]?.trim());
  const avatarProvider = process.env.INTERVIEW_AVATAR_PROVIDER?.trim().toLowerCase() || "none";
  const avatarConfigured = avatarProvider === "anam"
    ? Boolean(
        process.env.ANAM_API_KEY?.trim() &&
        [1, 2, 3].some((index) => process.env[`ANAM_AVATAR_ID_${index}`]?.trim()),
      )
    : false;

  return NextResponse.json({
    ok: missing.length === 0,
    realtime: {
      configured: missing.length === 0,
      missing,
      provider: "livekit + openai-realtime",
    },
    avatar: {
      provider: avatarProvider,
      configured: avatarConfigured,
      missing: avatarProvider === "anam"
        ? optional.filter((name) => !process.env[name]?.trim())
        : [],
    },
    checks: {
      livekitUrl: Boolean(process.env.LIVEKIT_URL?.trim()),
      livekitCredentials: Boolean(process.env.LIVEKIT_API_KEY?.trim() && process.env.LIVEKIT_API_SECRET?.trim()),
      agentSharedSecret: Boolean(process.env.LIVEKIT_AGENT_SHARED_SECRET?.trim()),
      openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
  });
}
