import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../lib/auth";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain"]);

function extractBasicText(buffer: Buffer, type: string) {
  if (type === "text/plain") return buffer.toString("utf8").slice(0, 100_000);
  // PDF parsing is intentionally deferred to the worker layer; storing the upload
  // contract now lets us add object storage + a real parser without changing the API.
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const candidate = await query<{ id: string }>("select id from candidates where user_id = $1", [session.userId]);
    const candidateId = candidate.rows[0]?.id;
    if (!candidateId) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A resume file is required" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Only PDF and TXT resumes are supported" }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Resume must be 5 MB or smaller" }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = extractBasicText(buffer, file.type);
    const fileUrl = `pending://${candidateId}/${crypto.randomUUID()}/${encodeURIComponent(file.name)}`;

    const result = await query(
      `insert into resumes (candidate_id, file_url, file_name, extracted_text, parsed_json)
       values ($1, $2, $3, $4, $5)
       returning id, file_name, extracted_text, parsed_json, created_at`,
      [candidateId, fileUrl, file.name, extractedText, extractedText ? JSON.stringify({ source: "text", status: "ready" }) : JSON.stringify({ source: "pdf", status: "pending_parser" })],
    );

    return NextResponse.json({ resume: result.rows[0], parserStatus: extractedText ? "ready" : "pending_parser" }, { status: 201 });
  } catch (error) {
    console.error("resume upload failed", error);
    return NextResponse.json({ error: "Could not process resume" }, { status: 503 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const result = await query(
      `select r.id, r.file_name, r.parsed_json, r.created_at
       from resumes r join candidates c on c.id = r.candidate_id
       where c.user_id = $1 order by r.created_at desc limit 10`,
      [session.userId],
    );
    return NextResponse.json({ resumes: result.rows });
  } catch (error) {
    console.error("resume history failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
