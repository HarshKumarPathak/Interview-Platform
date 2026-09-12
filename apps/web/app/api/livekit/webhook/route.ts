import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";

function verifyJwt(token: string, secret: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  if (expected.length !== encodedSignature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(encodedSignature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token || !verifyJwt(token, secret)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });

    const event = await request.json() as Record<string, unknown>;
    const egress = (event.egressInfo ?? event.egress_info) as Record<string, unknown> | undefined;
    const eventName = String(event.event ?? "");
    const egressId = String(egress?.egressId ?? egress?.egress_id ?? "");
    if (!egressId) return NextResponse.json({ ok: true, ignored: true });
    const roomName = String(egress?.roomName ?? egress?.room_name ?? "");
    const interviewId = roomName.startsWith("interview-") ? roomName.slice("interview-".length) : "";
    if (!interviewId) return NextResponse.json({ ok: true, ignored: true });
    const files = (egress?.fileResults ?? egress?.file_results) as Array<Record<string, unknown>> | undefined;
    const location = String(files?.[0]?.location ?? files?.[0]?.filename ?? "");
    const error = String(egress?.error ?? "");

    if (eventName === "egress_started" || eventName === "egress_updated") {
      await query("update interviews set recording_egress_id=$2, recording_status='recording', recording_started_at=coalesce(recording_started_at, now()), recording_error=null where id=$1", [interviewId, egressId]);
    } else if (["egress_ended", "egress_complete"].includes(eventName)) {
      await query("update interviews set recording_egress_id=$2, recording_status='completed', recording_path=coalesce(nullif($3,''), recording_path), recording_completed_at=now(), recording_error=null where id=$1", [interviewId, egressId, location]);
    } else if (["egress_failed", "egress_aborted", "egress_limit_reached"].includes(eventName)) {
      await query("update interviews set recording_egress_id=$2, recording_status='failed', recording_error=nullif($3,''), recording_completed_at=now() where id=$1", [interviewId, egressId, error || eventName]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LiveKit webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
