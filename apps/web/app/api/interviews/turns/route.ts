import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../../lib/auth";

async function verifyOwnership(interviewId: string, userId: string) {
  return query<{ id: string }>(
    `select i.id from interviews i join candidates c on c.id = i.candidate_id
     where i.id = $1 and c.user_id = $2`,
    [interviewId, userId],
  );
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const url = new URL(request.url);
    const interviewId = String(url.searchParams.get("interviewId") ?? "");
    if (!interviewId) return NextResponse.json({ error: "Interview id is required" }, { status: 400 });

    const ownership = await verifyOwnership(interviewId, session.userId);
    if (!ownership.rowCount) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const result = await query(
      `select id, sequence_no, speaker, role, content, metadata, started_at, ended_at
       from interview_turns where interview_id = $1 order by sequence_no asc`,
      [interviewId],
    );
    return NextResponse.json({ turns: result.rows });
  } catch (error) {
    console.error("turn retrieval failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const interviewId = String(body.interviewId ?? "");
    const speaker = String(body.speaker ?? "");
    const content = String(body.content ?? "").trim();
    const role = body.role ? String(body.role) : null;
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : null;
    if (!interviewId || !["interviewer", "candidate", "system"].includes(speaker) || !content) {
      return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
    }

    const ownership = await verifyOwnership(interviewId, session.userId);
    if (!ownership.rowCount) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const sequence = await query<{ next_sequence: number }>(
      `select coalesce(max(sequence_no), 0) + 1 as next_sequence from interview_turns where interview_id = $1`,
      [interviewId],
    );
    const result = await query(
      `insert into interview_turns (interview_id, sequence_no, speaker, role, content, started_at, ended_at, metadata)
       values ($1, $2, $3, $4, $5, now(), now(), $6::jsonb) returning id, sequence_no`,
      [interviewId, sequence.rows[0].next_sequence, speaker, role, content, metadata ? JSON.stringify(metadata) : null],
    );
    return NextResponse.json({ turn: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("turn persistence failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
