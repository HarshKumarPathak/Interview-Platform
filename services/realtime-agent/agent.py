import asyncio
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv
from livekit import room_io
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, TurnHandlingOptions, cli
from livekit.agents.llm import ChatMessage
from livekit.plugins import anam, openai

load_dotenv()

server = AgentServer()


def interview_id_from_room(room_name: str) -> str | None:
    prefix = "interview-"
    return room_name[len(prefix) :] if room_name.startswith(prefix) else None


async def fetch_context(interview_id: str) -> dict:
    base_url = os.getenv("WEB_APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.getenv("LIVEKIT_AGENT_SHARED_SECRET", "")
    url = f"{base_url}/api/internal/interviews/{interview_id}/context"

    def request() -> dict:
        req = urllib.request.Request(url, headers={"x-livekit-agent-secret": secret, "accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    return await asyncio.to_thread(request)


async def persist_turn(interview_id: str, speaker: str, content: str, metadata: dict) -> None:
    base_url = os.getenv("WEB_APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.getenv("LIVEKIT_AGENT_SHARED_SECRET", "")
    url = f"{base_url}/api/internal/interviews/{interview_id}/turns"
    payload = json.dumps({"speaker": speaker, "content": content, "metadata": metadata}).encode("utf-8")

    def request() -> None:
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "x-livekit-agent-secret": secret,
                "content-type": "application/json",
                "accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=10):
            return None

    try:
        await asyncio.to_thread(request)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(f"turn persistence failed: {error}")


def build_instructions(context: dict) -> str:
    interview = context.get("interview", {})
    candidate = context.get("candidate", {})
    resume = context.get("resume") or {}
    resume_context = resume.get("context") if isinstance(resume, dict) else {}
    resume_context = resume_context if isinstance(resume_context, dict) else {}
    skills = resume_context.get("skills", [])[:12]
    projects = [p.get("name") for p in resume_context.get("projects", []) if isinstance(p, dict) and p.get("name")][:8]
    experience = [
        " at ".join(str(value) for value in [item.get("role"), item.get("company")] if value)
        for item in resume_context.get("experience", [])
        if isinstance(item, dict)
    ][:8]
    recent_turns = context.get("recent_turns") or []
    transcript_context = "\n".join(f"{turn.get('speaker')}: {turn.get('content')}" for turn in recent_turns[-8:] if turn.get("content"))

    policy = {
        "placement": "intro → technical → deep_dive → behavioral → closing; prioritize fundamentals, projects and problem solving",
        "hr": "intro → behavioral → deep_dive → closing; prioritize evidence from candidate experiences",
        "upsc": "intro → technical → deep_dive → behavioral → closing; probe structured reasoning and subject understanding",
        "college": "intro → technical → deep_dive → closing; probe fundamentals and academic projects",
        "mba": "intro → behavioral → deep_dive → technical → closing; probe decisions, trade-offs and business reasoning",
        "ssb": "intro → behavioral → deep_dive → closing; probe concrete evidence and decision-making",
    }.get(str(interview.get("type", "placement")), "adaptive professional interview")

    return (
        "You are a professional human-style interviewer in a live video interview. "
        "This is not a chatbot conversation: behave like a real interviewer on a video call. "
        "Listen fully before responding, use brief natural acknowledgements when appropriate, leave a short conversational pause, "
        "and ask one clear question at a time. If the candidate interrupts you, stop speaking immediately and listen. "
        "When an answer is vague, probe with a specific follow-up based on what the candidate actually said. "
        "Do not stack questions. Do not narrate your internal reasoning. Do not repeat questions already answered. "
        "Use a calm professional tone, with natural variation rather than scripted praise. "
        "The adaptive question engine is the source of truth for question selection; when it supplies a selected question, ask it faithfully. "
        "Never invent candidate experience or facts. Never infer personality, intelligence, honesty, health, or sensitive traits from voice/video. "
        f"Interview type: {interview.get('type')}. Difficulty: {interview.get('difficulty')}. Language: {interview.get('language')}. "
        f"Panel size: {interview.get('panel_size')}. Interview policy: {policy}. "
        f"Candidate: {candidate.get('display_name')}. Headline: {candidate.get('headline')}. College: {candidate.get('college')}. "
        f"Degree: {candidate.get('degree')}. Graduation year: {candidate.get('graduation_year')}. "
        f"Resume summary: {resume_context.get('summary', '')}. Resume skills: {', '.join(map(str, skills))}. "
        f"Resume projects: {', '.join(map(str, projects))}. Resume experience: {', '.join(map(str, experience))}. "
        "Recent interview transcript context (continue from this state):\n"
        f"{transcript_context or '(no previous turns)'}"
    )


def build_question_request(context: dict, question_index: int, previous_question: str | None, previous_answer: str | None) -> dict:
    interview = context.get("interview", {})
    candidate = context.get("candidate", {})
    resume = context.get("resume") or {}
    resume_context = resume.get("context") if isinstance(resume, dict) else {}
    resume_context = resume_context if isinstance(resume_context, dict) else {}
    return {
        "context": {
            "interview_type": interview.get("type", "placement"),
            "difficulty": interview.get("difficulty", "adaptive"),
            "language": interview.get("language", "English"),
            "candidate": {
                "name": candidate.get("display_name"),
                "headline": candidate.get("headline"),
                "college": candidate.get("college"),
                "degree": candidate.get("degree"),
                "graduation_year": candidate.get("graduation_year"),
                "resume_summary": resume_context.get("summary"),
                "skills": resume_context.get("skills", [])[:30],
                "projects": [p.get("name") for p in resume_context.get("projects", []) if isinstance(p, dict) and p.get("name")][:15],
                "experience": [
                    " at ".join(str(value) for value in [item.get("role"), item.get("company")] if value)
                    for item in resume_context.get("experience", [])
                    if isinstance(item, dict)
                ][:15],
            },
        },
        "question_index": question_index,
        "previous_question": previous_question,
        "previous_answer": previous_answer,
    }


async def generate_next_question(context: dict, question_index: int, previous_question: str | None, previous_answer: str | None) -> dict | None:
    base_url = os.getenv("AI_ENGINE_URL", "http://localhost:8000").rstrip("/")
    url = f"{base_url}/v1/interview/question"
    payload = json.dumps(build_question_request(context, question_index, previous_question, previous_answer), ensure_ascii=False).encode("utf-8")

    def request() -> dict:
        req = urllib.request.Request(url, data=payload, method="POST", headers={"content-type": "application/json", "accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))

    try:
        return await asyncio.to_thread(request)
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        print(f"adaptive question engine unavailable: {error}")
        return None


class Interviewer(Agent):
    def __init__(self, instructions: str, context: dict) -> None:
        self.interview_context = context
        self.question_index = len([turn for turn in context.get("recent_turns", []) if turn.get("speaker") == "candidate"])
        self.previous_question: str | None = next((turn.get("content") for turn in reversed(context.get("recent_turns") or []) if turn.get("speaker") == "interviewer" and turn.get("content")), None)
        self.pending_question: dict | None = None
        super().__init__(
            instructions=instructions,
            llm=openai.realtime.RealtimeModel(
                model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
                turn_detection=None,
            ),
        )

    async def on_user_turn_completed(self, turn_ctx, new_message: ChatMessage) -> None:
        answer = new_message.text_content.strip()
        if not answer:
            return
        self.question_index += 1
        next_question = await generate_next_question(self.interview_context, self.question_index, self.previous_question, answer)
        if not next_question or not next_question.get("question"):
            return
        self.pending_question = next_question
        self.previous_question = str(next_question["question"])
        await self.update_instructions(
            "Continue naturally after the candidate's answer. The adaptive engine selected the next question. "
            "Ask exactly this question and nothing else: "
            f"{next_question['question']}"
        )


@server.rtc_session(agent_name="interview-agent")
async def interview_agent(ctx: JobContext):
    interview_id = interview_id_from_room(ctx.room.name)
    if not interview_id:
        raise RuntimeError("LiveKit room name must be interview-{interviewId}")

    try:
        context = await fetch_context(interview_id)
    except Exception as error:
        print(f"interview context unavailable: {error}")
        context = {"interview": {"type": "placement", "difficulty": "adaptive", "language": "English", "panel_size": 1}, "candidate": {}, "resume": {}, "recent_turns": []}

    instructions = build_instructions(context)
    agent = Interviewer(instructions, context)
    avatar_provider = os.getenv("INTERVIEW_AVATAR_PROVIDER", "none").strip().lower()
    avatar_api_key = os.getenv("ANAM_API_KEY", "").strip()
    avatar_id = os.getenv("ANAM_AVATAR_ID", "").strip()
    avatar_enabled = avatar_provider == "anam" and bool(avatar_api_key and avatar_id)
    avatar = None

    session = AgentSession(
        turn_handling=TurnHandlingOptions(
            turn_detection="vad",
            preemptive_generation={"preemptive_tts": False},
        ),
    )

    if avatar_enabled:
        avatar = anam.AvatarSession(
            persona_config=anam.PersonaConfig(
                name=os.getenv("ANAM_AVATAR_NAME", "Interview Panel Lead"),
                avatarId=avatar_id,
            ),
            session_options=anam.SessionOptions(
                show_ai_avatar_disclosure=os.getenv("ANAM_SHOW_AI_DISCLOSURE", "true").lower() == "true",
            ),
            api_key=avatar_api_key,
            avatar_participant_name="interviewer-avatar-lead",
        )
        await avatar.start(session, room=ctx.room)
        await avatar.wait_for_join()

    @session.on("conversation_item_added")
    def on_conversation_item(event) -> None:
        item = event.item
        if not isinstance(item, ChatMessage):
            return
        text = item.text_content.strip()
        if not text or item.interrupted:
            return
        speaker = "candidate" if item.role == "user" else "interviewer"
        metadata = {
            "source": "livekit-agent",
            "realtime": True,
            "role": item.role,
            "avatar_enabled": avatar_enabled,
            "video_input_enabled": True,
        }
        if speaker == "interviewer" and agent.pending_question:
            metadata.update({
                "question_index": agent.pending_question.get("question_index"),
                "stage": agent.pending_question.get("stage"),
                "question_source": agent.pending_question.get("source"),
                "rationale": agent.pending_question.get("rationale"),
                "follow_up": agent.pending_question.get("follow_up", False),
                "policy_focus": agent.pending_question.get("policy_focus", []),
            })
            agent.pending_question = None
        asyncio.create_task(persist_turn(interview_id, speaker, text, metadata))

    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            video_input=True,
            audio_output=not avatar_enabled,
        ),
    )

    if not context.get("recent_turns"):
        first_question = await generate_next_question(context, 0, None, None)
        if first_question and first_question.get("question"):
            agent.pending_question = first_question
            agent.previous_question = str(first_question["question"])
            await agent.update_instructions(
                "Start the interview naturally. Greet the candidate briefly, then ask exactly this selected first question. "
                f"{first_question['question']}"
            )
            await session.generate_reply(instructions=f"Ask the selected first question exactly: {first_question['question']}")
        else:
            await session.generate_reply(instructions="Start the interview naturally. Greet the candidate briefly, then ask one concise opening question.")


if __name__ == "__main__":
    cli.run_app(server)
