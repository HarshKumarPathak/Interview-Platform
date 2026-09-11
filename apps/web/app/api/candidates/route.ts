import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim();

    if (!email || !displayName) {
      return NextResponse.json({ error: "email and displayName are required" }, { status: 400 });
    }

    const result = await query(
      `insert into candidates (email, display_name, headline, college, degree, graduation_year)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (email) do update set
         display_name = excluded.display_name,
         headline = excluded.headline,
         college = excluded.college,
         degree = excluded.degree,
         graduation_year = excluded.graduation_year,
         updated_at = now()
       returning id, email, display_name, headline, college, degree, graduation_year`,
      [email, displayName, body.headline ?? null, body.college ?? null, body.degree ?? null, body.graduationYear ? Number(body.graduationYear) : null],
    );

    return NextResponse.json({ candidate: result.rows[0] });
  } catch (error) {
    console.error("candidate create failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
