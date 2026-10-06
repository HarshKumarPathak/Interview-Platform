import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";

function authorized(request: Request) {
  const expected = process.env.LIVEKIT_AGENT_SHARED_SECRET;
  return Boolean(expected && request.headers.get("x-livekit-agent-secret") === expected);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ interviewId: string }> },
) {
  if (!authorized(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { interviewId } = await params;
    const result = await query(
      `select
         i.id, i.type, i.difficulty, i.duration_minutes, i.language, i.panel_size, i.status,
         c.id as candidate_id, c.display_name, c.headline, c.college, c.degree, c.graduation_year,
         r.parsed_json
       from interviews i
       join candidates c on c.id = i.candidate_id
       left join lateral (
         select parsed_json
         from resumes
         where candidate_id = c.id
         order by created_at desc
         limit 1
       ) r on true
       where i.id = $1
       limit 1`,
      [interviewId],
    );

    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const turns = await query<{ speaker: string; role: string | null; content: string; metadata: unknown }>(
      `select speaker, role, content, metadata
       from interview_turns
       where interview_id = $1
       order by sequence desc
       limit 12`,
      [interviewId],
    );

    return NextResponse.json({
      interview: {
        id: row.id,
        type: row.type,
        difficulty: row.difficulty,
        duration_minutes: row.duration_minutes,
        language: row.language,
        panel_size: row.panel_size,
        status: row.status,
      },
      candidate: {
        id: row.candidate_id,
        display_name: row.display_name,
        headline: row.headline,
        college: row.college,
        degree: row.degree,
        graduation_year: row.graduation_year,
      },
      resume: row.parsed_json ?? null,
      recent_turns: turns.rows.reverse(),
    });
  } catch (error) {
    console.error("internal interview context failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
