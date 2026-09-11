from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class InterviewPolicy:
    stages: tuple[str, ...]
    max_questions: int
    primary_role: str
    focus: tuple[str, ...]


POLICIES: dict[str, InterviewPolicy] = {
    "placement": InterviewPolicy(
        stages=("intro", "technical", "deep_dive", "behavioral", "closing"),
        max_questions=10,
        primary_role="technical_interviewer",
        focus=("fundamentals", "projects", "problem solving", "behavioral evidence"),
    ),
    "hr": InterviewPolicy(
        stages=("intro", "behavioral", "deep_dive", "closing"),
        max_questions=8,
        primary_role="hr_interviewer",
        focus=("communication", "motivation", "situational judgment", "reflection"),
    ),
    "upsc": InterviewPolicy(
        stages=("intro", "technical", "deep_dive", "behavioral", "closing"),
        max_questions=10,
        primary_role="board_member",
        focus=("clarity", "reasoning", "public-service judgment", "current-affairs reasoning"),
    ),
    "college": InterviewPolicy(
        stages=("intro", "technical", "deep_dive", "closing"),
        max_questions=8,
        primary_role="faculty_interviewer",
        focus=("fundamentals", "projects", "learning ability", "clarity"),
    ),
    "mba": InterviewPolicy(
        stages=("intro", "behavioral", "deep_dive", "technical", "closing"),
        max_questions=9,
        primary_role="mba_interviewer",
        focus=("leadership", "business reasoning", "communication", "trade-offs"),
    ),
    "ssb": InterviewPolicy(
        stages=("intro", "behavioral", "deep_dive", "closing"),
        max_questions=8,
        primary_role="assessor",
        focus=("situational reasoning", "clarity", "decision making", "reflection"),
    ),
}

DEFAULT_POLICY = POLICIES["placement"]


def get_policy(interview_type: str) -> InterviewPolicy:
    return POLICIES.get(interview_type, DEFAULT_POLICY)


def stage_for_question(interview_type: str, question_index: int) -> str:
    policy = get_policy(interview_type)
    if question_index < 0:
        question_index = 0
    return policy.stages[min(question_index * len(policy.stages) // max(policy.max_questions, 1), len(policy.stages) - 1)]
