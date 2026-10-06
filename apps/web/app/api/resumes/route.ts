import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../lib/auth";
import { extractPdfText, parseResumeText } from "../../../lib/resume-parser";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 100_000;
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain"]);

function storageClient() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, client: new S3Client({ region: process.env.S3_REGION || "auto", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: Boolean(process.env.S3_ENDPOINT), credentials: { accessKeyId, secretAccessKey } }) };
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
    if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Resume must be between 1 byte and 5 MB" }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = (file.type === "application/pdf" ? await extractPdfText(buffer) : buffer.toString("utf8")).slice(0, MAX_TEXT).trim();
    if (!extractedText) return NextResponse.json({ error: "Could not extract readable text from the resume" }, { status: 422 });
    const parsedJson = { source: file.type === "application/pdf" ? "pdf" : "text", status: "ready", version: 2, context: parseResumeText(extractedText) };

    const storage = storageClient();
    if (!storage) return NextResponse.json({ error: "Resume storage is not configured" }, { status: 503 });
    const objectKey = `resumes/${candidateId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await storage.client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: objectKey, Body: buffer, ContentType: file.type, Metadata: { candidateId, originalName: file.name } }));

    const result = await query(`insert into resumes (candidate_id, file_url, file_name, extracted_text, parsed_json) values ($1, $2, $3, $4, $5) returning id, file_name, extracted_text, parsed_json, created_at`, [candidateId, `s3://${storage.bucket}/${objectKey}`, file.name, extractedText, JSON.stringify(parsedJson)]);
    return NextResponse.json({ resume: result.rows[0], parserStatus: "ready" }, { status: 201 });
  } catch (error) {
    console.error("resume upload failed", error);
    return NextResponse.json({ error: "Could not process resume" }, { status: 503 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const result = await query(`select r.id, r.file_name, r.parsed_json, r.created_at from resumes r join candidates c on c.id = r.candidate_id where c.user_id = $1 order by r.created_at desc limit 10`, [session.userId]);
    return NextResponse.json({ resumes: result.rows });
  } catch (error) {
    console.error("resume history failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
