import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";

const allowedTypes = new Set(["placement", "hr", "upsc", "college", "mba", "ssb"]);
const allowedDifficulty = new Set(["easy", "adaptive", "hard"]);
const allowedLanguages = new Set(["English", "Hindi", "Hinglish"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const candidateId = String(body.candidateId ?? "");
    const type = String(body.type ?? "");
    const difficulty = String(body.difficulty ?? "adaptive");
    const durationMinutes = Number(body.durationMinutes);
    const language = String(body.language ?? "English");
    const panelSize = Number(body.panelSize ?? 1);

    if (!candidateId || !allowedTypes.has(type) || !allowedDifficulty.has(difficulty) || !allowedLanguages.has(language) || ![15, 30, 45, 60].includes(durationMinutes) || ![1, 2, 3].includes(panelSize)) {
      return NextResponse.json({ error: "Invalid interview configuration" }, { status: 400 });
    }

    const result = await query<{ id: string; status: string }>(
      `insert into interviews (candidate_id, type, difficulty, duration_minutes, language, panel_size, status)
       values ($1, $2, $3::difficulty_level, $4, $5, $6, 'ready')
       returning id, status`,
      [candidateId, type, difficulty, durationMinutes, language, panelSize],
    );

    return NextResponse.json({ interview: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("interview create failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  try {
    const candidateId = new URL(request.url).searchParams.get("candidateId");
    if (!candidateId) return NextResponse.json({ error: "candidateId is required" }, { status: 400 });

    const result = await query(
      `select id, type, difficulty, duration_minutes, language, panel_size, status, started_at, completed_at, created_at
       from interviews where candidate_id = $1 order by created_at desc limit 50`,
      [candidateId],
    );
    return NextResponse.json({ interviews: result.rows });
  } catch (error) {
    console.error("interview history failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
