export type ResumeContext = {
  contact: { name?: string; email?: string; phone?: string; location?: string; links?: string[] };
  summary?: string;
  education: Array<{ institution?: string; degree?: string; year?: string; details?: string }>;
  experience: Array<{ company?: string; role?: string; dates?: string; bullets: string[] }>;
  projects: Array<{ name?: string; description?: string; technologies: string[]; bullets: string[] }>;
  skills: string[];
  certifications: string[];
  achievements: string[];
};

const MAX_TEXT = 100_000;
const SECTION_NAMES = ["summary", "profile", "education", "experience", "work experience", "projects", "skills", "technical skills", "certifications", "achievements"];

function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function lines(text: string) { return text.slice(0, MAX_TEXT).split(/\r?\n/).map(clean).filter(Boolean); }
function sectionize(input: string) {
  const result: Record<string, string[]> = {};
  let current = "other";
  for (const line of lines(input)) {
    const normalized = line.toLowerCase().replace(/[:#-]+$/, "").trim();
    const section = SECTION_NAMES.find((name) => normalized === name);
    if (section) { current = section; result[current] ??= []; } else { result[current] ??= []; result[current].push(line); }
  }
  return result;
}
function listItems(values: string[]) { return values.flatMap((line) => line.split(/\s*[•▪●]\s*|\s*;\s*/).map(clean)).filter(Boolean); }

export function parseResumeText(input: string): ResumeContext {
  const sections = sectionize(input);
  const all = lines(input);
  const email = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = input.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0];
  const urls = input.match(/https?:\/\/[^\s)]+/gi) ?? [];
  const name = all.find((line) => line.length >= 3 && line.length <= 60 && !line.includes("@") && !/^https?:/i.test(line));
  const education = listItems(sections.education ?? []).map((value) => ({ institution: value, year: value.match(/\b(?:19|20)\d{2}\b/)?.[0] }));
  const experience = listItems([...(sections.experience ?? []), ...(sections["work experience"] ?? [])]).map((value) => ({
    role: value.split(/\s+at\s+|\s+@\s+/i)[0]?.trim(), company: value.match(/\s+(?:at|@)\s+(.+)$/i)?.[1]?.trim(),
    dates: value.match(/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}|\b(?:19|20)\d{2}\s*[-–]\s*(?:Present|Current)\b/i)?.[0], bullets: [value],
  }));
  const projects = listItems(sections.projects ?? []).map((value) => ({ name: value, technologies: extractTechnologies(value), bullets: [value] }));
  const skills = listItems([...(sections.skills ?? []), ...(sections["technical skills"] ?? [])]).flatMap((value) => value.split(/,|\||·/).map(clean)).filter(Boolean);
  return { contact: { name, email, phone, links: urls.slice(0, 10) }, summary: clean([...(sections.summary ?? []), ...(sections.profile ?? [])].join(" ")) || undefined, education, experience, projects, skills: [...new Set(skills)].slice(0, 100), certifications: listItems(sections.certifications ?? []).slice(0, 50), achievements: listItems(sections.achievements ?? []).slice(0, 50) };
}

/** Extract text from a PDF buffer. Kept server-only; never expose raw PDF bytes to the browser. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.slice(0, MAX_TEXT).trim();
  } finally {
    await parser.destroy();
  }
}

function extractTechnologies(value: string) {
  const known = ["typescript", "javascript", "python", "java", "c++", "react", "next.js", "node.js", "fastapi", "postgresql", "mongodb", "docker", "aws", "azure", "gcp", "tensorflow", "pytorch", "scikit-learn", "sql", "git"];
  const lower = value.toLowerCase();
  return known.filter((technology) => lower.includes(technology));
}
