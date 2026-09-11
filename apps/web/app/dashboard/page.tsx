import Link from "next/link";

const recent = [
  { type: "Software Engineering", date: "Today", score: "—", status: "Not started" },
  { type: "HR / Behavioral", date: "Yesterday", score: "76", status: "Completed" },
  { type: "Technical Screening", date: "Sep 7", score: "82", status: "Completed" },
];

export default function DashboardPage() {
  return (
    <main className="product-shell">
      <nav className="product-nav container">
        <Link href="/" className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></Link>
        <div className="product-nav-links"><Link href="/dashboard">Dashboard</Link><Link href="/history">History</Link><Link href="/profile">Profile</Link></div>
        <Link href="/interview/new" className="button button-primary">Start interview →</Link>
      </nav>
      <section className="dashboard container">
        <div className="dashboard-header"><div><div className="eyebrow"><span /> Candidate dashboard</div><h1>Good to see you, Harsh.</h1><p>Build consistency by practicing realistic interviews and reviewing your patterns.</p></div><Link href="/interview/new" className="button button-primary button-large">Start a new interview <span>→</span></Link></div>
        <div className="stat-grid"><article><span>Readiness</span><strong>74%</strong><small>↑ 8% this month</small></article><article><span>Interviews</span><strong>12</strong><small>3 this month</small></article><article><span>Average score</span><strong>76</strong><small>↑ 5 points</small></article><article><span>Top focus</span><strong>Structure</strong><small>Improve answer openings</small></article></div>
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Practice</span><h2>Choose your next interview</h2></div></div><div className="quick-grid"><Link href="/interview/new?type=placement" className="quick-card"><span>01</span><strong>Software Engineering</strong><small>Technical + projects + behavioral</small></Link><Link href="/interview/new?type=hr" className="quick-card"><span>02</span><strong>HR / Behavioral</strong><small>Communication + situational questions</small></Link><Link href="/interview/new?type=upsc" className="quick-card"><span>03</span><strong>UPSC / Govt.</strong><small>Formal board-style simulation</small></Link></div></section>
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Your progress</span><h2>Focus areas</h2></div></div><div className="focus-list"><div><span>Technical knowledge</span><b>84</b></div><div><span>Answer structure</span><b>68</b></div><div><span>Communication</span><b>74</b></div><div><span>Follow-up handling</span><b>71</b></div></div></section>
        </div>
        <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">History</span><h2>Recent interviews</h2></div><Link href="/history">View all →</Link></div>{recent.map((item) => <div className="history-row" key={item.type}><div><strong>{item.type}</strong><span>{item.date}</span></div><span className={`status ${item.status === "Completed" ? "status-done" : ""}`}>{item.status}</span><b>{item.score}</b></div>)}</section>
      </section>
    </main>
  );
}
