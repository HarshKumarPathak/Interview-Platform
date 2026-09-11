import { NextResponse } from "next/server";
import { query } from "@interview-platform/database";
import { getSession } from "../../../lib/auth";

type Turn = { speaker: string; content: string; role: string | null; metadata?: Record<string, unknown> | null };
type QuestionEvaluation = { questionNumber: number; interviewerRole: string; stage: string; question: string; answer: string; score: number; evidenceScore: number; structureScore: number; relevanceScore: number; feedback: string; missingElements: string[]; followUpReason: string | null };

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value * 10) / 10)); }
function signal(text: string, patterns: RegExp[]) { return patterns.some((pattern) => pattern.test(text)); }

function evaluateQuestion(question: string, answer: string, role: string | null, metadata?: Record<string, unknown> | null, questionNumber = 1): QuestionEvaluation {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const evidence = signal(answer, [/example/i, /result/i, /impact/i, /metric/i, /%/, /users?/i, /latency/i, /revenue/i, /tested/i, /measured/i]) ? 78 : words >= 70 ? 58 : 35;
  const structure = signal(answer, [/first/i, /second/i, /finally/i, /then/i, /because/i, /therefore/i, /situation/i, /task/i, /action/i, /result/i]) ? 78 : words >= 50 ? 55 : 38;
  const relevance = words < 12 ? 30 : signal(answer, [/because/i, /approach/i, /problem/i, /decision/i, /experience/i, /project/i]) ? 82 : 62;
  const score = clamp(evidence * 0.4 + structure * 0.3 + relevance * 0.3);
  const missing: string[] = [];
  if (evidence < 60) missing.push("concrete evidence or measurable outcome");
  if (structure < 60) missing.push("clear answer structure and reasoning");
  if (relevance < 60) missing.push("a direct connection to the question");
  const followUpReason = typeof metadata?.rationale === "string" ? metadata.rationale : null;
  const feedback = missing.length === 0
    ? "Strong response: you connected the decision to reasoning and supporting evidence. Make the outcome even more specific when possible."
    : `The answer is usable, but it would be stronger with ${missing.join(", ")}.`;
  return { questionNumber, interviewerRole: role ?? "interviewer", stage: typeof metadata?.stage === "string" ? metadata.stage : "unknown", question, answer, score, evidenceScore: clamp(evidence), structureScore: clamp(structure), relevanceScore: clamp(relevance), feedback, missingElements: missing, followUpReason };
}

function pairTurns(turns: Turn[]) {
  const pairs: Array<{ question: Turn; answer: Turn }> = [];
  for (let index = 0; index < turns.length; index += 1) {
    if (turns[index].speaker !== "interviewer") continue;
    const answer = turns.slice(index + 1).find((turn) => turn.speaker === "candidate");
    if (answer) pairs.push({ question: turns[index], answer });
  }
  return pairs;
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
  const strengths = [answers.length >= 4 ? "Consistent participation across the interview." : "You attempted the interview questions and provided usable responses.", detailSignals >= 2 ? "Several answers included concrete evidence, examples, or outcomes." : "Your answers provide a starting point for deeper evidence-based responses.", structureSignals >= 2 ? "You used some sequencing or problem-solving structure in your responses." : "There are opportunities to make answer structure more explicit."];
  const weaknesses = [avgWords < 45 ? "Several answers were brief; add context, decisions, and measurable outcomes." : avgWords > 180 ? "Some answers were lengthy; lead with the key point and trim repetition." : "Keep answers focused around the decision, reasoning, and outcome.", detailSignals < 2 ? "Add concrete examples, trade-offs, and measurable impact instead of only describing tasks." : "Strengthen examples with clearer metrics and before/after outcomes where possible.", structureSignals < 2 ? "Use a repeatable structure such as Situation → Action → Result for behavioral answers." : "Make the beginning and conclusion of each answer more explicit."];
  const recommendations = ["For every major claim, add one concrete example and explain your personal contribution.", "State the technical or business trade-off before describing the final decision.", "End answers with an outcome, metric, lesson, or what you would change next time."];
  const questions = pairTurns(turns).map(({ question, answer }, index) => evaluateQuestion(question.content, answer.content, question.role, question.metadata, index + 1));
  return { overall, knowledge, communication, structure, followUp, strengths, weaknesses, recommendations, flags: [] as string[], questions };
}

async function candidateForSession() { const session = await getSession(); if (!session) return null; const result = await query<{ id: string }>("select id from candidates where user_id = $1", [session.userId]); return result.rows[0]?.id ?? null; }

export async function POST(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { interviewId } = await request.json();
    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
    const ownership = await query<{ id: string }>("select id from interviews where id = $1 and candidate_id = $2", [String(interviewId), candidateId]);
    if (!ownership.rowCount) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    const turns = await query<Turn>("select speaker, content, role, metadata from interview_turns where interview_id = $1 order by sequence_no asc", [String(interviewId)]);
    const result = evaluate(turns.rows);
    const saved = await query(`insert into evaluations (interview_id, overall_score, knowledge_score, communication_score, structure_score, follow_up_score, strengths, weaknesses, recommendations, flags) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb) on conflict (interview_id) do update set overall_score=excluded.overall_score, knowledge_score=excluded.knowledge_score, communication_score=excluded.communication_score, structure_score=excluded.structure_score, follow_up_score=excluded.follow_up_score, strengths=excluded.strengths, weaknesses=excluded.weaknesses, recommendations=excluded.recommendations, flags=excluded.flags, created_at=now() returning *`, [String(interviewId), result.overall, result.knowledge, result.communication, result.structure, result.followUp, JSON.stringify(result.strengths), JSON.stringify(result.weaknesses), JSON.stringify(result.recommendations), JSON.stringify(result.flags)]);
    const evaluationId = saved.rows[0].id as string;
    await query("delete from question_evaluations where evaluation_id = $1", [evaluationId]);
    for (const item of result.questions) await query(`insert into question_evaluations (evaluation_id, question_number, interviewer_role, stage, question, answer, score, evidence_score, structure_score, relevance_score, feedback, missing_elements, follow_up_reason) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`, [evaluationId, item.questionNumber, item.interviewerRole, item.stage, item.question, item.answer, item.score, item.evidenceScore, item.structureScore, item.relevanceScore, item.feedback, JSON.stringify(item.missingElements), item.followUpReason]);
    await query("update interviews set status = 'evaluated' where id = $1 and candidate_id = $2", [String(interviewId), candidateId]);
    return NextResponse.json({ evaluation: saved.rows[0], questions: result.questions });
  } catch (error) { console.error("evaluation failed", error); return NextResponse.json({ error: "Evaluation failed" }, { status: 503 }); }
}

export async function GET(request: Request) {
  try {
    const candidateId = await candidateForSession();
    if (!candidateId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const interviewId = new URL(request.url).searchParams.get("interviewId");
    if (!interviewId) return NextResponse.json({ error: "interviewId is required" }, { status: 400 });
    const result = await query(`select e.* from evaluations e join interviews i on i.id = e.interview_id where e.interview_id = $1 and i.candidate_id = $2`, [interviewId, candidateId]);
    if (!result.rows[0]) return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    const questions = await query("select question_number, interviewer_role, stage, question, answer, score, evidence_score, structure_score, relevance_score, feedback, missing_elements, follow_up_reason from question_evaluations where evaluation_id = $1 order by question_number asc", [result.rows[0].id]);
    return NextResponse.json({ evaluation: result.rows[0], questions: questions.rows });
  } catch (error) { console.error("evaluation fetch failed", error); return NextResponse.json({ error: "Database is unavailable" }, { status: 503 }); }
}
