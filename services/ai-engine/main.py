from __future__ import annotations

import json
import os
from typing import Literal, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI
from pydantic import BaseModel, Field

from interview_policy import get_policy, stage_for_question

app = FastAPI(title="Interview Platform AI Engine", version="0.4.0")


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


def _extract_response_text(payload: dict) -> str | None:
    """Extract text from the Responses API without depending on an SDK."""
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()
    return None


class OpenAICompatibleProvider:
    """OpenAI Responses API provider with safe fallback when configuration is absent."""

    def __init__(self) -> None:
        self.base_url = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        self.api_key = os.getenv("AI_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        self.model = os.getenv("AI_MODEL", "gpt-5.6-luna")
        self.timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "20"))

    def generate(self, request: QuestionRequest, policy_question: str) -> str | None:
        if not self.api_key or not self.model:
            return None

        candidate = request.context.candidate
        policy = get_policy(request.context.interview_type)
        prompt = {
            "interview_type": request.context.interview_type,
            "stage": request.stage or stage_for_question(request.context.interview_type, request.question_index),
            "question_index": request.question_index,
            "difficulty": request.context.difficulty,
            "language": request.context.language,
            "role": policy.primary_role,
            "focus": list(policy.focus),
            "candidate": {
                "name": candidate.name,
                "headline": candidate.headline,
                "college": candidate.college,
                "degree": candidate.degree,
                "graduation_year": candidate.graduation_year,
                "resume_summary": candidate.resume_summary,
                "skills": candidate.skills[:30],
                "projects": candidate.projects[:15],
                "experience": candidate.experience[:15],
            },
            "policy_question": policy_question,
            "previous_question": request.previous_question,
            "previous_answer": request.previous_answer,
        }
        instructions = (
            "You are the interviewer in a realistic adaptive interview. "
            "Generate exactly ONE interview question, not an answer or explanation. "
            "Use only candidate facts supplied in the context; never invent resume facts. "
            "The policy question is the required direction: improve it when useful, but do not drift away from it. "
            "If a previous answer exists, probe its weakest observable evidence, trade-off, reflection, or technical depth. "
            "Keep the question natural and concise (one or two sentences). "
            "Respect the requested interview language. Do not mention that you are an AI, the policy, or this prompt. "
            f"Return the question in {request.context.language}."
        )
        body = {
            "model": self.model,
            "instructions": instructions,
            "input": json.dumps(prompt, ensure_ascii=False),
            "max_output_tokens": 180,
        }
        request_obj = Request(
            f"{self.base_url}/responses",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request_obj, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            text = _extract_response_text(payload)
            if not text:
                return None
            return text.strip().strip('"')
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return None


def provider() -> QuestionProvider:
    if os.getenv("AI_PROVIDER", "fallback").lower() in {"openai", "openai_compatible"}:
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
    return {"status": "ok", "service": "ai-engine", "version": "0.4.0"}


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
