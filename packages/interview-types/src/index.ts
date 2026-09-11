export type InterviewType =
  | "placement"
  | "hr"
  | "upsc"
  | "college"
  | "mba"
  | "ssb";

export type Difficulty = "easy" | "adaptive" | "hard";
export type InterviewLanguage = "English" | "Hindi" | "Hinglish";
export type PanelSize = 1 | 2 | 3;

export interface InterviewConfig {
  type: InterviewType;
  difficulty: Difficulty;
  durationMinutes: 15 | 30 | 45 | 60;
  language: InterviewLanguage;
  panelSize: PanelSize;
}

export interface InterviewTypeDefinition {
  id: InterviewType;
  title: string;
  description: string;
  stages: string[];
  defaultRoles: string[];
}

export const INTERVIEW_TYPES: InterviewTypeDefinition[] = [
  { id: "placement", title: "Software Engineering", description: "Technical, projects and behavioral", stages: ["intro", "projects", "technical", "behavioral", "close"], defaultRoles: ["technical"] },
  { id: "hr", title: "HR / Behavioral", description: "Communication and situational", stages: ["intro", "background", "situational", "behavioral", "close"], defaultRoles: ["hr"] },
  { id: "upsc", title: "UPSC / Govt.", description: "Formal board-style practice", stages: ["intro", "background", "current_affairs", "situational", "close"], defaultRoles: ["chairperson", "subject"] },
  { id: "college", title: "College", description: "Academic and personal interview", stages: ["intro", "academics", "projects", "behavioral", "close"], defaultRoles: ["academic"] },
  { id: "mba", title: "MBA", description: "Business, case and personal", stages: ["intro", "profile", "case", "leadership", "close"], defaultRoles: ["business", "hr"] },
  { id: "ssb", title: "SSB", description: "Board-style interview simulation", stages: ["intro", "background", "situational", "leadership", "close"], defaultRoles: ["interviewing_officer"] },
];
