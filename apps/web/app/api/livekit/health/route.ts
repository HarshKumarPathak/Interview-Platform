import { NextResponse } from "next/server";

const required = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_AGENT_SHARED_SECRET",
  "OPENAI_API_KEY",
] as const;

export async function GET() {
  const env = process.env;
  const missing = required.filter((name) => !env[name]?.trim());
  const avatarProvider = env.INTERVIEW_AVATAR_PROVIDER?.trim().toLowerCase() || "none";
  const anamKeyConfigured = Boolean(env.ANAM_API_KEY?.trim());
  const avatarSlots = [1, 2, 3].map((index) => ({
    index,
    configured: Boolean(env[`ANAM_AVATAR_ID_${index}`]?.trim()),
  }));
  const configuredAvatarSlots = avatarSlots.filter((slot) => slot.configured).map((slot) => slot.index);

  const warnings: string[] = [];
  if (avatarProvider === "anam" && !anamKeyConfigured) {
    warnings.push("ANAM_API_KEY is not configured; interviewer video avatars will use the professional fallback state.");
  }
  if (avatarProvider === "anam" && configuredAvatarSlots.length === 0) {
    warnings.push("No ANAM avatar slot is configured; interviewer video avatars cannot start.");
  }
  if (!env.AI_ENGINE_URL?.trim()) {
    warnings.push("AI_ENGINE_URL is not configured; realtime adaptive-question calls will use the agent's localhost default.");
  }
  if (!env.WEB_APP_URL?.trim()) {
    warnings.push("WEB_APP_URL is not configured; realtime agents will use the localhost default for context and turn persistence.");
  }

  const response = NextResponse.json({
    ok: missing.length === 0,
    realtime: {
      configured: missing.length === 0,
      missing,
      provider: "livekit + openai-realtime",
      openaiRealtimeModel: env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
    },
    avatar: {
      provider: avatarProvider,
      configured: avatarProvider === "anam" ? anamKeyConfigured && configuredAvatarSlots.length > 0 : false,
      apiKeyConfigured: anamKeyConfigured,
      configuredSlots: configuredAvatarSlots,
      missingSlots: avatarProvider === "anam" ? avatarSlots.filter((slot) => !slot.configured).map((slot) => slot.index) : [],
    },
    adaptiveQuestionEngine: {
      configured: Boolean(env.AI_ENGINE_URL?.trim()),
      urlConfigured: Boolean(env.AI_ENGINE_URL?.trim()),
    },
    agentRuntime: {
      webAppUrlConfigured: Boolean(env.WEB_APP_URL?.trim()),
      sharedSecretConfigured: Boolean(env.LIVEKIT_AGENT_SHARED_SECRET?.trim()),
    },
    checks: {
      livekitUrl: Boolean(env.LIVEKIT_URL?.trim()),
      livekitCredentials: Boolean(env.LIVEKIT_API_KEY?.trim() && env.LIVEKIT_API_SECRET?.trim()),
      agentSharedSecret: Boolean(env.LIVEKIT_AGENT_SHARED_SECRET?.trim()),
      openai: Boolean(env.OPENAI_API_KEY?.trim()),
      aiEngineUrl: Boolean(env.AI_ENGINE_URL?.trim()),
      webAppUrl: Boolean(env.WEB_APP_URL?.trim()),
    },
    warnings,
  }, {
    headers: { "Cache-Control": "no-store" },
  });

  return response;
}
