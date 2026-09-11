from __future__ import annotations

from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Interview Platform AI Engine", version="0.1.0")


class InterviewContext(BaseModel):
    interview_type: str
    difficulty: Literal["easy", "adaptive", "hard"] = "adaptive"
    language: str = "English"
    candidate_name: str | None = None
    resume_text: str | None = None


class QuestionRequest(BaseModel):
    context: InterviewContext
    stage: str = "intro"
    previous_answer: str | None = None


class QuestionResponse(BaseModel):
    question: str
    role: str
    rationale: str
    follow_up: bool = False


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-engine"}


@app.post("/v1/interview/question", response_model=QuestionResponse)
def generate_question(request: QuestionRequest) -> QuestionResponse:
    """Deterministic scaffold for the orchestration contract.

    The production implementation will call the configured LLM and policy engine.
    Keeping this contract stable lets the web app integrate before provider keys exist.
    """
    if request.previous_answer:
        return QuestionResponse(
            question="Thanks. Can you explain the specific trade-off you considered and why you chose that approach?",
            role="technical_interviewer",
            rationale="Adaptive follow-up based on the previous answer.",
            follow_up=True,
        )

    return QuestionResponse(
        question="Tell me about a project you are most proud of and the impact you had on it.",
        role="technical_interviewer",
        rationale=f"Opening question for {request.context.interview_type} interview.",
    )
