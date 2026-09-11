from __future__ import annotations

from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Interview Platform AI Engine", version="0.2.0")


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
    stage: str = "intro"
    previous_answer: str | None = None
    previous_question: str | None = None


class QuestionResponse(BaseModel):
    question: str
    role: str
    rationale: str
    source: Literal["candidate_context", "adaptive_follow_up", "interview_template"]
    follow_up: bool = False


def first_non_empty(values: list[str]) -> str | None:
    return next((value.strip() for value in values if value and value.strip()), None)


def context_topic(candidate: CandidateContext) -> str | None:
    return first_non_empty(candidate.projects) or first_non_empty(candidate.experience) or first_non_empty(candidate.skills)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-engine", "version": "0.2.0"}


@app.post("/v1/interview/question", response_model=QuestionResponse)
def generate_question(request: QuestionRequest) -> QuestionResponse:
    """Stable orchestration contract with grounded deterministic behavior.

    A production provider can replace the question policy without changing the API.
    Candidate facts are treated as context, not as evidence for inferred traits.
    """
    candidate = request.context.candidate

    if request.previous_answer:
        topic = request.previous_question or "your previous answer"
        return QuestionResponse(
            question=f"You mentioned {topic.lower()}. Can you give me one concrete example, explain the trade-off you considered, and tell me what you would change today?",
            role="technical_interviewer",
            rationale="The candidate answered, so the engine requests evidence, trade-offs, and reflection instead of repeating a generic question.",
            source="adaptive_follow_up",
            follow_up=True,
        )

    topic = context_topic(candidate)
    if topic:
        if topic in candidate.projects:
            question = f"You listed a project called '{topic}'. Walk me through the problem, your architecture, and the most difficult technical decision you made."
        elif topic in candidate.experience:
            question = f"You mentioned '{topic}' in your experience. What was your specific contribution, and how did you measure the result?"
        else:
            question = f"You list {topic} as a skill. Tell me about a real situation where you used it, including one technical challenge you had to solve."
        return QuestionResponse(
            question=question,
            role="technical_interviewer",
            rationale="The opening question is grounded in the candidate context when a concrete resume item is available.",
            source="candidate_context",
        )

    return QuestionResponse(
        question="Tell me about a project you are most proud of and the impact you had on it.",
        role="technical_interviewer",
        rationale=f"Opening question for {request.context.interview_type} interview when no grounded candidate item is available.",
        source="interview_template",
    )
