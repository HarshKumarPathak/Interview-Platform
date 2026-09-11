import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { createSession, hashPassword } from "../../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim();

    if (!email || !displayName || password.length < 8) {
      return NextResponse.json({ error: "Name, email and an 8+ character password are required" }, { status: 400 });
    }

    const existing = await query<{ id: string }>("select id from users where email = $1", [email]);
    if (existing.rowCount) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const user = await query<{ id: string }>(
      "insert into users (email, password_hash) values ($1, $2) returning id",
      [email, passwordHash],
    );
    const userId = user.rows[0].id;

    const candidate = await query(
      `insert into candidates (user_id, email, display_name)
       values ($1, $2, $3)
       returning id, email, display_name, headline, college, degree, graduation_year`,
      [userId, email, displayName],
    );

    await createSession(userId);
    return NextResponse.json({ candidate: candidate.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("registration failed", error);
    return NextResponse.json({ error: "Could not create account. Check your database configuration." }, { status: 503 });
  }
}
