import Link from "next/link";
import { query } from "@interview-platform/database";
import { getSession } from "../../lib/auth";

function formatDate(value: string | Date | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) return <main className="product-shell"><section className="container" style={{ padding: "96px 0", maxWidth: 720 }}><div className="eyebrow"><span /> Admin</div><h1>Admin sign-in required.</h1><p>Sign in with an administrator account to view platform activity.</p><div style={{ marginTop: 24 }}><Link href="/login" className="button button-primary">Sign in →</Link></div></section></main>;

  const userResult = await query<{ role: string }>("select role from users where id = $1", [session.userId]);
  if (userResult.rows[0]?.role !== "admin") return <main className="product-shell"><section className="container" style={{ padding: "96px 0", maxWidth: 720 }}><div className="eyebrow"><span /> Restricted</div><h1>Admin access required.</h1><p>This dashboard is intentionally unavailable to candidate accounts.</p><div style={{ marginTop: 24 }}><Link href="/dashboard" className="button button-primary">Back to dashboard →</Link></div></section></main>;

  const [statsResult, usersResult, activityResult] = await Promise.all([
    query<{ total_users: string; active_today: string; total_interviews: string; evaluated_interviews: string }>(`select (select count(*)::text from users where role = 'candidate') as total_users, (select count(distinct user_id)::text from login_events where created_at >= current_date) as active_today, (select count(*)::text from interviews) as total_interviews, (select count(*)::text from interviews where status = 'evaluated') as evaluated_interviews`),
    query<{ user_id: string; display_name: string | null; joined_at: string; last_login: string | null; login_count: string; interview_count: string }>(`select u.id as user_id, c.display_name, u.created_at as joined_at, max(le.created_at) as last_login, count(distinct le.id)::text as login_count, count(distinct i.id)::text as interview_count from users u left join login_events le on le.user_id = u.id left join candidates c on c.user_id = u.id left join interviews i on i.candidate_id = c.id where u.role = 'candidate' group by u.id, c.display_name, u.created_at order by coalesce(max(le.created_at), u.created_at) desc limit 100`),
    query<{ user_id: string; display_name: string | null; created_at: string }>(`select le.user_id, c.display_name, le.created_at from login_events le left join candidates c on c.user_id = le.user_id order by le.created_at desc limit 20`),
  ]);
  const stats = statsResult.rows[0] ?? { total_users: "0", active_today: "0", total_interviews: "0", evaluated_interviews: "0" };

  return <main className="product-shell">
    <nav className="product-nav container"><Link href="/" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link><div className="product-nav-links"><Link href="/admin">Admin</Link><Link href="/dashboard">Candidate view</Link></div></nav>
    <section className="dashboard container">
      <div className="dashboard-header"><div><div className="eyebrow"><span /> Admin analytics</div><h1>Platform activity</h1><p>Track registrations, successful logins, and interview usage from one protected view.</p></div></div>
      <div className="stat-grid"><article><span>Registered candidates</span><strong>{stats.total_users}</strong><small>Candidate accounts</small></article><article><span>Active today</span><strong>{stats.active_today}</strong><small>Unique users with a successful login today</small></article><article><span>Interviews</span><strong>{stats.total_interviews}</strong><small>All interview sessions</small></article><article><span>Evaluated</span><strong>{stats.evaluated_interviews}</strong><small>Sessions with completed AI evaluation</small></article></div>
      <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Users</span><h2>Account activity</h2></div><span>{usersResult.rows.length} shown</span></div>{usersResult.rows.map((user) => <div className="history-row" key={user.user_id}><div><strong>{user.display_name || `User ${user.user_id.slice(0, 8)}`}</strong><span>Joined {formatDate(user.joined_at)} · {user.interview_count} interviews</span></div><span className="status">{user.login_count} logins</span><b>{formatDate(user.last_login)}</b></div>)}</section>
      <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Authentication</span><h2>Recent successful logins</h2></div><span>Latest 20</span></div>{activityResult.rows.map((event, index) => <div className="history-row" key={`${event.user_id}-${event.created_at}-${index}`}><div><strong>{event.display_name || `User ${event.user_id.slice(0, 8)}`}</strong><span>Successful authentication</span></div><span className="status status-done">Login</span><b>{formatDate(event.created_at)}</b></div>)}</section>
    </section>
  </main>;
}
