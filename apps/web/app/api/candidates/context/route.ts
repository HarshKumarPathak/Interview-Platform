import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../../lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const candidate = await query(
      `select id, email, display_name, headline, college, degree, graduation_year
       from candidates where user_id = $1`,
      [session.userId],
    );
    const row = candidate.rows[0];
    if (!row) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 });

    const resume = await query(
      `select id, file_name, extracted_text, parsed_json, created_at
       from resumes where candidate_id = $1 order by created_at desc limit 1`,
      [row.id],
    );

    return NextResponse.json({
      candidate: row,
      resume: resume.rows[0] ?? null,
      contextVersion: 1,
    });
  } catch (error) {
    console.error("candidate context lookup failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
