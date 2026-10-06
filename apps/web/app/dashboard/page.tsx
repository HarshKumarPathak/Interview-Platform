import Link from "next/link";
import { query } from "@interview-platform/database";
import { getSession } from "../../lib/auth";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function score(value: unknown) {
  return typeof value === "number" ? Math.round(value) : "—";
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return <main className="product-shell"><section className="container" style={{ padding: "96px 0", maxWidth: 720 }}><div className="eyebrow"><span /> Candidate dashboard</div><h1>Sign in to see your interview progress.</h1><p>Your dashboard tracks completed interviews, scores, focus areas, and recent practice.</p><div style={{ marginTop: 24 }}><Link href="/login" className="button button-primary">Sign in →</Link></div></section></main>;

  const candidateResult = await query<{ id: string; display_name: string | null }>("select id, display_name from candidates where user_id = $1", [session.userId]);
  const candidate = candidateResult.rows[0];
  if (!candidate) return <main className="product-shell"><section className="container" style={{ padding: "96px 0", maxWidth: 720 }}><h1>Complete your candidate profile.</h1><p>We need a candidate profile before we can build your dashboard.</p><div style={{ marginTop: 24 }}><Link href="/profile" className="button button-primary">Open profile →</Link></div></section></main>;

  const [statsResult, recentResult, focusResult] = await Promise.all([
    query<{ total: string; completed: string; average_score: number | null }>(`select count(*)::text as total, count(*) filter (where status in ('completed','evaluating','evaluated'))::text as completed, avg(e.overall_score) filter (where e.overall_score is not null) as average_score from interviews i left join evaluations e on e.interview_id = i.id where i.candidate_id = $1`, [candidate.id]),
    query<{ id: string; type: string; status: string; overall_score: number | null; created_at: string }>(`select i.id, i.type, i.status, e.overall_score, i.created_at from interviews i left join evaluations e on e.interview_id = i.id where i.candidate_id = $1 order by i.created_at desc limit 5`, [candidate.id]),
    query<{ knowledge: number | null; communication: number | null; structure: number | null; follow_up: number | null }>(`select avg(knowledge_score) as knowledge, avg(communication_score) as communication, avg(structure_score) as structure, avg(follow_up_score) as follow_up from evaluations e join interviews i on i.id = e.interview_id where i.candidate_id = $1`, [candidate.id]),
  ]);

  const stats = statsResult.rows[0] ?? { total: "0", completed: "0", average_score: null };
  const focus = focusResult.rows[0] ?? { knowledge: null, communication: null, structure: null, follow_up: null };
  const focusValues = [["Technical knowledge", score(focus.knowledge)], ["Answer structure", score(focus.structure)], ["Communication", score(focus.communication)], ["Follow-up handling", score(focus.follow_up)]] as const;
  const bestFocus = focusValues.filter(([, value]) => typeof value === "number").sort((a, b) => Number(a[1]) - Number(b[1]))[0];
  const readiness = stats.average_score == null ? "—" : Math.round(stats.average_score);

  return <main className="product-shell">
    <nav className="product-nav container"><Link href="/" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div className="product-nav-links"><Link href="/dashboard">Dashboard</Link><Link href="/history">History</Link><Link href="/profile">Profile</Link></div><Link href="/interview/new" className="button button-primary">Start interview →</Link></nav>
    <section className="dashboard container">
      <div className="dashboard-header"><div><div className="eyebrow"><span /> Candidate dashboard</div><h1>Good to see you, {candidate.display_name || "candidate"}.</h1><p>Build consistency by practicing realistic interviews and reviewing evidence from your previous sessions.</p></div><Link href="/interview/new" className="button button-primary button-large">Start a new interview <span>→</span></Link></div>
      <div className="stat-grid"><article><span>Average score</span><strong>{readiness}{readiness !== "—" ? "%" : ""}</strong><small>Across evaluated interviews</small></article><article><span>Interviews</span><strong>{stats.total}</strong><small>{stats.completed} completed or evaluated</small></article><article><span>Evaluation</span><strong>{stats.average_score == null ? "—" : "Ready"}</strong><small>Evidence-based scoring</small></article><article><span>Top focus</span><strong>{bestFocus?.[0] ?? "Build baseline"}</strong><small>{bestFocus ? `Current average: ${bestFocus[1]}` : "Complete an interview to unlock insights"}</small></article></div>
      <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">Practice</span><h2>Choose your next interview</h2></div></div><div className="quick-grid"><Link href="/interview/new?type=placement" className="quick-card"><span>01</span><strong>Software Engineering</strong><small>Technical + projects + behavioral</small></Link><Link href="/interview/new?type=hr" className="quick-card"><span>02</span><strong>HR / Behavioral</strong><small>Communication + situational questions</small></Link><Link href="/interview/new?type=upsc" className="quick-card"><span>03</span><strong>UPSC / Govt.</strong><small>Formal board-style simulation</small></Link></div></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">Your progress</span><h2>Focus areas</h2></div></div><div className="focus-list">{focusValues.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div></section></div>
      <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">History</span><h2>Recent interviews</h2></div><Link href="/history">View all →</Link></div>{recentResult.rows.length ? recentResult.rows.map((item) => <Link href={`/results?interviewId=${item.id}`} className="history-row" key={item.id}><div><strong>{item.type}</strong><span>{formatDate(item.created_at)}</span></div><span className={`status ${item.status === "evaluated" ? "status-done" : ""}`}>{item.status.replaceAll("_", " ")}</span><b>{score(item.overall_score)}</b></Link>) : <div className="history-row"><div><strong>No interviews yet</strong><span>Start your first realistic simulation.</span></div><span className="status">Ready</span><b>—</b></div>}</section>
    </section>
  </main>;
}
