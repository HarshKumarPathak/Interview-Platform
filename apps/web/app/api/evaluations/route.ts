import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../lib/auth";

type Turn = { speaker: string; content: string; role: string | null };

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function evaluate(turns: Turn[]) {
  const candidateTurns = turns.filter((turn) => turn.speaker === "candidate");
  const answers = candidateTurns.map((turn) => turn.content.trim()).filter(Boolean);
  const avgWords = answers.length ? answers.reduce((sum, answer) => sum + answer.split(/\s+/).length, 0) / answers.length : 0;
  const detailSignals = answers.filter((answer) => /because|therefore|trade[- ]?off|example|measured|result|impact|implemented|tested/i.test(answer)).length;
  const structureSignals = answers.filter((answer) => /first|second|finally|then|problem|approach|result|situation|task|action/i.test(answer)).length;
  const followUpPairs = turns.filter((turn) => turn.speaker === "interviewer" && turn.role === "technical_interviewer").length;

  const knowledge = clamp(45 + Math.min(35, avgWords * 0.65) + detailSignals * 3);
  const communication = clamp(48 + Math.min(30, Math.max(0, 65 - Math.abs(avgWords - 90)) * 0.45));
  const structure = clamp(42 + structureSignals * 5 + Math.min(15, avgWords / 12));
  const followUp = clamp(40 + Math.min(45, followUpPairs * 5 + detailSignals * 2));
  const overall = clamp(knowledge * 0.4 + communication * 0.2 + structure * 0.2 + followUp * 0.2);

  const strengths = [
    answers.length >= 4 ? "Consistent participation across the interview." : "You attempted the interview questions and provided usable responses.",
    detailSignals >= 2 ? "Several answers included concrete evidence, examples, or outcomes." : "Your answers provide a starting point for deeper evidence-based responses.",
    structureSignals >= 2 ? "You used some sequencing or problem-solving structure in your responses." : "There are opportunities to make answer structure more explicit.",
  ];
  const weaknesses = [
    avgWords < 45 ? "Several answers were brief; add context, decisions, and measurable outcomes." : avgWords > 180 ? "Some answers were lengthy; lead with the key point and trim repetition." : "Keep answers focused around the decision, reasoning, and outcome.",
    detailSignals < 2 ? "Add concrete examples, trade-offs, and measurable impact instead of only describing tasks." : "Strengthen examples with clearer metrics and before/after outcomes where possible.",
    structureSignals < 2 ? "Use a repeatable structure such as Situation → Action → Result for behavioral answers." : "Make the beginning and conclusion of each answer more explicit.",
  ];
  const recommendations = [
    "For every major claim, add one concrete example and explain your personal contribution.",
    "State the technical or business trade-off before describing the final decision.",
    "End answers with an outcome, metric, lesson, or what you would change next time.",
  ];

  return { overall, knowledge, communication, structure, followUp, strengths, weaknesses, recommendations, flags: [] as string[] };
}

async function candidateForSession() {
  const session = await getSession();
  if (!session) return null;
  const result = await query<{ id: string }>("select id from candidates where user_id = $1", [session.userId]);
  return result.rows[0]?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { interviewId } = await request.json();
    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });

    const ownership = await query<{ id: string }>(
      "select id from interviews where id = $1 and candidate_id = $2",
      [String(interviewId), candidateId],
    );
    if (!ownership.rowCount) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    const turns = await query<Turn>(
      "select speaker, content, role from interview_turns where interview_id = $1 order by sequence_no asc",
      [String(interviewId)],
    );
    const result = evaluate(turns.rows);

    const saved = await query(
      `insert into evaluations (interview_id, overall_score, knowledge_score, communication_score, structure_score, follow_up_score, strengths, weaknesses, recommendations, flags)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb)
       on conflict (interview_id) do update set overall_score=excluded.overall_score, knowledge_score=excluded.knowledge_score, communication_score=excluded.communication_score, structure_score=excluded.structure_score, follow_up_score=excluded.follow_up_score, strengths=excluded.strengths, weaknesses=excluded.weaknesses, recommendations=excluded.recommendations, flags=excluded.flags, created_at=now()
       returning *`,
      [String(interviewId), result.overall, result.knowledge, result.communication, result.structure, result.followUp, JSON.stringify(result.strengths), JSON.stringify(result.weaknesses), JSON.stringify(result.recommendations), JSON.stringify(result.flags)],
    );

    await query("update interviews set status = 'evaluated' where id = $1 and candidate_id = $2", [String(interviewId), candidateId]);
    return NextResponse.json({ evaluation: saved.rows[0] });
  } catch (error) {
    console.error("evaluation failed", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const interviewId = new URL(request.url).searchParams.get("interviewId");
    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
    const result = await query(
      `select e.* from evaluations e join interviews i on i.id = e.interview_id where e.interview_id = $1 and i.candidate_id = $2`,
      [interviewId, candidateId],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    return NextResponse.json({ evaluation: result.rows[0] });
  } catch (error) {
    console.error("evaluation fetch failed", error);
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 });
  }
}
