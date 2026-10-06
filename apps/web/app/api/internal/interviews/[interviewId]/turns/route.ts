import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";

function authorized(request: Request) {
  const expected = process.env.LIVEKIT_AGENT_SHARED_SECRET;
  return Boolean(expected && request.headers.get("x-livekit-agent-secret") === expected);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ interviewId: string }> },
) {
  if (!authorized(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { interviewId } = await params;
    const body = await request.json();
    const speaker = String(body.speaker ?? "");
    const content = String(body.content ?? "").trim();
    if (!interviewId || !["interviewer", "candidate"].includes(speaker) || !content) {
      return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
    }

    const exists = await query<{ id: string }>("select id from interviews where id = $1", [interviewId]);
    if (!exists.rows[0]) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const sequenceResult = await query<{ next_sequence: number }>(
      "select coalesce(max(sequence), -1) + 1 as next_sequence from interview_turns where interview_id = $1",
      [interviewId],
    );
    const sequence = Number(sequenceResult.rows[0]?.next_sequence ?? 0);

    await query(
      `insert into interview_turns (interview_id, sequence, speaker, role, content, metadata)
       values ($1, $2, $3::turn_speaker, $4, $5, $6::jsonb)`,
      [interviewId, sequence, speaker, body.role ? String(body.role) : null, content, JSON.stringify(body.metadata ?? { source: "livekit-agent" })],
    );

    return NextResponse.json({ ok: true, sequence }, { status: 201 });
  } catch (error) {
    console.error("internal interview turn persistence failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
