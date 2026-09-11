import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = await request.json();
    const response = await fetch(`${AI_ENGINE_URL}/v1/interview/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("AI question proxy failed", error);
    return NextResponse.json({ error: "AI engine unavailable" }, { status: 503 });
  }
}
