from __future__ import annotations

import os
from typing import Literal, Protocol

from fastapi import FastAPI
from pydantic import BaseModel, Field

from interview_policy import get_policy, stage_for_question

app = FastAPI(title="Interview Platform AI Engine", version="0.3.1")


class CandidateContext(BaseModel):
    name: str | None = None
    headline: str | None = None
    college: str | None = None
    degree: str | None = None
    graduation_year: int | None = None
    resume_summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)


class InterviewContext(BaseModel):
    interview_type: str
    difficulty: Literal["easy", "adaptive", "hard"] = "adaptive"
    language: str = "English"
    candidate: CandidateContext = Field(default_factory=CandidateContext)


class QuestionRequest(BaseModel):
    context: InterviewContext
    stage: str | None = None
    question_index: int = 0
    previous_answer: str | None = None
    previous_question: str | None = None


class QuestionResponse(BaseModel):
    question: str
    role: str
    rationale: str
    source: Literal["candidate_context", "adaptive_follow_up", "interview_template", "provider"]
    follow_up: bool = False
    difficulty: Literal["easy", "adaptive", "hard"] = "adaptive"
    stage: str
    question_index: int
    policy_focus: list[str]


class QuestionProvider(Protocol):
    def generate(self, request: QuestionRequest, policy_question: str) -> str | None: ...


class FallbackProvider:
    def generate(self, request: QuestionRequest, policy_question: str) -> str | None:
        return None


class OpenAICompatibleProvider:
    """Optional provider boundary; deterministic policy remains the safe fallback."""

    def __init__(self) -> None:
        self.base_url = os.getenv("AI_BASE_URL", "").rstrip("/")
        self.api_key = os.getenv("AI_API_KEY", "")
        self.model = os.getenv("AI_MODEL", "")

    def generate(self, request: QuestionRequest, policy_question: str) -> str | None:
        if not self.base_url or not self.api_key or not self.model:
            return None
        return None


def provider() -> QuestionProvider:
    if os.getenv("AI_PROVIDER", "fallback").lower() == "openai_compatible":
        return OpenAICompatibleProvider()
    return FallbackProvider()


def first_non_empty(values: list[str]) -> str | None:
    return next((value.strip() for value in values if value and value.strip()), None)


def context_topic(candidate: CandidateContext) -> tuple[str | None, str | None]:
    if candidate.projects:
        return first_non_empty(candidate.projects), "project"
    if candidate.experience:
        return first_non_empty(candidate.experience), "experience"
    if candidate.skills:
        return first_non_empty(candidate.skills), "skill"
    return None, None


def answer_signal(answer: str) -> dict[str, bool]:
    text = answer.lower()
    return {
        "evidence": any(token in text for token in ("example", "result", "impact", "metric", "%", "users")),
        "tradeoff": any(token in text for token in ("trade-off", "tradeoff", "alternative", "instead", "cost")),
        "reflection": any(token in text for token in ("learned", "would change", "next time", "improve")),
    }


def policy_question(request: QuestionRequest) -> tuple[str, str, bool, Literal["easy", "adaptive", "hard"]]:
    candidate = request.context.candidate
    topic, topic_kind = context_topic(candidate)
    answer = (request.previous_answer or "").strip()
    difficulty = request.context.difficulty

    if answer:
        signal = answer_signal(answer)
        if not signal["evidence"]:
            return ("What was the measurable outcome or concrete evidence that your approach worked?", "evidence_gap", True, difficulty)
        if not signal["tradeoff"]:
            return ("What alternatives did you consider, and why did you choose this approach over them?", "tradeoff_gap", True, difficulty)
        if not signal["reflection"]:
            return ("Looking back, what would you change if you had to solve the same problem again?", "reflection_gap", True, difficulty)
        return ("Let's go one level deeper: what was the hardest detail behind that decision, and how did you validate it?", "depth_probe", True, difficulty)

    stage = request.stage or stage_for_question(request.context.interview_type, request.question_index)
    if stage == "intro":
        return ("Give me a concise introduction focused on your current skills, strongest project, and the kind of role you are preparing for.", "intro_policy", False, difficulty)
    if topic and topic_kind == "project":
        return (f"You listed '{topic}'. Walk me through the problem, architecture, your personal contribution, and the toughest technical decision.", "resume_project", False, difficulty)
    if topic and topic_kind == "experience":
        return (f"You mentioned '{topic}' in your experience. What did you personally own, what challenge did you face, and what was the outcome?", "resume_experience", False, difficulty)
    if topic:
        return (f"You list {topic} as a skill. Describe one real problem where you used it and how you verified your solution.", "resume_skill", False, difficulty)

    templates = {
        "technical": "Choose a technical problem you solved recently. Explain your approach, one alternative you rejected, and the final result.",
        "behavioral": "Tell me about a time you disagreed with a teammate. What did you do, and what was the outcome?",
        "deep_dive": "Take one project from your background and explain the most important design trade-off you made.",
        "closing": "What is one skill you are actively improving, and what evidence shows that you are getting better at it?",
    }
    return (templates.get(stage, templates["technical"]), "interview_template", False, difficulty)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-engine", "version": "0.3.1"}


@app.post("/v1/interview/question", response_model=QuestionResponse)
def generate_question(request: QuestionRequest) -> QuestionResponse:
    question, rationale, follow_up, difficulty = policy_question(request)
    generated = provider().generate(request, question)
    if generated:
        question = generated
        source: Literal["candidate_context", "adaptive_follow_up", "interview_template", "provider"] = "provider"
    elif follow_up:
        source = "adaptive_follow_up"
    elif rationale.startswith("resume_"):
        source = "candidate_context"
    else:
        source = "interview_template"

    policy = get_policy(request.context.interview_type)
    stage = request.stage or stage_for_question(request.context.interview_type, request.question_index)
    return QuestionResponse(
        question=question,
        role=policy.primary_role,
        rationale=rationale,
        source=source,
        follow_up=follow_up,
        difficulty=difficulty,
        stage=stage,
        question_index=request.question_index,
        policy_focus=list(policy.focus),
    )
