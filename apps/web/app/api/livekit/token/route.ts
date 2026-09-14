import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../../lib/auth";
import { createLiveKitToken } from "../../../../lib/livekit-token";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const interviewId = String(body.interviewId ?? "");
    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });

    const candidate = await query<{ id: string; display_name: string }>("select c.id, c.display_name from candidates c where c.user_id = $1", [session.userId]);
    const candidateRow = candidate.rows[0];
    if (!candidateRow) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    const interview = await query<{ id: string; candidate_id: string; status: string; panel_size: number }>(
      "select id, candidate_id, status, panel_size from interviews where id = $1 and candidate_id = $2",
      [interviewId, candidateRow.id],
    );
    if (!interview.rows[0]) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    if (!["ready", "in_progress"].includes(interview.rows[0].status)) return NextResponse.json({ error: "Interview is not joinable" }, { status: 409 });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !serverUrl) return NextResponse.json({ error: "Realtime voice is not configured" }, { status: 503 });

    const room = `interview-${interviewId}`;
    const token = createLiveKitToken({ apiKey, apiSecret, identity: `candidate-${candidateRow.id}`, name: candidateRow.display_name, room, panelSize: interview.rows[0].panel_size });
    return NextResponse.json({ token, serverUrl, room, panelSize: interview.rows[0].panel_size });
  } catch (error) {
    console.error("LiveKit token creation failed", error);
    return NextResponse.json({ error: "Realtime service unavailable" }, { status: 503 });
  }
}
