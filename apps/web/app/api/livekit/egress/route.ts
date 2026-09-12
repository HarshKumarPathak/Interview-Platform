import { NextResponse } from "next/server";
import { createHash, createHmac } from "node:crypto";
import { query } from "@interview-platform/database";
import { getSession } from "../../../../lib/auth";
import { createLiveKitRoomRecordToken } from "../../../../lib/livekit-token";

function liveKitHttpUrl() {
  const raw = process.env.LIVEKIT_URL?.trim();
  if (!raw) return null;
  return raw.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");
}

function storageConfig() {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKey = process.env.S3_ACCESS_KEY_ID?.trim();
  const secret = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (!bucket || !accessKey || !secret) return null;
  return { s3: { access_key: accessKey, secret, bucket, region, ...(endpoint ? { endpoint, force_path_style: true } : {}) } };
}

function s3Config() {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKey = process.env.S3_ACCESS_KEY_ID?.trim();
  const secret = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  if (!bucket || !accessKey || !secret) return null;
  const endpoint = process.env.S3_ENDPOINT?.trim() || `https://s3.${region}.amazonaws.com`;
  return { bucket, accessKey, secret, region, endpoint: endpoint.replace(/\/$/, "") };
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalPath(key: string) {
  return `/${key.split("/").map(awsEncode).join("/")}`;
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hexHmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function signedPlaybackUrl(key: string) {
  const config = s3Config();
  if (!config || key.includes("{")) return null;
  const endpoint = new URL(config.endpoint);
  const host = endpoint.host;
  const path = `${endpoint.pathname.replace(/\/$/, "")}/${config.bucket}${canonicalPath(key)}`.replace(/\/+/g, "/");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": "host",
  });
  const sortedQuery = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([keyName, value]) => `${awsEncode(keyName)}=${awsEncode(value)}`).join("&");
  const canonicalRequest = ["GET", path, sortedQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmac(hmac(hmac(`AWS4${config.secret}`, dateStamp), config.region), "s3");
  params.set("X-Amz-Signature", hexHmac(signingKey, stringToSign));
  return `${endpoint.origin}${path}?${params.toString()}`;
}

async function liveKitRequest(path: string, body: Record<string, unknown>, roomName: string) {
  const baseUrl = liveKitHttpUrl();
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!baseUrl || !apiKey || !apiSecret) throw new Error("LiveKit is not configured");
  const token = createLiveKitRoomRecordToken({ apiKey, apiSecret, room: roomName });
  const response = await fetch(`${baseUrl}/twirp/livekit.Egress/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { payload = { error: text }; }
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `LiveKit Egress request failed (${response.status})`);
  return payload;
}

async function candidateInterview(interviewId: string, userId: string) {
  const candidate = await query<{ id: string }>("select id from candidates where user_id = $1", [userId]);
  const candidateId = candidate.rows[0]?.id;
  if (!candidateId) return null;
  const interview = await query<{ id: string; status: string; recording_status: string; recording_egress_id: string | null; recording_path: string | null }>(
    "select id, status, recording_status, recording_egress_id, recording_path from interviews where id = $1 and candidate_id = $2",
    [interviewId, candidateId],
  );
  return interview.rows[0] ?? null;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const interviewId = new URL(request.url).searchParams.get("interviewId") ?? "";
    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
    const row = await candidateInterview(interviewId, session.userId);
    if (!row) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    if (!row.recording_egress_id) return NextResponse.json({ recordingStatus: row.recording_status, egressId: null, path: row.recording_path, playbackUrl: null });

    try {
      const result = await liveKitRequest("ListEgress", { egress_id: row.recording_egress_id }, `interview-${interviewId}`);
      const item = Array.isArray(result.items) ? result.items[0] as Record<string, unknown> | undefined : undefined;
      const status = typeof item?.status === "string" ? item.status : null;
      const fileResults = Array.isArray(item?.file_results) ? item.file_results as Array<Record<string, unknown>> : [];
      const location = typeof fileResults[0]?.location === "string" ? fileResults[0].location : null;
      const actualPath = location ? location.replace(/^s3:\/\/[^/]+\//, "") : row.recording_path;
      const completed = status === "EGRESS_COMPLETE";
      const failed = ["EGRESS_FAILED", "EGRESS_ABORTED", "EGRESS_LIMIT_REACHED"].includes(status ?? "");
      if (location) await query("update interviews set recording_path = $1 where id = $2", [actualPath, interviewId]);
      if (completed) await query("update interviews set recording_status = 'completed', recording_completed_at = coalesce(recording_completed_at, now()), recording_error = null where id = $1", [interviewId]);
      if (failed) await query("update interviews set recording_status = 'failed', recording_error = coalesce($2, recording_error) where id = $1", [interviewId, typeof item?.error === "string" ? item.error : "Egress failed"]);
      const playbackUrl = completed && actualPath ? signedPlaybackUrl(actualPath) : null;
      return NextResponse.json({ recordingStatus: completed ? "completed" : failed ? "failed" : row.recording_status, egressId: row.recording_egress_id, path: actualPath, playbackUrl, egressStatus: status, error: item?.error ?? null });
    } catch {
      return NextResponse.json({ recordingStatus: row.recording_status, egressId: row.recording_egress_id, path: row.recording_path, playbackUrl: row.recording_status === "completed" && row.recording_path ? signedPlaybackUrl(row.recording_path) : null });
    }
  } catch (error) {
    console.error("LiveKit Egress status failed", error);
    return NextResponse.json({ error: "Recording service unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json() as { interviewId?: string; action?: "start" | "stop" };
    const interviewId = String(body.interviewId ?? "");
    const action = body.action ?? "start";
    if (!interviewId || !["start", "stop"].includes(action)) return NextResponse.json({ error: "interviewId and valid action are required" }, { status: 400 });
    const row = await candidateInterview(interviewId, session.userId);
    if (!row) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    if (!["ready", "in_progress", "completed"].includes(row.status)) return NextResponse.json({ error: "Interview cannot be recorded" }, { status: 409 });

    const storage = storageConfig();
    if (!storage) {
      await query("update interviews set recording_status = 'disabled', recording_error = $1 where id = $2", ["S3-compatible recording storage is not configured", interviewId]);
      return NextResponse.json({ enabled: false, recordingStatus: "disabled" });
    }

    const room = `interview-${interviewId}`;
    if (action === "stop") {
      if (!row.recording_egress_id || !["starting", "recording", "stopping"].includes(row.recording_status)) return NextResponse.json({ enabled: true, recordingStatus: row.recording_status, egressId: row.recording_egress_id });
      await liveKitRequest("StopEgress", { egress_id: row.recording_egress_id }, room);
      await query("update interviews set recording_status = 'stopping' where id = $1 and recording_egress_id = $2", [interviewId, row.recording_egress_id]);
      return NextResponse.json({ enabled: true, recordingStatus: "stopping", egressId: row.recording_egress_id });
    }

    if (row.recording_egress_id && ["starting", "recording", "stopping"].includes(row.recording_status)) return NextResponse.json({ enabled: true, recordingStatus: row.recording_status, egressId: row.recording_egress_id });
    const filepath = `interviews/${interviewId}/{room_name}-{time}.mp4`;
    await query("update interviews set recording_status = 'starting', recording_error = null, recording_egress_id = null, recording_started_at = now(), recording_completed_at = null where id = $1", [interviewId]);
    try {
      const result = await liveKitRequest("StartEgress", { room_name: room, template: { layout: "grid" }, outputs: [{ file: { file_type: "MP4", filepath } }], storage }, room);
      const egressId = typeof result.egress_id === "string" ? result.egress_id : null;
      if (!egressId) throw new Error("LiveKit did not return an egress id");
      await query("update interviews set recording_status = 'recording', recording_egress_id = $1, recording_path = $2 where id = $3", [egressId, filepath, interviewId]);
      return NextResponse.json({ enabled: true, recordingStatus: "recording", egressId, path: filepath });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start recording";
      await query("update interviews set recording_status = 'failed', recording_error = $1 where id = $2", [message, interviewId]);
      return NextResponse.json({ error: message, recordingStatus: "failed" }, { status: 502 });
    }
  } catch (error) {
    console.error("LiveKit Egress control failed", error);
    return NextResponse.json({ error: "Recording service unavailable" }, { status: 503 });
  }
}
