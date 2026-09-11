import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId ?? "");
    const speaker = String(body.speaker ?? "");
    const content = String(body.content ?? "").trim();
    const role = body.role ? String(body.role) : null;
    if (!interviewId || !["interviewer", "candidate", "system"].includes(speaker) || !content) {
      return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
    }

    const sequence = await query<{ next_sequence: number }>(
      `select coalesce(max(sequence_no), 0) + 1 as next_sequence from interview_turns where interview_id = $1`,
      [interviewId],
    );
    const result = await query(
      `insert into interview_turns (interview_id, sequence_no, speaker, role, content, started_at, ended_at)
       values ($1, $2, $3, $4, $5, now(), now()) returning id, sequence_no`,
      [interviewId, sequence.rows[0].next_sequence, speaker, role, content],
    );
    return NextResponse.json({ turn: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("turn persistence failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
