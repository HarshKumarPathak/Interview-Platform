import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const displayName = String(body.displayName ?? "").trim();
    if (!displayName) return NextResponse.json({ error: "displayName is required" }, { status: 400 });

    const result = await query(
      `update candidates set
         display_name = $2,
         headline = $3,
         college = $4,
         degree = $5,
         graduation_year = $6,
         updated_at = now()
       where user_id = $1
       returning id, email, display_name, headline, college, degree, graduation_year`,
      [session.userId, displayName, body.headline ?? null, body.college ?? null, body.degree ?? null, body.graduationYear ? Number(body.graduationYear) : null],
    );

    if (!result.rowCount) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 });
    return NextResponse.json({ candidate: result.rows[0] });
  } catch (error) {
    console.error("candidate update failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
