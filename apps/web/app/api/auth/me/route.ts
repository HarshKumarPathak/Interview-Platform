import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../../lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });

    const result = await query(
      `select c.id, c.email, c.display_name, c.headline, c.college, c.degree, c.graduation_year
       from candidates c where c.user_id = $1`,
      [session.userId],
    );
    if (!result.rows[0]) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, candidate: result.rows[0] });
  } catch (error) {
    console.error("session lookup failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
