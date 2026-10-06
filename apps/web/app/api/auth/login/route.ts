import { headers } from "next/headers";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { createSession, verifyPassword } from "../../../../lib/auth";

function getClientIp(headerValue: string | null) {
  const candidate = headerValue?.split(",")[0]?.trim() || null;
  return candidate && isIP(candidate) ? candidate : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

    const result = await query<{ id: string; password_hash: string }>("select id, password_hash from users where email = $1", [email]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const candidate = await query(
      `select id, email, display_name, headline, college, degree, graduation_year from candidates where user_id = $1`,
      [user.id],
    );

    const requestHeaders = await headers();
    const forwardedIp = getClientIp(requestHeaders.get("x-forwarded-for"));
    const realIp = getClientIp(requestHeaders.get("x-real-ip"));
    const userAgent = requestHeaders.get("user-agent");
    await query(
      `insert into login_events (user_id, ip_address, user_agent) values ($1, $2::inet, $3)`,
      [user.id, forwardedIp ?? realIp, userAgent || null],
    );

    await createSession(user.id);
    return NextResponse.json({ candidate: candidate.rows[0] ?? null });
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json({ error: "Could not sign in. Check your database configuration." }, { status: 503 });
  }
}
