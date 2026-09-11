import Link from "next/link";

const interviewTypes = [
  { title: "Placement", description: "Technical, HR and role-specific interviews", tag: "Jobs" },
  { title: "JEE / NEET", description: "Academic and viva-style questioning", tag: "Exams" },
  { title: "UPSC / Govt.", description: "Structured, formal board-style practice", tag: "Competitive" },
  { title: "SSB", description: "Board-style interview simulation", tag: "Defence" },
  { title: "College", description: "Admissions, scholarships and academic interviews", tag: "Education" },
  { title: "MBA", description: "Business, case and personal interviews", tag: "Management" },
];

const steps = [
  ["01", "Build your profile", "Upload your resume and add the details that matter."],
  ["02", "Configure the interview", "Choose the interview type, language, difficulty and format."],
  ["03", "Face the interview", "Talk naturally using your camera and microphone while the AI adapts."],
  ["04", "Get your result", "Receive an evidence-based report after the session is evaluated."],
];

export default function Home() {
  return (
    <main>
      <nav className="nav container"><div className="brand"><span className="brand-mark">IP</span><span>Interview Platform</span></div><div className="nav-links"><a href="#how-it-works">How it works</a><a href="#interviews">Interviews</a><Link href="/dashboard" className="button button-ghost">Dashboard</Link><Link href="/interview/new" className="button button-primary">Start practicing</Link></div></nav>
      <section className="hero container"><div className="hero-copy"><div className="eyebrow"><span /> AI-powered interview simulation</div><h1>Practice the interview.<br /><em>Not just the questions.</em></h1><p className="hero-text">Experience realistic, adaptive interviews that listen to your answers, ask follow-ups, challenge weak reasoning, and evaluate the session after you finish.</p><div className="hero-actions"><Link href="/interview/new" className="button button-primary button-large">Start a free interview <span>→</span></Link><a href="#interviews" className="button button-ghost button-large">Explore interview types</a></div><div className="trust-row"><span>✓ Camera + voice</span><span>✓ Dynamic follow-ups</span><span>✓ Detailed evaluation</span></div></div><div className="interview-preview" aria-label="Interview session preview"><div className="preview-top"><span className="live-dot" /> Live interview <span className="preview-time">12:48</span></div><div className="avatar-stage"><div className="avatar-glow" /><div className="avatar-face"><span className="eye left" /><span className="eye right" /><span className="mouth" /></div><div className="avatar-label">AI Interviewer</div></div><div className="candidate-strip"><div className="candidate-initial">H</div><div><strong>You</strong><span>Camera connected</span></div><div className="mic">◉</div></div><div className="question-card"><span>INTERVIEWER</span><p>“You mentioned leading a team in your resume. Tell me about a decision that did not go as planned.”</p><div className="wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div></div></section>
      <section className="metrics"><div className="container metric-grid"><div><strong>Realistic</strong><span>conversation-first interviews</span></div><div><strong>Adaptive</strong><span>questions shaped by your answers</span></div><div><strong>Evidence-based</strong><span>post-interview evaluation</span></div><div><strong>Private</strong><span>clear recording & retention controls</span></div></div></section>
      <section id="interviews" className="section container"><div className="section-heading"><div><div className="eyebrow">Built for every interview</div><h2>One platform. <em>Many paths.</em></h2></div><p>Start with the interview that matters to you. The same core engine adapts the structure, difficulty and evaluation criteria.</p></div><div className="type-grid">{interviewTypes.map((item) => <Link href="/interview/new" className="type-card" key={item.title}><span className="tag">{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p><span className="arrow">↗</span></Link>)}</div></section>
      <section id="how-it-works" className="section section-dark"><div className="container"><div className="section-heading light"><div><div className="eyebrow">The experience</div><h2>From setup to <em>result.</em></h2></div><p>No question bank marathon. No instant generic score. A complete interview session with context, conversation and evaluation.</p></div><div className="steps">{steps.map(([number, title, description]) => <article className="step" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>
      <section className="cta container"><div><div className="eyebrow">Your next interview starts here</div><h2>Be ready when the real interviewer asks.</h2></div><Link href="/interview/new" className="button button-primary button-large">Start practicing <span>→</span></Link></section>
      <footer className="footer container"><span>© 2026 Interview Platform</span><span>Built for realistic interview practice</span></footer>
    </main>
  );
}
